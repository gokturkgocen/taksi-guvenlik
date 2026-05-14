/**
 * @file    state_machine.h
 * @brief   Event-driven state machine for the STM32 taxi guard module.
 *
 * Pure C, zero HAL dependencies. Communication with the outside world
 * (LEDs, buzzer, UART1 to ESP32-CAM, UART2 to HM-10) happens through a
 * vtable of callbacks supplied at init time. This lets us:
 *
 *   - Drop the same .c file into the CubeIDE project (Core/Src) and the
 *     host-side test harness (face-mac/stm32/host_tests).
 *   - Unit-test every transition before touching real hardware.
 *
 * Usage on the embedded side:
 *
 *     static const sm_callbacks_t cb = {
 *         .set_led      = on_set_led,        // wraps HAL_GPIO_WritePin
 *         .set_buzzer   = on_set_buzzer,
 *         .send_to_esp  = on_uart1_tx,       // HAL_UART_Transmit on huart1
 *         .send_to_hm10 = on_uart2_tx,       // HAL_UART_Transmit on huart2
 *         .now_ms       = on_now_ms,         // HAL_GetTick
 *     };
 *     sm_init(&cb);
 *
 *     // IRQ context:
 *     sm_handle_event(SM_EV_TARA_PRESS, NULL);
 *
 *     // From a 100 ms timer:
 *     sm_tick();
 *
 * The state machine never blocks and never calls back into itself; every
 * effect is emitted through the callbacks and returns immediately.
 */
#ifndef STATE_MACHINE_H
#define STATE_MACHINE_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ---------------- States ---------------- */

typedef enum {
    SM_STATE_IDLE = 0,    /**< Waiting for TARA button. GREEN LED steady. */
    SM_STATE_SCANNING,    /**< CAPTURE sent to ESP, waiting for RESULT. AMBER LED. */
    SM_STATE_MATCH,       /**< Positive match received. RED LED + buzzer for hold window. */
    SM_STATE_NOMATCH,     /**< Negative result. Brief GREEN flash, then IDLE. */
    SM_STATE_PANIC,       /**< Driver pressed PANIC. RED + buzzer until hold expires. */
    SM_STATE_NETERR,      /**< Scan timed out / ESP transport error. AMBER blink. */
    SM_STATE__COUNT
} sm_state_t;

/* ---------------- Events ---------------- */

typedef enum {
    SM_EV_TARA_PRESS = 0, /**< User pressed the scan trigger. */
    SM_EV_PANIC_PRESS,    /**< User pressed the panic button. */
    SM_EV_ESP_MATCH,      /**< ESP delivered "1;<name>;<sim>". */
    SM_EV_ESP_NOMATCH,    /**< ESP delivered "0;;<sim>" or insufficient_quality. */
    SM_EV_ESP_ERROR,      /**< ESP delivered "ERR:..." or transport error. */
    SM_EV_TICK,           /**< Internal: timer pulse, drives timeouts. */
    SM_EV__COUNT
} sm_event_t;

/* Payload union — only the listed fields are inspected per event. */
typedef struct {
    /* For SM_EV_ESP_MATCH */
    const char *match_name;        /**< NUL-terminated, length ≤ SM_MAX_NAME_LEN. */
    float       match_similarity;  /**< Cosine sim in [0, 1]. */
    /* For SM_EV_ESP_ERROR */
    const char *error_reason;      /**< Short ASCII tag, e.g. "http_500". */
} sm_payload_t;

/* ---------------- Output (LED) channels ---------------- */

typedef enum {
    SM_LED_GREEN = 0,
    SM_LED_AMBER,
    SM_LED_RED,
    SM_LED__COUNT
} sm_led_t;

/* ---------------- Callback vtable ---------------- */

/**
 * I/O contract supplied by the host program. Every pointer must be
 * non-NULL. Inside `set_led` and `set_buzzer`, value is `true` for on and
 * `false` for off. `send_to_esp` and `send_to_hm10` get NUL-terminated
 * lines (already including the trailing '\n').
 *
 * `now_ms` must return a monotonically increasing millisecond counter; on
 * STM32 this maps directly to `HAL_GetTick()`. The host test substitutes a
 * fake clock.
 */
typedef struct {
    void     (*set_led)(sm_led_t led, bool on);
    void     (*set_buzzer)(bool on);
    void     (*send_to_esp)(const char *line);
    void     (*send_to_hm10)(const char *line);
    uint32_t (*now_ms)(void);
} sm_callbacks_t;

/* ---------------- Public API ---------------- */

/** Maximum name length we will accept from the ESP MATCH frame. */
#define SM_MAX_NAME_LEN 32

/** Time the SCANNING state will tolerate before declaring NETERR. */
#define SM_SCAN_TIMEOUT_MS    15000u
/** How long MATCH / NOMATCH / PANIC / NETERR linger before returning IDLE. */
#define SM_HOLD_MATCH_MS       5000u
#define SM_HOLD_NOMATCH_MS     2000u
#define SM_HOLD_PANIC_MS      10000u
#define SM_HOLD_NETERR_MS      3000u
/** Heartbeat emitted to HM-10 while IDLE. */
#define SM_HEARTBEAT_MS        5000u
/** AMBER blink period during NETERR. */
#define SM_NETERR_BLINK_MS      400u

/** Reset every counter and force IDLE. Safe to re-call. */
void sm_init(const sm_callbacks_t *callbacks);

/** Drop an event into the machine. NULL payload is accepted for events
 *  that do not carry data. */
void sm_handle_event(sm_event_t event, const sm_payload_t *payload);

/** Service timers. Call from a periodic source (e.g. 100 ms SysTick task,
 *  or a FreeRTOS software timer). */
void sm_tick(void);

/** Inspection — useful in tests and for debug telemetry. */
sm_state_t sm_current_state(void);

/** Human-readable name for logs. Returns a pointer to a static literal. */
const char *sm_state_name(sm_state_t state);

#ifdef __cplusplus
}
#endif

#endif /* STATE_MACHINE_H */
