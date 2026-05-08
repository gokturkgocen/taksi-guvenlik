#pragma once

// ───────────────────────── Wi-Fi ─────────────────────────
#define WIFI_SSID      "PHONE_HOTSPOT_SSID"
#define WIFI_PASSWORD  "phone_hotspot_password"

// ─────────────────────── Server URL ───────────────────────
// Phase 1 (Mac LAN, HTTP): "http://192.168.x.x:8000/search"
// Phase 2 (Cloud, HTTPS):  "https://taxi.your-domain.com/search"
#define SERVER_URL     "http://192.168.1.50:8000/search"

// 0 = HTTP (Phase 1, LAN), 1 = HTTPS (Phase 2, cloud)
#define USE_TLS        0

// ─────────────────────── UART (STM32) ─────────────────────
#define STM_UART_BAUD  921600
#define STM_RX_PIN     16
#define STM_TX_PIN     17

// ───────────────────── Burst protocol ─────────────────────
// STM captures BURST_FRAME_COUNT frames at BURST_FPS, sends each over UART
// as a TYPE_IMG frame. ESP forwards each to the server with session headers.
#define BURST_FRAME_COUNT 10

// ─────────────────────── Limits ───────────────────────────
#define MAX_FRAME_SIZE         (50 * 1024)
#define HTTP_TIMEOUT_MS        15000
#define UART_FRAME_TIMEOUT_MS  5000
#define BURST_GAP_TIMEOUT_MS   3000   // if no IMG within this window, reset session
