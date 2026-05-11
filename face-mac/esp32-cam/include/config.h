#pragma once

/* ───────────── Wi-Fi ───────────── */
#define WIFI_SSID       "GG"
#define WIFI_PASSWORD   "GGocen2690"

/* ───────────── Server ─────────── */
/* Phase 1 (Mac LAN over hotspot, HTTP): http://<server-ip>:8000/search
 * Phase 2 (Cloud, HTTPS): https://taxi.your-domain.com/search */
#define SERVER_URL      "http://18.192.45.175:8000/search"
#define USE_TLS         0

/* Optional shared-secret API key matching server's SHARED_SECRET env. Empty = off. */
#define SHARED_SECRET   ""

/* ───────────── Burst ──────────── */
#define BURST_FRAME_COUNT   10
#define BURST_FPS           5     /* frames per second during burst */
#define HTTP_TIMEOUT_MS     15000

/* ───────────── UART to STM32 ──── */
/* ESP32-CAM IO13 (TX) → STM32 USART1_RX (PA10)
 * ESP32-CAM IO14 (RX) ← STM32 USART1_TX (PA9)
 * 115200 8N1, ASCII line-oriented protocol.
 *
 * Both pins are bootstrap-safe (IO13 has no role at boot; IO14 idles HIGH
 * which matches UART idle state, satisfying any pullup expectation). */
#define STM_UART_NUM        2     /* Use HardwareSerial(2) */
#define STM_UART_BAUD       115200
#define STM_UART_TX_PIN     13
#define STM_UART_RX_PIN     14

/* ───────────── Camera (AI-Thinker ESP32-CAM pinout) ───────────── */
#define CAM_PIN_PWDN     32
#define CAM_PIN_RESET    -1
#define CAM_PIN_XCLK      0
#define CAM_PIN_SIOD     26
#define CAM_PIN_SIOC     27
#define CAM_PIN_D7       35
#define CAM_PIN_D6       34
#define CAM_PIN_D5       39
#define CAM_PIN_D4       36
#define CAM_PIN_D3       21
#define CAM_PIN_D2       19
#define CAM_PIN_D1       18
#define CAM_PIN_D0        5
#define CAM_PIN_VSYNC    25
#define CAM_PIN_HREF     23
#define CAM_PIN_PCLK     22

/* Onboard white flash LED for low-light capture. Bright — use briefly. */
#define CAM_PIN_LED_FLASH  4
