/* ESP32-CAM firmware — Plan B slave for the taxi safety system.
 *
 * Role: receive "CAPTURE\n" from STM32 over UART2, then capture a burst of
 * BURST_FRAME_COUNT JPEG frames, POST each to the server with session +
 * frame-index headers, and ship the final aggregated decision back to STM32
 * as "RESULT:<1|0>;<name>;<sim>\n".
 *
 * UART2 (IO13 TX / IO14 RX) talks to STM32 USART1 at 115200.
 * U0 (USB CDC via ESP32-CAM-MB) is used only for printf/debug.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#if USE_TLS
#include <WiFiClientSecure.h>
#endif

#include "esp_camera.h"
#include "config.h"

static HardwareSerial StmUart(STM_UART_NUM);

/* ─── line-buffered RX ─────────────────────────────────────────────────── */
static String rx_line;     /* UART2 from STM32 */
static String usb_line;    /* USB CDC for manual testing */

/* Send to STM32 over UART2 AND echo to USB so we can watch live during tests. */
static void stm_send(const char *msg) {
    StmUart.print(msg);
    Serial.print("[->stm] ");
    Serial.print(msg);
}

/* ─── camera init ──────────────────────────────────────────────────────── */
static bool camera_init(void) {
    camera_config_t cfg = {};
    cfg.ledc_channel = LEDC_CHANNEL_0;
    cfg.ledc_timer   = LEDC_TIMER_0;
    cfg.pin_d0 = CAM_PIN_D0;
    cfg.pin_d1 = CAM_PIN_D1;
    cfg.pin_d2 = CAM_PIN_D2;
    cfg.pin_d3 = CAM_PIN_D3;
    cfg.pin_d4 = CAM_PIN_D4;
    cfg.pin_d5 = CAM_PIN_D5;
    cfg.pin_d6 = CAM_PIN_D6;
    cfg.pin_d7 = CAM_PIN_D7;
    cfg.pin_xclk  = CAM_PIN_XCLK;
    cfg.pin_pclk  = CAM_PIN_PCLK;
    cfg.pin_vsync = CAM_PIN_VSYNC;
    cfg.pin_href  = CAM_PIN_HREF;
    cfg.pin_sccb_sda = CAM_PIN_SIOD;
    cfg.pin_sccb_scl = CAM_PIN_SIOC;
    cfg.pin_pwdn  = CAM_PIN_PWDN;
    cfg.pin_reset = CAM_PIN_RESET;
    cfg.xclk_freq_hz = 20000000;
    cfg.pixel_format = PIXFORMAT_JPEG;
    cfg.frame_size   = FRAMESIZE_VGA;   /* 640x480 — enough for face crop */
    cfg.jpeg_quality = 12;              /* 0-63 lower = better quality, larger */
    cfg.fb_count     = 2;
    cfg.fb_location  = CAMERA_FB_IN_PSRAM;
    cfg.grab_mode    = CAMERA_GRAB_LATEST;

    esp_err_t err = esp_camera_init(&cfg);
    if (err != ESP_OK) {
        Serial.printf("[CAM] init failed: 0x%x\n", err);
        return false;
    }

    sensor_t *s = esp_camera_sensor_get();
    if (s) {
        Serial.printf("[CAM] sensor PID=0x%04X\n", s->id.PID);
        s->set_hmirror(s, 0);
        s->set_vflip(s, 0);
    }
    return true;
}

/* ─── POST one frame, parse response ────────────────────────────────────── */
struct PostResult {
    bool      ok;          /* HTTP 200 + valid JSON */
    bool      final;       /* This was the last frame, response carries final decision */
    bool      match;
    char      name[48];
    float     similarity;
    char      err[32];     /* If !ok, short error code */
};

static void post_frame(camera_fb_t *fb,
                       const char *session_id,
                       int idx, int total,
                       PostResult &out) {
    out = {};

#if USE_TLS
    WiFiClientSecure client;
    client.setInsecure();   /* TODO Phase 2: setCACert(ISRG_ROOT_X1) */
#else
    WiFiClient client;
#endif
    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);
    if (!http.begin(client, SERVER_URL)) {
        strncpy(out.err, "begin", sizeof(out.err));
        return;
    }
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("X-Session-Id", session_id);
    char buf[8];
    snprintf(buf, sizeof(buf), "%d", idx);
    http.addHeader("X-Frame-Index", buf);
    snprintf(buf, sizeof(buf), "%d", total);
    http.addHeader("X-Frame-Total", buf);
    if (strlen(SHARED_SECRET) > 0) http.addHeader("x-api-key", SHARED_SECRET);

    int code = http.POST(fb->buf, fb->len);
    if (code != 200) {
        snprintf(out.err, sizeof(out.err), "http_%d", code);
        http.end();
        return;
    }

    String body = http.getString();
    http.end();

    JsonDocument doc;
    if (deserializeJson(doc, body)) {
        strncpy(out.err, "json", sizeof(out.err));
        return;
    }

    out.ok = true;
    if (doc["status"].is<const char *>() &&
        strcmp(doc["status"], "continue") == 0) {
        out.final = false;
        bool q = doc["quality_ok_this_frame"] | false;
        Serial.printf("[CAM]   quality_ok=%d\n", q ? 1 : 0);
        return;
    }
    /* Final frame response has match/name/similarity + frames_used */
    out.final = true;
    out.match = doc["match"] | false;
    strncpy(out.name, doc["name"] | "", sizeof(out.name) - 1);
    out.similarity = doc["similarity"] | 0.0f;
    int frames_used = doc["frames_used"] | 0;
    int frames_total = doc["frames_total"] | 0;
    const char *reason = doc["reason"] | "";
    Serial.printf("[CAM]   final: match=%d name=%s sim=%.3f used=%d/%d reason=%s\n",
                  out.match ? 1 : 0, out.name, out.similarity,
                  frames_used, frames_total, reason);
}

/* ─── one full 10-frame burst ──────────────────────────────────────────── */
static void run_burst(void) {
    Serial.println("[CAM] burst start");

    if (WiFi.status() != WL_CONNECTED) {
        stm_send("ERR:no_wifi\n");
        return;
    }

    /* Turn the onboard flash LED on for the duration of the burst so the
     * sensor has decent light. Let auto-exposure settle for one throwaway
     * frame before the real burst starts. */
    digitalWrite(CAM_PIN_LED_FLASH, HIGH);
    delay(150);
    camera_fb_t *warm = esp_camera_fb_get();
    if (warm) esp_camera_fb_return(warm);
    delay(150);

    char session_id[40];
    {
        uint32_t r[4] = { esp_random(), esp_random(), esp_random(), esp_random() };
        snprintf(session_id, sizeof(session_id),
                 "%08x-%04x-4%03x-%04x-%08x%04x",
                 r[0],
                 (r[1] >> 16) & 0xFFFF,
                 r[1] & 0x0FFF,
                 ((r[2] >> 16) & 0x3FFF) | 0x8000,
                 r[2] & 0xFFFF,
                 r[3] & 0xFFFF);
    }

    const uint32_t frame_period_ms = 1000 / BURST_FPS;
    PostResult final_resp = {};
    bool final_received = false;
    uint32_t next_frame_at = millis();

    for (int i = 1; i <= BURST_FRAME_COUNT; i++) {
        /* throttle to BURST_FPS */
        while ((int32_t)(next_frame_at - millis()) > 0) delay(1);
        next_frame_at += frame_period_ms;

        camera_fb_t *fb = esp_camera_fb_get();
        if (!fb) {
            Serial.println("[CAM] fb_get failed");
            continue;
        }
        Serial.printf("[CAM] frame %d/%d, %u bytes\n", i, BURST_FRAME_COUNT, fb->len);

        PostResult r;
        post_frame(fb, session_id, i, BURST_FRAME_COUNT, r);
        esp_camera_fb_return(fb);

        if (!r.ok) {
            Serial.printf("[CAM] post err: %s\n", r.err);
            char msg[40];
            snprintf(msg, sizeof(msg), "ERR:%s\n", r.err);
            stm_send(msg);
            return;
        }
        if (r.final) {
            final_resp = r;
            final_received = true;
            /* server should only emit final on the last frame, break early just in case */
            break;
        }
    }

    digitalWrite(CAM_PIN_LED_FLASH, LOW);

    if (!final_received) {
        stm_send("ERR:no_final\n");
        return;
    }

    char msg[96];
    snprintf(msg, sizeof(msg), "RESULT:%d;%s;%.2f\n",
             final_resp.match ? 1 : 0,
             final_resp.name,
             final_resp.similarity);
    stm_send(msg);
    Serial.printf("[CAM] -> %s", msg);
}

/* ─── setup / loop ─────────────────────────────────────────────────────── */
void setup(void) {
    Serial.begin(115200);
    StmUart.begin(STM_UART_BAUD, SERIAL_8N1, STM_UART_RX_PIN, STM_UART_TX_PIN);

    pinMode(CAM_PIN_LED_FLASH, OUTPUT);
    digitalWrite(CAM_PIN_LED_FLASH, LOW);

    Serial.println("\n[CAM] boot");

    if (!camera_init()) {
        Serial.println("[CAM] HALT — camera init failed");
        while (1) delay(500);
    }

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[CAM] wifi connecting to %s\n", WIFI_SSID);
    uint32_t t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 30000) {
        delay(250);
        Serial.print('.');
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[CAM] wifi ok, ip=%s rssi=%d\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("\n[CAM] wifi FAILED");
    }

    stm_send("HB\n");
}

static uint32_t last_hb = 0;

void loop(void) {
    /* heartbeat once per 5 s */
    if (millis() - last_hb > 5000) {
        stm_send("HB\n");
        last_hb = millis();
    }

    /* consume UART2 (from STM32) line by line */
    while (StmUart.available()) {
        char c = (char)StmUart.read();
        if (c == '\n' || c == '\r') {
            if (rx_line.length() > 0) {
                String cmd = rx_line;
                rx_line = "";
                Serial.printf("[CAM] stm: %s\n", cmd.c_str());
                if (cmd == "CAPTURE") run_burst();
            }
        } else if (rx_line.length() < 120) {
            rx_line += c;
        }
    }

    /* USB CDC for manual testing — type CAPTURE<enter> in the serial monitor
     * to trigger a burst without an STM32 attached. */
    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\n' || c == '\r') {
            if (usb_line.length() > 0) {
                String cmd = usb_line;
                usb_line = "";
                Serial.printf("[CAM] usb: %s\n", cmd.c_str());
                if (cmd == "CAPTURE") run_burst();
            }
        } else if (usb_line.length() < 120) {
            usb_line += c;
        }
    }
}
