// ESP32-WROOM-32 — Wi-Fi bridge between STM32 (UART1) and Flask server.
//
// Burst flow:
//   1. STM sends 10 IMG frames back-to-back over UART (TYPE_IMG).
//   2. ESP detects start of burst (first IMG after idle), generates session_id.
//   3. For each IMG, ESP HTTP POSTs to SERVER_URL with headers:
//        X-Session-Id: <uuid>
//        X-Frame-Index: 1..N
//        X-Frame-Total: N
//   4. After the final frame, server returns the aggregated decision.
//   5. ESP encodes decision as ASCII "1;name;0.94" and sends back to STM as TYPE_RESULT.
//
// Frame protocol on UART:
//   0xAA 0x55 | TYPE | LEN_LE(4) | PAYLOAD | CRC8
//   TYPE: 0x01 IMG, 0x02 RESULT, 0x03 HB, 0x04 ERR, 0x05 ACK

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#if USE_TLS
#include <WiFiClientSecure.h>
#endif

#include "config.h"

#define SYNC1 0xAA
#define SYNC2 0x55
#define TYPE_IMG    0x01
#define TYPE_RESULT 0x02
#define TYPE_HB     0x03
#define TYPE_ERR    0x04
#define TYPE_ACK    0x05

HardwareSerial& StmUart = Serial1;

static uint8_t frameBuf[MAX_FRAME_SIZE];

// ─── burst session state ────────────────────────────────────────────────
static char sessionId[40] = {0};   // uuid v4 string
static uint16_t framesSent = 0;     // 0 means no burst in progress
static uint32_t lastFrameMs = 0;

static void newSessionId() {
    // RFC 4122 v4-ish via esp_random()
    uint32_t r[4];
    for (int i = 0; i < 4; i++) r[i] = esp_random();
    snprintf(sessionId, sizeof(sessionId),
             "%08x-%04x-4%03x-%04x-%08x%04x",
             r[0],
             (r[1] >> 16) & 0xFFFF,
             r[1] & 0x0FFF,
             ((r[2] >> 16) & 0x3FFF) | 0x8000,
             r[2] & 0xFFFF,
             r[3] & 0xFFFF);
}

// ─── frame protocol helpers ─────────────────────────────────────────────
static uint8_t crc8(const uint8_t* data, size_t len) {
    uint8_t crc = 0;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int b = 0; b < 8; b++) {
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x07) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}

static void sendFrame(uint8_t type, const uint8_t* payload, uint32_t len) {
    uint8_t header[7] = {
        SYNC1, SYNC2, type,
        (uint8_t)(len & 0xFF),
        (uint8_t)((len >> 8) & 0xFF),
        (uint8_t)((len >> 16) & 0xFF),
        (uint8_t)((len >> 24) & 0xFF),
    };
    StmUart.write(header, 7);
    if (len > 0 && payload) StmUart.write(payload, len);
    StmUart.write(crc8(payload, len));
    StmUart.flush();
}

static int readByteWithTimeout(uint32_t deadline) {
    while (!StmUart.available()) {
        if (millis() > deadline) return -1;
        delay(0);
    }
    return StmUart.read();
}

static bool readFrame(uint8_t& type, uint8_t* buf, uint32_t bufSize, uint32_t& outLen, uint32_t timeoutMs) {
    uint32_t deadline = millis() + timeoutMs;

    int b1 = -1, b2 = -1;
    while (millis() < deadline) {
        b1 = readByteWithTimeout(deadline);
        if (b1 < 0) return false;
        if (b1 != SYNC1) continue;
        b2 = readByteWithTimeout(deadline);
        if (b2 == SYNC2) break;
    }
    if (b2 != SYNC2) return false;

    int t = readByteWithTimeout(deadline);
    if (t < 0) return false;
    type = (uint8_t)t;

    uint32_t len = 0;
    for (int i = 0; i < 4; i++) {
        int x = readByteWithTimeout(deadline);
        if (x < 0) return false;
        len |= ((uint32_t)x) << (8 * i);
    }
    if (len > bufSize) {
        Serial.printf("[ESP] frame too large: %u\n", len);
        return false;
    }

    uint32_t got = 0;
    while (got < len) {
        int x = readByteWithTimeout(deadline);
        if (x < 0) return false;
        buf[got++] = (uint8_t)x;
    }

    int crc = readByteWithTimeout(deadline);
    if (crc < 0) return false;
    outLen = len;
    return crc8(buf, len) == (uint8_t)crc;
}

// ─── HTTP POST ──────────────────────────────────────────────────────────
static bool postFrame(const uint8_t* img, size_t imgLen,
                      uint16_t idx, uint16_t total,
                      String& body, int& httpCode) {
#if USE_TLS
    WiFiClientSecure client;
    client.setInsecure();  // TODO Phase 2: setCACert(ISRG_ROOT_X1)
#else
    WiFiClient client;
#endif
    HTTPClient http;
    http.setTimeout(HTTP_TIMEOUT_MS);
    if (!http.begin(client, SERVER_URL)) {
        httpCode = -1;
        return false;
    }
    http.addHeader("Content-Type", "application/octet-stream");
    http.addHeader("X-Session-Id", sessionId);
    char ibuf[8], tbuf[8];
    snprintf(ibuf, sizeof(ibuf), "%u", idx);
    snprintf(tbuf, sizeof(tbuf), "%u", total);
    http.addHeader("X-Frame-Index", ibuf);
    http.addHeader("X-Frame-Total", tbuf);

    httpCode = http.POST(const_cast<uint8_t*>(img), imgLen);
    if (httpCode == 200) body = http.getString();
    http.end();
    return httpCode == 200;
}

// ─── decision encoding ──────────────────────────────────────────────────
static void emitFinalResult(const String& jsonBody) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, jsonBody);
    if (err) {
        const char* reason = "json_parse";
        sendFrame(TYPE_ERR, (const uint8_t*)reason, strlen(reason));
        return;
    }
    bool match = doc["match"] | false;
    const char* name = doc["name"] | "";
    float similarity = doc["similarity"] | 0.0f;

    char out[96];
    int n = snprintf(out, sizeof(out), "%d;%s;%.2f",
                     match ? 1 : 0, name, similarity);
    sendFrame(TYPE_RESULT, (const uint8_t*)out, (uint32_t)n);
    Serial.printf("[ESP] final: %s\n", out);
}

// ─── setup / loop ───────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    StmUart.begin(STM_UART_BAUD, SERIAL_8N1, STM_RX_PIN, STM_TX_PIN);

    Serial.printf("[ESP] connecting to Wi-Fi: %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
        delay(250);
        Serial.print('.');
    }
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\n[ESP] Wi-Fi failed");
    } else {
        Serial.printf("\n[ESP] Wi-Fi OK ip=%s rssi=%d\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI());
    }
}

static uint32_t lastHb = 0;

void loop() {
    // periodic heartbeat to STM
    if (millis() - lastHb > 5000) {
        sendFrame(TYPE_HB, nullptr, 0);
        lastHb = millis();
    }

    // burst gap timeout: if no IMG arrived for a while, reset partial session
    if (framesSent > 0 && millis() - lastFrameMs > BURST_GAP_TIMEOUT_MS) {
        Serial.printf("[ESP] burst gap timeout, reset (had %u frames)\n", framesSent);
        framesSent = 0;
        sessionId[0] = 0;
    }

    uint8_t type = 0;
    uint32_t len = 0;
    if (!readFrame(type, frameBuf, sizeof(frameBuf), len, 200)) return;

    if (type != TYPE_IMG) {
        if (type == TYPE_HB) sendFrame(TYPE_ACK, nullptr, 0);
        return;
    }

    // start of burst?
    if (framesSent == 0) {
        newSessionId();
        Serial.printf("[ESP] new burst, session=%s\n", sessionId);
    }
    framesSent++;
    lastFrameMs = millis();

    Serial.printf("[ESP] IMG %u/%u (%u bytes)\n", framesSent, BURST_FRAME_COUNT, len);

    if (WiFi.status() != WL_CONNECTED) {
        const char* err = "no_wifi";
        sendFrame(TYPE_ERR, (const uint8_t*)err, strlen(err));
        framesSent = 0;
        return;
    }

    String body;
    int httpCode = 0;
    bool ok = postFrame(frameBuf, len, framesSent, BURST_FRAME_COUNT, body, httpCode);
    if (!ok) {
        char err[32];
        snprintf(err, sizeof(err), "http_%d", httpCode);
        sendFrame(TYPE_ERR, (const uint8_t*)err, strlen(err));
        framesSent = 0;
        return;
    }

    if (framesSent < BURST_FRAME_COUNT) {
        // intermediate frame, server returned {"status":"continue",...}; nothing to forward
        return;
    }

    // final frame: server returned aggregate decision
    emitFinalResult(body);
    framesSent = 0;
    sessionId[0] = 0;
}
