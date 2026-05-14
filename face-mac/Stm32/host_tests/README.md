# Host-side STM32 State Machine Tests

Bu klasör, `face-mac/stm32/taxi_guvenlik/Core/Src/state_machine.c` modülünü
host PC'de (gcc / clang ile) derleyip çalıştırır. STM32 donanımı olmadan,
state machine'in tüm geçişlerini birkaç saniyede test edebilirsin.

## Çalıştırma

```bash
cd face-mac/stm32/host_tests
make run
```

Beklenen çıktı:

```
== state_machine host tests ==

[RUN ] test_initial_state_is_idle_with_green_led
[ OK ] test_initial_state_is_idle_with_green_led
...
== 12 run, 0 failed ==
```

## Modülün embedded tarafa entegrasyonu

`state_machine.h` ve `state_machine.c` zaten CubeIDE projesinin
`Core/Inc` ve `Core/Src` klasörlerinde — CubeIDE bunları otomatik fark
eder. Sadece `main.c` içinde aşağıdaki iskeleti kur:

```c
#include "state_machine.h"

/* USER CODE BEGIN PV */
static volatile uint8_t tara_pressed;
static volatile uint8_t panic_pressed;
/* USER CODE END PV */

static void on_set_led(sm_led_t led, bool on) {
    GPIO_PinState s = on ? GPIO_PIN_SET : GPIO_PIN_RESET;
    switch (led) {
        case SM_LED_GREEN: HAL_GPIO_WritePin(LED_GREEN_GPIO_Port, LED_GREEN_Pin, s); break;
        case SM_LED_AMBER: HAL_GPIO_WritePin(LED_AMBER_GPIO_Port, LED_AMBER_Pin, s); break;
        case SM_LED_RED:   HAL_GPIO_WritePin(LED_RED_GPIO_Port,   LED_RED_Pin,   s); break;
        default: break;
    }
}
static void on_set_buzzer(bool on) {
    HAL_GPIO_WritePin(BUZZER_GPIO_Port, BUZZER_Pin,
                      on ? GPIO_PIN_SET : GPIO_PIN_RESET);
}
static void on_uart1_tx(const char *line) {
    HAL_UART_Transmit(&huart1, (uint8_t *)line, strlen(line), 100);
}
static void on_uart2_tx(const char *line) {
    HAL_UART_Transmit(&huart2, (uint8_t *)line, strlen(line), 100);
}
static uint32_t on_now(void) { return HAL_GetTick(); }

void HAL_GPIO_EXTI_Callback(uint16_t pin) {
    if (pin == TARA_BUTTON_Pin)  tara_pressed  = 1;
    if (pin == PANIC_BUTTON_Pin) panic_pressed = 1;
}

int main(void) {
    /* ... HAL init from CubeMX ... */
    static const sm_callbacks_t cb = {
        .set_led = on_set_led, .set_buzzer = on_set_buzzer,
        .send_to_esp = on_uart1_tx, .send_to_hm10 = on_uart2_tx,
        .now_ms = on_now,
    };
    sm_init(&cb);

    uint32_t last_tick = 0;
    while (1) {
        if (tara_pressed)  { tara_pressed  = 0; sm_handle_event(SM_EV_TARA_PRESS,  NULL); }
        if (panic_pressed) { panic_pressed = 0; sm_handle_event(SM_EV_PANIC_PRESS, NULL); }

        /* UART1 RX'ten gelen RESULT satırlarını parse et ve event olarak besle. */
        char line[64];
        if (uart1_pop_line(line, sizeof line)) {
            sm_payload_t p = { 0 };
            if (strncmp(line, "1;", 2) == 0) {
                /* "1;Ali_Yilmaz;0.94" */
                char *name = line + 2;
                char *semi = strchr(name, ';');
                if (semi) {
                    *semi = '\0';
                    p.match_name = name;
                    p.match_similarity = (float)atof(semi + 1);
                    sm_handle_event(SM_EV_ESP_MATCH, &p);
                }
            } else if (strncmp(line, "0;", 2) == 0) {
                sm_handle_event(SM_EV_ESP_NOMATCH, NULL);
            } else if (strncmp(line, "ERR:", 4) == 0) {
                p.error_reason = line + 4;
                sm_handle_event(SM_EV_ESP_ERROR, &p);
            }
        }

        if (HAL_GetTick() - last_tick >= 100) {
            sm_tick();
            last_tick = HAL_GetTick();
        }
    }
}
```

CubeMX `.ioc` dosyasında pin etiketlerini şunlara çek:

```
LED_GREEN  → PB0    (LD1)
LED_AMBER  → PD12   (harici amber)
LED_RED    → PB14   (LD3)
BUZZER     → PD13   (harici aktif buzzer)
TARA_BUTTON  → PC13  (B1 USER)
PANIC_BUTTON → PA0   (harici panik buton, EXTI)
huart1       → UART1, PA9/PA10, 115200 8N1
huart2       → UART2, PD5/PD6,  9600  8N1
```

Bu eşleme yapıldıktan sonra `state_machine.c` ve `.h` zaten yerinde
olduğu için tek değişiklik `main.c` içine yukarıdaki callback bloğu.

## Kapsam

| Test                                       | Doğrulanan                                          |
| ------------------------------------------ | --------------------------------------------------- |
| `initial_state_is_idle_with_green_led`     | Başlangıçta IDLE + yeşil LED yanık                   |
| `tara_press_starts_scan_and_sends_capture` | TARA → SCANNING geçişi + CAPTURE UART komutu        |
| `esp_match_drives_red_and_buzzer_and_dial_frame` | MATCH'te kırmızı LED + buzzer + HM-10 frame   |
| `esp_nomatch_path`                         | NOMATCH yolunda yeşil LED + HM-10 NOMATCH           |
| `scan_timeout_yields_neterr`               | 15 s scan timeout → NETERR                          |
| `panic_always_armed_even_in_scan`          | SCANNING içinde bile PANIK butonu çalışır          |
| `hold_window_returns_to_idle`              | NOMATCH bekleme süresi sonunda IDLE'a dönüş         |
| `heartbeat_emitted_while_idle`             | IDLE'da 5 s'de bir HB frame'i                       |
| `tara_during_hold_restarts_scan`           | Tetik tekrarı; bekleme penceresi kesilebiliyor      |
| `late_esp_result_is_ignored_after_timeout` | Geç gelen RESULT göz ardı edilir                    |
| `neterr_blinks_amber`                      | NETERR sırasında amber blink                        |
| `long_name_truncated_safely`               | Aşırı uzun isim taşması yok, MATCH frame'i çıkıyor  |

## Geliştirme önerileri (donanım gelince)

- Gerçek UART1 RX parser'ı `state_machine.c`'nin dışında, ayrı bir
  `uart_line_reader` modülü olarak ekle. Şimdilik main.c içinde inline
  olarak gösterildi.
- DMA + ring buffer ile UART1 RX'i 921600 baud'da bile kaybetmeden topla.
- `sm_tick()` çağrısını ana döngüde değil, bir TIM IRQ veya FreeRTOS
  software timer üzerinde çağır (interrupt güvenli — modül blocking
  yapmıyor).
- Hata yönetimi için `SM_EV_ESP_ERROR` event'ini boş `payload` ile
  besleyebiliyorsun; payload'lı sürüm telemetri/loga reason etiketini
  geçirir.
