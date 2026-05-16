# Taksi Güvenlik — Teknik Sistem Açıklaması

Mühendis seviyesi: ne kullanıldı, neden bu seçildi, hangi register/protokol
nasıl ayarlandı, hangi sayısal değer neyle hesaplandı.

---

## 0. İskelet

Beş çalışan node, dört protokol stack'i:

```
                       Internet (4G/5G LTE)
                              │
              ┌───────────────┴────────────────┐
              │ HTTPS (TLS yok — demo HTTP)    │
              ▼                                ▼
      AWS EC2 m7i-flex.large          iPhone (TaksiGuvenlik.app)
      eu-central-1 (Frankfurt)        SwiftUI / iOS 17+
      Docker(Flask + gunicorn         CoreBluetooth central
              + InsightFace +         /auth REST client
              SQLite)                  ↑
                ▲                      │ BLE GATT (FFE0/FFE1, MTU 247)
                │ HTTP POST            │ NOTIFY (transparent ASCII)
                │ /search              │
                │ JPEG body            │
                │                      │
                │           ┌──────────┴─────────┐
                │           │ ESP32-CAM (AI-Thinker)
                │   Wi-Fi   │ ESP32-WROOM-32 + OV3660
                ├───STA────►│ esp_camera @ 5 FPS VGA
                            │ HTTPClient (Arduino)
                            │ NimBLE-Arduino peripheral
                            │
                            │ HardwareSerial 2 (UART, 115200 8N1)
                            │ TX = IO13 → RX
                            │ RX = IO14 ← TX
                            │
                  ┌─────────┴──────────┐
                  │ STM32 NUCLEO-F767ZI│
                  │ Cortex-M7 @ 216MHz │
                  │ STM32CubeIDE       │
                  │ HAL + USART6 manual│
                  │   EXTI13 (B1 USER) │
                  │   EXTI0  (PA0)     │
                  │ FSM (USER CODE)    │
                  └────────────────────┘
```

## 1. STM32 NUCLEO-F767ZI — Olay Yöneticisi

### 1.1 Çip ve kart

- **MCU:** STM32F767ZIT6, Cortex-M7 @ 216 MHz, 2 MB Flash / 512 KB RAM,
  FPU + DSP, single precision.
- **Kart:** NUCLEO-F767ZI (MB1137), ST-LINK V2-1 onboard, USB Mini-B
  programming/VCP, Arduino UNO R3 + ST Morpho header.
- **Kart osilatörü:** ST-LINK MCO çıkışından **HSE = 8 MHz** sağlanır
  (X3 yok, X2 OSC_IN bypass; ek X1 32.768 kHz LSE var ama
  kullanmıyoruz).

### 1.2 Saat üretiminde HSE_VALUE makro tuzağı

`STM32CubeF7` paketindeki `stm32f7xx_hal_conf.h` dosyasında satır:

```c
#if !defined  (HSE_VALUE)
  #define HSE_VALUE   ((uint32_t)25000000U) /*!< Value of External oscillator in Hz */
#endif
```

NUCLEO-F767ZI kartı için bu **yanlış**. Eğer CubeMX'ten HSE Bypass +
PLL ile sistem clock kurulursa, HAL'in `HAL_RCC_GetSysClockFreq()`
fonksiyonu PLLM/PLLN/PLLP değerlerini bu yanlış 25 MHz baz alarak
hesaplar:

```
gerçek_PLL_VCO  = HSE_real(8MHz) × N/M = 8 × 216/4 = 432 MHz
gerçek_SYSCLK   = VCO / P = 432/2 = 216 MHz

HAL'in sandığı    = HSE_macro(25MHz) × N/M = 25 × 216/4 = 1350 MHz
HAL'in SYSCLK     = 1350/2 = 675 MHz
```

`HAL_UART_Init()` BRR'yi hesaplarken HAL'in sandığı clock'u kullanır:

```
BRR_hesabı_HAL = 675e6 / 115200 ≈ 5859    (yazılır)
BRR_gereken    = 216e6 / 115200 ≈ 1875
Gerçek baud    = 216e6 / 5859 ≈ 36870 bps  → veri 1/3 hızda akar
```

Bu yüzden HSE'yi devre dışı bıraktık. Çözüm: **HSI tabanlı PLL**.
HSI = 16 MHz dahili RC osilatör (factory kalibre, ±%1 doğruluk).
`SystemClock_Config_216MHz()` fonksiyonu (`Core/Src/main.c` USER CODE 4):

```c
RCC_OscInitTypeDef o = {0};
RCC_ClkInitTypeDef c = {0};
__HAL_RCC_PWR_CLK_ENABLE();
__HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);
o.OscillatorType     = RCC_OSCILLATORTYPE_HSI;
o.HSIState           = RCC_HSI_ON;
o.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
o.PLL.PLLState       = RCC_PLL_ON;
o.PLL.PLLSource      = RCC_PLLSOURCE_HSI;
o.PLL.PLLM           = 8;              // HSI / M = 16/8 = 2 MHz VCO ref
o.PLL.PLLN           = 216;            // VCO = 2 × 216 = 432 MHz
o.PLL.PLLP           = RCC_PLLP_DIV2;  // SYSCLK = 432/2 = 216 MHz
o.PLL.PLLQ           = 9;              // USB OTG_FS = 432/9 = 48 MHz
HAL_RCC_OscConfig(&o);
HAL_PWREx_EnableOverDrive();           // ≥ 168 MHz için zorunlu
c.ClockType  = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_SYSCLK |
               RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
c.SYSCLKSource   = RCC_SYSCLKSOURCE_PLLCLK;
c.AHBCLKDivider  = RCC_SYSCLK_DIV1;    // HCLK = 216 MHz
c.APB1CLKDivider = RCC_HCLK_DIV4;      // APB1 = 54 MHz (max 54)
c.APB2CLKDivider = RCC_HCLK_DIV2;      // APB2 = 108 MHz (max 108)
HAL_RCC_ClockConfig(&c, FLASH_LATENCY_7);
```

Flash latency = 7 WS, F767 @ 216 MHz / 1.9 V VOS için.

### 1.3 Pin atamaları (Plan B v2)

| İşlev | STM32 pin | AF | Arduino label | Bağlantı |
|---|---|---|---|---|
| USART6_TX | PG14 | AF8 | D1 | ESP32-CAM IO14 (UART2 RX) |
| USART6_RX | PG9  | AF8 | D0 | ESP32-CAM IO13 (UART2 TX) |
| USART3_TX | PD8  | AF7 | (Morpho/ST-LINK) | ST-LINK VCP printf |
| USART3_RX | PD9  | AF7 | (Morpho/ST-LINK) | ST-LINK VCP printf |
| EXTI13    | PC13 | — | B1 USER (mavi) | TARA butonu (kart üzerinde pull-up) |
| EXTI0     | PA0  | — | (harici) | PANİK butonu (harici, takılı değil) |
| LD1 yeşil | PB0  | GPIO_OUT push-pull | (onboard) | IDLE / NOMATCH göstergesi |
| LD2 mavi  | PB7  | GPIO_OUT push-pull | (onboard) | Heartbeat ~1 Hz + NETERR blink |
| LD3 kırmızı | PB14 | GPIO_OUT push-pull | (onboard) | MATCH / PANIC |
| Buzzer    | PD14 | GPIO_OUT push-pull | (harici) | MATCH / PANIC ses |

**USART6 manuel init.** CubeMX UART6 için Morpho header üzerinden
gösteriyor ama Arduino D0/D1 silkscreen ile aynı pin (PG9/PG14).
Manuel init `USER CODE 4` bölgesinde:

```c
static void MX_USART6_UART_Init_Manual(void) {
    __HAL_RCC_USART6_CLK_ENABLE();
    __HAL_RCC_GPIOG_CLK_ENABLE();
    GPIO_InitTypeDef g = {0};
    g.Pin       = GPIO_PIN_9 | GPIO_PIN_14;
    g.Mode      = GPIO_MODE_AF_PP;
    g.Pull      = GPIO_PULLUP;
    g.Speed     = GPIO_SPEED_FREQ_VERY_HIGH;
    g.Alternate = GPIO_AF8_USART6;
    HAL_GPIO_Init(GPIOG, &g);

    huart6.Instance        = USART6;
    huart6.Init.BaudRate   = 115200;
    huart6.Init.WordLength = UART_WORDLENGTH_8B;
    huart6.Init.StopBits   = UART_STOPBITS_1;
    huart6.Init.Parity     = UART_PARITY_NONE;
    huart6.Init.HwFlowCtl  = UART_HWCONTROL_NONE;
    huart6.Init.Mode       = UART_MODE_TX_RX;
    huart6.Init.OverSampling = UART_OVERSAMPLING_16;
    huart6.Init.OneBitSampling = UART_ONE_BIT_SAMPLE_DISABLE;
    HAL_UART_Init(&huart6);

    // RX kesme ile bayt-bayt
    HAL_NVIC_SetPriority(USART6_IRQn, 5, 0);
    HAL_NVIC_EnableIRQ(USART6_IRQn);
    SET_BIT(USART6->CR1, USART_CR1_RXNEIE);
}
```

USART6 APB2 (108 MHz) clock kullanır. Oversampling 16: BRR = 108e6 /
115200 = 937.5 → 937 mantissa + 8/16 fraction. UART register fraction
4 bit = 8 → BRR yazılır 0x3A8 (937.5 ≈ 0x3A8). Baud hatası %0.16,
kabul edilir (<%2).

**`USART6_IRQHandler` CubeMX tarafından üretilmiyor.** Elle yazıldı:

```c
void USART6_IRQHandler(void) {
    if (USART6->ISR & USART_ISR_RXNE) {
        uint8_t b = (uint8_t)(USART6->RDR & 0xFF);
        if (uart_rx_len < sizeof(uart_rx_buf) - 1) {
            uart_rx_buf[uart_rx_len++] = b;
            if (b == '\n') {
                uart_rx_buf[uart_rx_len] = '\0';
                uart_line_ready = 1;
                // Ana döngü process_cam_line() çağırır.
            }
        }
    }
}
```

Ana döngü `volatile uint8_t uart_line_ready` flag'ini izler, satır
geldiğinde process eder. ISR içinde işin yapmamak için temel kural.

### 1.4 State machine

**Tasarım doğrulama katmanı:** `state_machine.c/.h` taşınabilir C99,
HAL-bağımsız. Donanım çağrıları bir vtable callback üzerinden:

```c
typedef enum {
    SM_LED_GREEN = 0, SM_LED_YELLOW, SM_LED_RED
} sm_led_t;

typedef struct {
    void     (*set_led)(sm_led_t led, bool on);
    void     (*set_buzzer)(bool on);
    void     (*send_to_esp)(const char *line);  // RESULT veya telefon-yön mesaj
    uint32_t (*now_ms)(void);
} sm_callbacks_t;

typedef enum {
    SM_EV_TARA_PRESS,
    SM_EV_PANIC_PRESS,
    SM_EV_ESP_MATCH,
    SM_EV_ESP_NOMATCH,
    SM_EV_ESP_ERR,
    SM_EV_TICK,
} sm_event_t;

typedef enum {
    SM_STATE_IDLE = 0, SM_STATE_SCANNING, SM_STATE_MATCH,
    SM_STATE_NOMATCH, SM_STATE_PANIC, SM_STATE_NETERR,
} sm_state_t;
```

PC üzerinde `gcc -O2 -Wall state_machine.c sm_test.c -o sm_test` ile
derleniyor, 12 senaryo deterministik geçiyor (initial state, TARA press,
ESP MATCH/NOMATCH, scan timeout, PANIC during scan, hold expiry,
heartbeat, late ESP result, NETERR blink, oversized name).

**Embedded katman:** `main.c` USER CODE bloklarında durum aynısı
yeniden yazıldı (CubeMX yenilemesi ile çakışmasın diye). `apply_state_outputs(s)`
fonksiyonu her LED + buzzer'ı önce sıfırlar, sonra duruma göre set
eder. Hold timerlar:

```
MATCH    hold = 5000 ms
NOMATCH  hold = 2000 ms
NETERR   hold = 3000 ms
PANIC    hold = 10000 ms
```

Hold süresinde yeni TARA basışı **hold'u keser** ve SCANNING'e geçer
(şoför aceleyse beklemesin diye). Heartbeat IDLE'da 5 saniyede bir
`HB\n` satırını USART6'ya yazar.

### 1.5 ESP'ye yazılan / ESP'den okunan satırlar

USART6 üzerinden **iki yönlü ASCII**, newline-delimited. STM → ESP:

| Satır | Anlam |
|---|---|
| `CAPTURE\n` | Yakalama başlat (ESP burst yapacak) |
| `SCANNING\n` | Telefon-yön bilgi (ESP BLE notify edecek) |
| `MATCH:<name>;<sim>\n` | Telefon-yön (eşleşme) |
| `NOMATCH\n` | Telefon-yön |
| `PANIC\n` | Telefon-yön + STM panic durumuna giriş |
| `NETERR\n` | Telefon-yön (sunucu/Wi-Fi hatası) |

ESP → STM:

| Satır | Anlam |
|---|---|
| `RESULT:1;<name>;<sim>\n` | Burst sonucu = MATCH |
| `RESULT:0;;<sim>\n` | Burst sonucu = NOMATCH (sim = en yakın benzerlik) |
| `ERR:<tag>\n` | Hata (`no_wifi`, `http_500`, `json_parse`, `timeout`) |
| `HB\n` | ESP heartbeat (5 saniyede bir) |

Parser dikkati: similarity float, locale-bağımsız parse için `strtof()`
kullanılır (`stdlib.h`). isim 32 byte cap'li, taşma korunur.

---

## 2. ESP32-CAM AI-Thinker — Kamera + Wi-Fi + BLE

### 2.1 Donanım

- **SoC:** ESP32-WROOM-32 (dual core Xtensa LX6 @ 240 MHz, 520 KB SRAM,
  4 MB Flash, 802.11 b/g/n Wi-Fi, Bluetooth 4.2 BR/EDR + BLE).
- **Kamera:** OmniVision OV3660, 2048×1536 max, JPEG hardware encoder,
  DVP parallel interface, SCCB (I2C-like) kontrol.
- **PSRAM:** 4 MB ext PSRAM (QIO/QSPI), kamera framebuffer için.
- **Anten:** PCB trace, U.FL connector boş.
- **Programlama:** ESP32-CAM-MB dock, CH340 USB-Serial, "FLASH" düğmesi
  IO0'ı GND'ye çekiyor (bootloader mode).

### 2.2 Güç bütçesi ve brown-out

Beslemede AMS1117-3.3 LDO var (3.3 V çıkış, max 1 A nominal). Tipik
akımlar:
- Wi-Fi idle: ~100 mA
- Wi-Fi TX burst: 300-400 mA pik
- Kamera capture: +100 mA
- BLE advertising: +30 mA

Eşzamanlı = ~500 mA pik. STM NUCLEO 5V pini USB-limited (max ~300 mA
girişten 5V çıkışa). 5V girişe düşüş olunca AMS1117 dropout (1.2 V) ile
3.3 V hattı 3.0 V altına düşer → ESP32 brown-out detector (BOD)
reset atar. Çözüm: **ESP-CAM kendi dock USB'sinden**. STM ile yalnız
TX/RX/GND.

### 2.3 esp_camera config

`include/config.h`:
```c
#define CAM_PIN_PWDN       32
#define CAM_PIN_RESET      -1
#define CAM_PIN_XCLK        0
#define CAM_PIN_SIOD       26   // SCCB SDA
#define CAM_PIN_SIOC       27   // SCCB SCL
#define CAM_PIN_D7         35
#define CAM_PIN_D6         34
#define CAM_PIN_D5         39
#define CAM_PIN_D4         36
#define CAM_PIN_D3         21
#define CAM_PIN_D2         19
#define CAM_PIN_D1         18
#define CAM_PIN_D0          5
#define CAM_PIN_VSYNC      25
#define CAM_PIN_HREF       23
#define CAM_PIN_PCLK       22
#define CAM_PIN_LED_FLASH   4
```

Init:
```c
camera_config_t cfg = {
    .pin_pwdn  = CAM_PIN_PWDN,
    .pin_reset = CAM_PIN_RESET,
    .pin_xclk  = CAM_PIN_XCLK,
    .pin_sccb_sda = CAM_PIN_SIOD,
    .pin_sccb_scl = CAM_PIN_SIOC,
    /* ... data pins ... */
    .xclk_freq_hz = 20000000,           // XCLK = 20 MHz
    .ledc_timer   = LEDC_TIMER_0,
    .ledc_channel = LEDC_CHANNEL_0,
    .pixel_format = PIXFORMAT_JPEG,
    .frame_size   = FRAMESIZE_VGA,      // 640×480
    .jpeg_quality = 12,                 // 0..63, küçük = daha kaliteli, daha büyük dosya
    .fb_count     = 2,                  // double buffer
    .fb_location  = CAMERA_FB_IN_PSRAM,
    .grab_mode    = CAMERA_GRAB_LATEST,
};
esp_camera_init(&cfg);
```

JPEG quality 12 → tipik 25-40 KB per frame (640×480). 10 frame burst
= 250-400 KB toplam.

### 2.4 Burst akışı

```cpp
void run_burst() {
    digitalWrite(CAM_PIN_LED_FLASH, HIGH);
    char sid[37]; gen_uuid_v4(sid);  // X-Session-Id
    bool got_final = false;
    JsonDocument doc;
    const int N = BURST_FRAME_COUNT;  // 10
    const int interval_ms = 1000 / BURST_FPS;  // 200 ms
    uint32_t t0 = millis();

    for (int i = 1; i <= N; ++i) {
        uint32_t target = t0 + (i-1) * interval_ms;
        while ((int32_t)(millis() - target) < 0) { delay(1); }

        camera_fb_t *fb = esp_camera_fb_get();
        if (!fb) { send_err("fb_get"); digitalWrite(CAM_PIN_LED_FLASH, LOW); return; }

        HTTPClient http;
        http.begin(SERVER_URL);  // http://18.192.45.175:8000/search
        http.addHeader("X-Session-Id", sid);
        http.addHeader("X-Frame-Index", String(i));
        http.addHeader("X-Frame-Total", String(N));
        http.addHeader("Content-Type", "application/octet-stream");
        int code = http.POST((uint8_t*)fb->buf, fb->len);
        esp_camera_fb_return(fb);

        if (code != 200) { send_err("http_" + String(code)); break; }

        if (i == N) {  // son frame, agregasyon dönüyor
            String body = http.getString();
            DeserializationError e = deserializeJson(doc, body);
            if (e) { send_err("json_parse"); break; }
            got_final = true;
        }
        http.end();
    }
    digitalWrite(CAM_PIN_LED_FLASH, LOW);

    if (got_final) {
        bool match = doc["match"];
        const char *name = doc["name"] | "";
        float sim = doc["similarity"] | 0.0f;
        char line[96];
        snprintf(line, sizeof line, "RESULT:%d;%s;%.2f\n",
                 match ? 1 : 0, name, sim);
        Serial2.print(line);  // STM USART6 RX'ine
    }
}
```

`HardwareSerial Serial2(2)` ESP UART2 üzerinde:
- TX = IO14, RX = IO13
- `Serial2.begin(115200, SERIAL_8N1, /*rx=*/13, /*tx=*/14)`

### 2.5 NimBLE-Arduino BLE peripheral

```cpp
#include <NimBLEDevice.h>

static NimBLECharacteristic *gChar = nullptr;

void ble_setup() {
    NimBLEDevice::init("TaxiGuard");
    NimBLEDevice::setMTU(247);                    // varsayilan 23
    NimBLEServer *srv  = NimBLEDevice::createServer();
    NimBLEService *svc = srv->createService(NimBLEUUID("FFE0"));
    gChar = svc->createCharacteristic(
        NimBLEUUID("FFE1"),
        NIMBLE_PROPERTY::READ |
        NIMBLE_PROPERTY::WRITE |
        NIMBLE_PROPERTY::NOTIFY);
    svc->start();
    NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
    adv->addServiceUUID(svc->getUUID());
    adv->start();
}

void ble_notify(const char *line) {
    if (!gChar || !gChar->getSubscribedCount()) return;
    gChar->setValue((uint8_t*)line, strlen(line));
    gChar->notify();
}
```

**MTU 247 neden:** Bluetooth ATT protocol default MTU = 23 byte.
ATT_HANDLE_VALUE_NOTIFICATION paketinde 3 byte header (opcode + handle)
düşülünce payload = 20 byte. `MATCH:Gokturk;0.66\n` ASCII'de 19 byte
(düz ASCII), Türkçe karakterli isimde 20'yi geçiyor. 20 byte sınırı
geçtiğinde mesaj kesilip 2 ATT paketine bölünüyor, iPhone parser'ı
hem "MATCH:Gokturk;0." hem ".66\n" görüyor, ikincisi `MATCH:`
prefix'siz olduğu için yutuyor, similarity %0 görünüyor. MTU 247 →
ATT exchange ile karşılıklı negotiate edilir, max payload 244 byte.

### 2.6 STM'den gelen mesajları BLE'ye forward

ESP loop'unda `Serial2.available()` her tick kontrol edilir, satır
sonlu okuma yapar:

```cpp
static char rx_line[128];
static size_t rx_len = 0;

void poll_stm_uart() {
    while (Serial2.available()) {
        char c = (char)Serial2.read();
        if (rx_len < sizeof rx_line - 1) rx_line[rx_len++] = c;
        if (c == '\n') {
            rx_line[rx_len] = '\0';
            // STM "CAPTURE\n" mı? burst başlat:
            if (strncmp(rx_line, "CAPTURE", 7) == 0) run_burst();
            else ble_notify(rx_line);  // telefon-yön
            rx_len = 0;
        }
    }
}
```

---

## 3. Sunucu — Flask + InsightFace + SQLite Auth

### 3.1 Yığın

```
Container:    Docker (Linux amd64)
Image:        python:3.11-slim base + insightface
Process mgr:  gunicorn 21+, sync worker, -w 1
WSGI app:     Flask 3.0
Inference:    InsightFace 0.7 + ONNX Runtime CPU 1.16
Vision util:  OpenCV 4.8 headless
DB (yüz):     pickle (binary), L2-normalized float32[512]
DB (kullanıcı): SQLite (stdlib), users.db
Disk:         /app/data volume mount (host: /home/ec2-user/data/)
Host:         AWS EC2 m7i-flex.large, 2 vCPU / 8 GB RAM
Region:       eu-central-1b
Public IP:    18.192.45.175:8000 (HTTP, plaintext)
```

### 3.2 `-w 1` zorunluluğu

Flask uygulamasında session state in-memory:

```python
_sessions: dict[str, dict] = {}   # session_id -> {created, faces[]}
_lock = Lock()
```

Gunicorn worker = ayrı Linux process. 2+ worker olursa OS arası round-robin
ile request dağıtılır:

```
frame 1 → worker A → session A._sessions[sid] = {faces:[e1]}
frame 2 → worker B → session B._sessions[sid] = {faces:[e2]}
frame 3 → worker A → session A._sessions[sid]["faces"] = [e1, e3]
...
frame 10 → worker B → final agregasyon: _sessions[sid] = {faces:[e2, e4, ...]}
                       → centroid yarım embedding setiyle hesaplanır
                       → MATCH/NOMATCH yanlış
```

Shared state için ayrı bir Redis veya Memcached gerekirdi. Demo
seviyesi için fazla. `gunicorn -w 1` ile tek process zorunlu.

### 3.3 InsightFace `buffalo_l` paketi

```python
from insightface.app import FaceAnalysis
self._app = FaceAnalysis(name="buffalo_l",
                          providers=["CPUExecutionProvider"])
self._app.prepare(ctx_id=-1, det_size=(640, 640))
```

İçinde:
- **det_10g.onnx** — RetinaFace + Feature Pyramid Network, 10 GFLOPs.
  Çıktı: bbox + 5 keypoint (gözler, burun, ağız köşeleri) + det_score.
- **w600k_r50.onnx** — değil. `buffalo_l` paketi **glintr100.onnx**
  içerir, ArcFace-R100 backbone (ResNet-100), Glint360K üzerinde
  trained. 512-D embedding.
- 2DFAN modeli (göz/yön analiz) opsiyonel, kullanmıyoruz.

**Embedding mantığı:**
1. RetinaFace yüz bbox'larını döner.
2. 5 keypoint ile 112×112 piksel align (affine warp).
3. ArcFace forward pass → 512-D float32 vektör.
4. **L2 normalize:** `e = e / ‖e‖₂` (norm = 1 yapar).

ArcFace loss eğitimde: cos(θ + m) yerine cos(θ), `m = 0.5` angular
margin. Bu sayede aynı kişi yakın açıda, farklı kişiler uzak açıda
yer alır. Çıkartım anında **kosinüs benzerliği = iç çarpım** (çünkü
norm 1):

```
sim(a, b) = a · b = Σ aᵢ × bᵢ
```

İki normalize embedding için sim ∈ [-1, 1]. Aynı kişi tipik 0.5-0.9,
farklı kişi 0.0-0.3.

### 3.4 Kalite filtresi (recognition.py)

Per-frame elek:

```python
MIN_DET_SCORE = 0.7
MIN_FACE_AREA = 80 * 80   # piksel
MAX_YAW_DEG   = 30
MIN_BLUR      = 10        # ESP-CAM küçük lens VGA için indirildi (50→10)

def is_quality(face):
    if face["det_score"] < MIN_DET_SCORE: return False
    (x1,y1,x2,y2) = face["bbox"]
    if (x2-x1)*(y2-y1) < MIN_FACE_AREA: return False
    if abs(face["yaw"]) > MAX_YAW_DEG: return False
    if face["blur"] < MIN_BLUR: return False
    return True
```

- **det_score**: RetinaFace güven skoru (sigmoid).
- **bbox area**: küçük yüz = uzak = düşük çözünürlük = embedding zayıf.
- **yaw**: 3D yüz pozu, kpts'ten basit nokta-iç çarpım ile hesaplanır.
- **blur**: `cv2.Laplacian(gray, cv2.CV_64F).var()`. Laplacian
  varyansı yüksek = keskin kenar = keskin görüntü. ESP-CAM VGA
  kamerada normal aralık 15-40, ofis stüdyosunda 80+. Eşik 10 düşük
  tutuldu çünkü 50 hep eliyordu.

### 3.5 Multi-frame agregasyon (`/search` son frame)

```python
embeddings = np.stack([f["embedding"] for f in faces], axis=0)  # (N, 512)
centroid   = embeddings.mean(axis=0)                            # (512,)

# Cross-frame std → liveness
liveness = float(np.std(embeddings, axis=0).mean())             # skalar

matched, name, sim = db.match(centroid, threshold=THRESHOLD)    # THRESHOLD=0.4
```

`db.match`:

```python
def match(self, embedding, threshold=0.4):
    emb = embedding.astype(np.float32)
    emb = emb / max(np.linalg.norm(emb), 1e-9)
    best_name = ""
    best_sim  = -1.0
    for name, db_emb in self.entries:   # db_emb zaten normalize
        sim = float(np.dot(emb, db_emb))
        if sim > best_sim:
            best_sim = sim
            best_name = name
    return best_sim >= threshold, best_name, best_sim
```

DB lineer arama: N kişi → N kosinüs çarpımı. Embedding 512-D float32,
her dot product 512 mul + 511 add = ~1000 FLOP. N=1000 için 1 ms.
FAISS gibi indeks gerekmez sergi ölçeği için.

### 3.6 Endpoint detay (`/search`)

`app.py`:

```python
@app.before_request
def _auth_gate():
    if not SHARED_SECRET: return None
    if request.path != "/search": return None
    if request.headers.get("X-Shared-Secret","").strip() != SHARED_SECRET:
        return jsonify({"error":"unauthorized"}), 401
    return None

@app.route("/search", methods=["POST"])
def search():
    sid = request.headers["X-Session-Id"]
    idx = int(request.headers["X-Frame-Index"])
    total = int(request.headers["X-Frame-Total"])
    jpeg = request.get_data()

    face = recognizer.best_face(jpeg)
    quality_ok = bool(face and recognizer.is_quality(face))

    with _lock:
        s = _sessions.setdefault(sid, {"created":time.time(), "faces":[]})
        if quality_ok: s["faces"].append(face)

    if idx < total:
        return jsonify({"status":"continue", "frames_received":idx,
                        "frames_total":total, "quality_ok_this_frame":quality_ok})

    # son frame: pop + aggregate
    with _lock:
        s = _sessions.pop(sid, None)
    if not s: return jsonify({"error":"session_lost"}), 500

    if len(s["faces"]) < MIN_QUALITY_FRAMES:
        return jsonify({"match": False, "reason":"insufficient_quality_frames",
                        "frames_used": len(s["faces"]), "frames_total": total})

    embs = np.stack([f["embedding"] for f in s["faces"]], axis=0)
    c    = embs.mean(axis=0)
    live = float(np.std(embs, axis=0).mean())
    matched, name, sim = db.match(c, threshold=THRESHOLD)
    return jsonify({"match": bool(matched), "name": name if matched else "",
                    "similarity": round(sim, 4),
                    "frames_used": len(s["faces"]), "frames_total": total,
                    "liveness_score": round(live, 6)})
```

Session timeout cleanup `before_request` öncesi `_cleanup_sessions()` —
30 saniyeden eski sid'ler silinir (ESP brown-out olursa yarım session
çöp kalmaz).

### 3.7 Auth blueprint (auth.py)

```python
from flask import Blueprint
from werkzeug.security import generate_password_hash, check_password_hash
import secrets, sqlite3

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")
PLATE_RE = re.compile(r"^\d{2}\s?[A-Z]{1,3}\s?\d{2,4}$")
USERS_DB_PATH = os.path.join(os.path.dirname(DB_PATH), "users.db")

def _init_db():
    with sqlite3.connect(USERS_DB_PATH) as con:
        con.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                username       TEXT PRIMARY KEY,
                password_hash  TEXT NOT NULL,
                plate          TEXT NOT NULL,
                created_at     REAL NOT NULL DEFAULT (strftime('%s','now'))
            );
            CREATE TABLE IF NOT EXISTS tokens (
                token       TEXT PRIMARY KEY,
                username    TEXT NOT NULL,
                created_at  REAL NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
            );
        """)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    plate = re.sub(r"\s+", " ", (data.get("plate") or "").strip().upper())
    if len(username) < 3 or len(username) > 32:
        return jsonify({"error":"bad_username","message":"3-32 karakter"}), 400
    if len(password) < 6:
        return jsonify({"error":"bad_password","message":"≥ 6"}), 400
    if not PLATE_RE.match(plate):
        return jsonify({"error":"bad_plate","message":"34 ABC 1234"}), 400
    pwd_hash = generate_password_hash(password)
    try:
        with sqlite3.connect(USERS_DB_PATH) as con:
            con.execute("INSERT INTO users(username,password_hash,plate) VALUES(?,?,?)",
                        (username, pwd_hash, plate))
    except sqlite3.IntegrityError:
        return jsonify({"error":"username_taken"}), 409
    token = secrets.token_urlsafe(32)   # 43 char base64url, ~256 bit entropy
    with sqlite3.connect(USERS_DB_PATH) as con:
        con.execute("INSERT INTO tokens(token,username) VALUES(?,?)", (token, username))
    return jsonify({"token":token, "username":username, "plate":plate}), 201
```

- `generate_password_hash` varsayılan **PBKDF2-SHA256, 600 000
  iterasyon, 16 byte tuz**. Format `pbkdf2:sha256:600000$<salt>$<hash_hex>`.
- `secrets.token_urlsafe(32)` → 32 random byte → 43 karakter URL-safe
  base64. Entropy = 256 bit (kriptografik random).
- Token expiry yok; çıkış'ta `DELETE FROM tokens WHERE token=?`.

### 3.8 Dockerfile katmanları

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# buffalo_l ~120 MB; ilk request gecikmesin diye build sırasında indir
RUN python -c "from insightface.app import FaceAnalysis; \
    app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider']); \
    app.prepare(ctx_id=-1, det_size=(640,640))"
COPY app.py recognition.py db.py enroll.py auth.py ./
ENV PORT=8000 DB_PATH=/app/data/embeddings.pkl
EXPOSE 8000
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8000", "app:app", "--timeout", "60"]
```

Image boyutu ~2.4 GB (insightface + onnxruntime + opencv + buffalo_l).
Build süresi ~3 dakika tek seferlik, sonraki rebuild'lerde sadece
COPY layer'ları değişir → ~30 saniye.

Volume mount: `-v /home/ec2-user/data:/app/data`. `embeddings.pkl` ve
`users.db` host'ta kalıcı.

---

## 4. iPhone Uygulaması — SwiftUI + CoreBluetooth

### 4.1 Stack

- iOS 17.0 minimum (Xcode 15+).
- Swift 5.9, SwiftUI native, `@Observable` macro (iOS 17 yeni state
  management).
- CoreBluetooth central role.
- Keychain Services (Security framework) for token storage.
- URLSession async/await for `/auth` REST.

XcodeGen ile `project.yml`'den `.xcodeproj` üretiliyor — diff'i
versiyon kontrolde tutmak için.

### 4.2 Dosya yapısı (13 swift)

```
TaksiGuvenlik/
├── TaksiGuvenlikApp.swift     // @main App, AppState + AuthManager + BLEManager
├── AppState.swift             // @Observable: ble state, fsm state, log
├── Constants.swift            // baseURL, plate regex
├── AppTheme.swift             // colors + AuthField reusable
├── KeychainStore.swift        // get/set/delete by key
├── AuthManager.swift          // @Observable, async REST + Keychain cache
├── BLEManager.swift           // CBCentralManagerDelegate + CBPeripheralDelegate
├── RootView.swift             // switch on auth.status
├── LoginView.swift            // username + password form
├── RegisterView.swift         // + plate, live regex validation
├── HomeView.swift             // TabView
├── DashboardView.swift        // greeting + status card
├── ScanView.swift             // live FSM state card
└── ProfileView.swift          // user info + logout
```

### 4.3 CoreBluetooth (BLEManager.swift)

```swift
@MainActor
final class BLEManager: NSObject, ObservableObject {
    static let serviceUUID  = CBUUID(string: "FFE0")
    static let charUUID     = CBUUID(string: "FFE1")
    static let targetName   = "TaxiGuard"
    static let emergencyNumber = "05435207315"  // demo: "155"

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var rxBuffer = ""
    weak var appState: AppState?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)
    }
}

extension BLEManager: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn { central.scanForPeripherals(withServices: nil) }
    }
    func centralManager(_ central: CBCentralManager,
                        didDiscover peripheral: CBPeripheral,
                        advertisementData: [String:Any], rssi RSSI: NSNumber) {
        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? ""
        guard name == Self.targetName else { return }
        central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        central.connect(peripheral, options: nil)
    }
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        appState?.bleConnected = true
        peripheral.discoverServices([Self.serviceUUID])
    }
    func centralManager(_ central: CBCentralManager,
                        didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        appState?.bleConnected = false
        self.peripheral = nil
        self.characteristic = nil
        central.scanForPeripherals(withServices: nil)
    }
}

extension BLEManager: CBPeripheralDelegate {
    func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
        p.services?.filter { $0.uuid == Self.serviceUUID }
                   .forEach { p.discoverCharacteristics([Self.charUUID], for: $0) }
    }
    func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor service: CBService,
                    error: Error?) {
        service.characteristics?
            .filter { $0.uuid == Self.charUUID }
            .forEach { p.setNotifyValue(true, for: $0) }
    }
    func peripheral(_ p: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic,
                    error: Error?) {
        guard let data = characteristic.value else { return }
        handleIncoming(data)   // append to rxBuffer, parse on \n
    }
}
```

**Parser:**

```swift
private func handleIncoming(_ raw: Data) {
    guard let chunk = String(data: raw, encoding: .utf8) else { return }
    rxBuffer.append(chunk)
    while let nl = rxBuffer.firstIndex(of: "\n") {
        let line = String(rxBuffer[..<nl])
                     .trimmingCharacters(in: .whitespacesAndNewlines)
        rxBuffer.removeSubrange(...nl)
        if !line.isEmpty { handleLine(line) }
    }
}

private func handleLine(_ line: String) {
    guard let state = appState else { return }
    state.append(line)
    if line == "HB" { state.lastHeartbeat = Date(); return }
    if line == "SCANNING" { state.currentState = "SCANNING"; return }
    if line.hasPrefix("MATCH:") {
        let body = String(line.dropFirst("MATCH:".count))
        let comps = body.components(separatedBy: ";")   // split değil — trailing empty korunsun
        state.matchName = comps.first?.trimming(...) ?? "?"
        state.matchSimilarity = (comps.count > 1) ? (Double(comps[1].trim) ?? 0.0) : 0.0
        state.currentState = "MATCH"
        placeEmergencyCall()
    }
    /* NOMATCH / PANIC / NETERR benzer */
}

private func placeEmergencyCall() {
    guard let url = URL(string: "tel://\(Self.emergencyNumber)") else { return }
    UIApplication.shared.open(url)
}
```

**`.components(separatedBy:)` vs `.split(separator:)`:** Swift `split`
default `omittingEmptySubsequences=true` ile trailing boş parça yutar.
`MATCH:Gokturk;` (similarity yarım kesilmiş) split ile `["Gokturk"]`
döner → parser similarity 0.0 atayıp MATCH'i geçer. components ile
`["Gokturk", ""]` → comps.count > 1 ama comps[1] boş → similarity 0.0,
ama bu sefer defansif olarak detect edilir. MTU 247 fix BLE'de
truncation'ı zaten engelliyor ama parser defansif kalsın.

### 4.4 Keychain wrapper

```swift
enum KeychainStore {
    private static let service = "com.gokturk.taksiguvenlik"

    static func set(_ value: String, for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
        var attrs = query
        attrs[kSecValueData as String] = Data(value.utf8)
        SecItemAdd(attrs as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
```

`kSecClassGenericPassword` ile kimlik bilgisi saklama. `kSecAttrAccessible`
default `kSecAttrAccessibleWhenUnlocked` — telefon kilitliyken erişim
yok, biometri gerek değil ama kilitten sonra eldedeki Mac iCloud'da
backup yapılsa data kopyalanmaz (TrustedItem değil ama policy default
yeterli).

### 4.5 AuthManager (REST + Keychain bootstrap)

```swift
@MainActor @Observable
final class AuthManager {
    enum Status: Equatable {
        case checking
        case loggedOut
        case loggedIn(username: String, plate: String)
    }
    var status: Status = .checking
    var inFlight: Bool = false
    var errorMessage: String? = nil

    private let baseURL = Constants.serverBaseURL  // http://18.192.45.175:8000
    private let session = URLSession.shared

    private var token: String? { KeychainStore.get("token") }

    func bootstrap() async {
        guard let _ = token,
              let u = KeychainStore.get("username"),
              let p = KeychainStore.get("plate") else {
            status = .loggedOut; return
        }
        status = .loggedIn(username: u, plate: p)
        // arka planda doğrula; network hatasında offline kalsın
        if await !verifyToken() {
            KeychainStore.delete("token"); KeychainStore.delete("username"); KeychainStore.delete("plate")
            status = .loggedOut
        }
    }

    private func verifyToken() async -> Bool {
        guard let token = token else { return false }
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/me"))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 5
        do {
            let (_, resp) = try await session.data(for: req)
            return (resp as? HTTPURLResponse)?.statusCode != 401
        } catch { return true }   // network sorununda token'ı sil/atma
    }

    func login(username: String, password: String) async { /* POST /auth/login */ }
    func register(username: String, password: String, plate: String) async { /* POST /auth/register */ }
    func logout() async { /* POST /auth/logout + Keychain temizle */ }
}
```

`@Observable` macro (Swift 5.9+) — eski `@Published` / `ObservableObject`
patternına gerek yok, otomatik change tracking. View'lar
`@Environment(AuthManager.self)` ile alır.

### 4.6 Info.plist

```xml
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-central</string>          <!-- arka planda BLE notify -->
</array>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>ESP32-CAM ile BLE</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>GATT yazma izni</string>
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>tel</string>                        <!-- tel:// URL aç -->
</array>
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>                                     <!-- demo HTTP backend -->
</dict>
```

`bluetooth-central` background mode → uygulama backgrounda inse de
notify alır. ATS bypass demo HTTP için, Faz 2 HTTPS'e geçince
kaldırılacak.

### 4.7 tel:// URL şeması

`UIApplication.shared.open(URL(string: "tel://05435207315")!)` →
iOS dialer ekranı, numara yüklü hâlinde açılır. Sürücü yeşil tuşa
**tek dokunur**, arama başlar. iOS sandbox tam-otomatik arama
yapmaya **izin vermiyor** — Apple [URL Scheme Reference][1]: "The
URL scheme launches the Phone app and dials the number, after a
user confirmation prompt."

CallKit ile uygulamayı bir telefon hattı olarak kaydettirmek de
mümkün (`CXProvider`, `CXCallController`), ama bu **gelen çağrı**
hattı içindir, dışa otomatik arama vermez. Reddedildi.

[1]: https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html

---

## 5. Veri yapıları ve protokoller

### 5.1 HTTP `/search` istek

```
POST /search HTTP/1.1
Host: 18.192.45.175:8000
Content-Type: application/octet-stream
Content-Length: 28412
X-Session-Id: 7c5f9a3b-2e94-4a7f-9b6e-1d3c0a8f5e21
X-Frame-Index: 7
X-Frame-Total: 10
X-Shared-Secret: <opsiyonel, Faz 2'de zorunlu>

<JPEG bytes ~25-40 KB>
```

Ara kare yanıtı (`idx < total`):

```json
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 92

{"status":"continue","frames_received":7,"frames_total":10,"quality_ok_this_frame":true}
```

Son kare yanıtı (`idx == total`):

```json
{"match":true,"name":"Gokturk","similarity":0.6612,
 "frames_used":9,"frames_total":10,"liveness_score":0.014823}
```

Hata yanıtları (`400`, `401`, `500`): EkA tablosunda tam liste.

### 5.2 HTTP `/auth/register` istek

```
POST /auth/register HTTP/1.1
Host: 18.192.45.175:8000
Content-Type: application/json

{"username":"gokturk","password":"hunter2!","plate":"34 ABC 1234"}
```

Yanıt 201:
```json
{"token":"IZwD_4xUBLQ90W1E8shqYNZqus13YxI--8xcc6_k-4Q",
 "username":"gokturk", "plate":"34 ABC 1234"}
```

Diğer endpoint'ler: `/auth/login` body aynı (plaka yok), `/auth/me`
GET + `Authorization: Bearer <token>`, `/auth/logout` POST + bearer.

### 5.3 UART (STM ↔ ESP) frame özeti

ASCII text, `\n` delimiter, max line ≈ 64 byte. CRC/checksum yok
(ortam noise'i düşük, kısa mesaj, kayıp olunca STM heartbeat'e
güvenir). Türkçe karakterler isimlerde UTF-8 multi-byte olabilir
ama parser byte-by-byte newline arar.

### 5.4 BLE GATT

- Service UUID: `0000ffe0-0000-1000-8000-00805f9b34fb`
- Characteristic UUID: `0000ffe1-0000-1000-8000-00805f9b34fb`
- Properties: READ + WRITE + NOTIFY (+ CCCD descriptor for notify enable)
- MTU: 247 byte ATT exchange ile negotiate
- Connection interval: 30-50 ms (NimBLE default, iOS minimum 15 ms)

Notify payload düz ASCII text, ESP'nin Serial2'den aldığı satırla
birebir aynı.

---

## 6. Eval — FAR/FRR ölçüm aracı

`face-mac/eval/far_frr.py`:

```python
# Veri seti yapısı:
#   dataset/
#     Gokturk/photo1.jpg ... photoK.jpg     # gallery + genuine probe
#     Ekin/...
#     impostor/random_name_1/photo.jpg      # gallery'de olmayan probes

# 1) Gallery enroll: her klasörden ilk fotoğraf enroll edilir (bulk_enroll.py)
# 2) Genuine probe: aynı klasördeki diğer fotoğraflar /search burst olarak gönderilir
# 3) Impostor probe: impostor/ klasöründeki fotoğraflar gönderilir
# 4) Her probe için (sim, gerçek_kişi, predicted_kişi) → CSV
# 5) Eşik τ ∈ [0, 1] üzerinde 0.01 adım sweep:
#       FAR = FP / (FP + TN)        # gallery'de olmayan, MATCH dönen
#       FRR = FN / (FN + TP)        # gallery'de olan, NOMATCH dönen
# 6) EER bul: |FAR - FRR| en küçük olduğu τ
# 7) Operating point (FAR ≤ 0.01): FRR'yi minimize eden τ
# 8) Matplotlib varsa roc.png üret
```

Çıktı dosyaları: `<run>.csv`, `<run>_sweep.csv`, `<run>_summary.json`,
`<run>_roc.png`. Tez Bölüm 5 tablolarına doğrudan kaynak.

Sahte burst: tek JPEG dosyasını 10 kez aynı session_id ile POST eder.
Gerçek 10-frame burst'ün simülasyonu (canlılık skoru sıfır olur ama
o ayrı test).

---

## 7. Bilinen tavizler / yapılacaklar

### Demo öncesi mutlaka

- `iphone-app/TaksiGuvenlik/BLEManager.swift:27`:
  `emergencyNumber = "05435207315"` → `"155"`.
- ESP-CAM `config.h` Wi-Fi SSID hardcoded `"GG"` / şifre `"GGocen2690"`.
  Sergi günü farklı hotspot kullanılacaksa flash gerekir.

### Faz 2 (üretim)

- EC2 önüne Caddy/nginx + Let's Encrypt → HTTPS.
- ESP `config.h` `USE_TLS=1` + ISRG Root X1 sertifika gömme.
- `SHARED_SECRET` zorunlu (ESP token taşır).
- Token expiry (örnek 30 gün) + refresh.
- iOS `Info.plist` ATS bypass kaldır.

### Test eksikleri

- BLE MTU 247 fix cihazda doğrulanmadı (push'lu commit `b68dded`).
- iPhone yeni auth UI Xcode'da ilk build yapılacak.
- 20-30 kişi enrollment + FAR/FRR ölçümü.
- Aydınlatma (100/300/600 lx) + mesafe (30-60/60-90/90-120 cm) testleri.
- Pasif liveness deneyi (canlı vs. ekran replay).

---

## 8. Tek satırlık özet, mühendis dilinde

> Cortex-M7 STM32 olay yöneticisi (HSI×PLL 216 MHz), Arduino D0/D1
> üzerinden 115 200 bps USART6 ile ESP32-CAM'e ASCII komut yolluyor.
> ESP32-CAM, OV3660 sensöründen 10 JPEG (5 FPS, VGA, quality 12)
> yakalayıp HTTP POST ile EC2'deki Flask + InsightFace buffalo_l
> servisine yolluyor. Sunucu RetinaFace ile yüz tespiti, ArcFace-R100
> ile 512-D embedding üretip kalite filtresinden geçenlerin centroid'i
> üzerinden cosine sim ≥ 0.40 ile MATCH/NOMATCH kararı veriyor. Sonuç
> JSON olarak ESP'ye dönüyor, ESP STM'e UART üzerinden iletiyor, STM
> kendi FSM'sinde MATCH durumuna geçince LED + buzzer açıp telefon-yön
> mesajı yine USART6'dan ESP'ye veriyor. ESP bunu NimBLE peripheral'ı
> üstünden FFE0/FFE1 GATT karakteristiğine MTU 247'lik bir notify
> olarak iPhone'a yolluyor. iPhone'daki SwiftUI uygulaması (kullanıcı
> SQLite tabanlı /auth ile login olmuş, oturum token'ı Keychain'de)
> notify'ı parse edip `tel://155` URL'sini açıyor, sürücü dialer'da
> tek dokunarak aramayı tamamlıyor.
