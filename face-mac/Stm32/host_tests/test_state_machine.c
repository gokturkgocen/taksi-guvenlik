/**
 * @file    test_state_machine.c
 * @brief   Host-side test for the STM32 state machine module.
 *
 * Compiles with plain gcc/clang against the same Core/Src/state_machine.c
 * the embedded build uses. A fake clock (`g_now_ms`) drives the timer
 * logic deterministically, and an effect-recording vtable captures every
 * LED / buzzer / UART call so we can assert on the exact sequence.
 *
 * Build & run:
 *     cd face-mac/stm32/host_tests && make
 *
 * No external test framework — a few macros below give us the readable
 * assertion failures we need, and keep the dependency surface at "a C
 * compiler".
 */
#include "../taxi_guvenlik/Core/Inc/state_machine.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* --------------- Test framework (vendored, ~30 LOC) ---------------- */

static int g_tests_run = 0;
static int g_tests_failed = 0;

#define RUN(test_fn)                                              \
    do {                                                          \
        printf("\n[RUN ] %s\n", #test_fn);                        \
        ++g_tests_run;                                            \
        int before = g_tests_failed;                              \
        test_fn();                                                \
        if (g_tests_failed == before) printf("[ OK ] %s\n", #test_fn); \
    } while (0)

#define FAIL(msg) do {                                            \
        printf("[FAIL] %s:%d  %s\n", __FILE__, __LINE__, msg);    \
        ++g_tests_failed;                                         \
    } while (0)

#define EXPECT(cond, msg) do { if (!(cond)) FAIL(msg); } while (0)

#define EXPECT_STATE(s)                                           \
    do {                                                          \
        sm_state_t cur = sm_current_state();                      \
        if (cur != (s)) {                                         \
            char buf[160];                                        \
            snprintf(buf, sizeof buf,                             \
                "state mismatch: got %s, want %s",                \
                sm_state_name(cur), sm_state_name(s));            \
            FAIL(buf);                                            \
        }                                                         \
    } while (0)

/* --------------- Effect recorder + fake clock ---------------------- */

typedef struct {
    bool leds[SM_LED__COUNT];
    bool buzzer;
    /* Rolling logs of outbound UART lines. */
    char esp_log[16][64];
    int  esp_n;
    char hm10_log[16][64];
    int  hm10_n;
} effects_t;

static effects_t g_eff;
static uint32_t  g_now_ms;

static void rec_set_led(sm_led_t led, bool on)  { g_eff.leds[led] = on; }
static void rec_set_buzzer(bool on)             { g_eff.buzzer = on; }
static void rec_send_to_esp(const char *line) {
    if (g_eff.esp_n < (int)(sizeof g_eff.esp_log / sizeof g_eff.esp_log[0])) {
        strncpy(g_eff.esp_log[g_eff.esp_n], line, sizeof g_eff.esp_log[0] - 1);
        g_eff.esp_log[g_eff.esp_n][sizeof g_eff.esp_log[0] - 1] = '\0';
        ++g_eff.esp_n;
    }
}
static void rec_send_to_hm10(const char *line) {
    if (g_eff.hm10_n < (int)(sizeof g_eff.hm10_log / sizeof g_eff.hm10_log[0])) {
        strncpy(g_eff.hm10_log[g_eff.hm10_n], line, sizeof g_eff.hm10_log[0] - 1);
        g_eff.hm10_log[g_eff.hm10_n][sizeof g_eff.hm10_log[0] - 1] = '\0';
        ++g_eff.hm10_n;
    }
}
static uint32_t rec_now(void) { return g_now_ms; }

static const sm_callbacks_t cb = {
    .set_led      = rec_set_led,
    .set_buzzer   = rec_set_buzzer,
    .send_to_esp  = rec_send_to_esp,
    .send_to_hm10 = rec_send_to_hm10,
    .now_ms       = rec_now,
};

static void reset_env(void)
{
    memset(&g_eff, 0, sizeof g_eff);
    g_now_ms = 1000; /* start late enough that uint subtraction stays safe. */
    sm_init(&cb);
}

static bool hm10_log_contains(const char *needle)
{
    for (int i = 0; i < g_eff.hm10_n; ++i) {
        if (strstr(g_eff.hm10_log[i], needle)) return true;
    }
    return false;
}

static bool esp_log_contains(const char *needle)
{
    for (int i = 0; i < g_eff.esp_n; ++i) {
        if (strstr(g_eff.esp_log[i], needle)) return true;
    }
    return false;
}

static void advance(uint32_t ms)
{
    /* Tick at 100 ms intervals so timer logic gets reasonable resolution. */
    const uint32_t step = 100;
    while (ms >= step) {
        g_now_ms += step;
        sm_tick();
        ms -= step;
    }
    if (ms > 0) {
        g_now_ms += ms;
        sm_tick();
    }
}

/* --------------- Tests --------------------------------------------- */

static void test_initial_state_is_idle_with_green_led(void)
{
    reset_env();
    EXPECT_STATE(SM_STATE_IDLE);
    EXPECT(g_eff.leds[SM_LED_GREEN], "GREEN LED should be on in IDLE");
    EXPECT(!g_eff.leds[SM_LED_AMBER], "AMBER LED should be off in IDLE");
    EXPECT(!g_eff.leds[SM_LED_RED],   "RED LED should be off in IDLE");
    EXPECT(!g_eff.buzzer,             "buzzer should be off in IDLE");
}

static void test_tara_press_starts_scan_and_sends_capture(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    EXPECT_STATE(SM_STATE_SCANNING);
    EXPECT(g_eff.leds[SM_LED_AMBER], "AMBER LED should be on in SCANNING");
    EXPECT(!g_eff.leds[SM_LED_GREEN], "GREEN LED should be off in SCANNING");
    EXPECT(esp_log_contains("CAPTURE"),
           "ESP should receive a CAPTURE command");
    EXPECT(hm10_log_contains("SCANNING"),
           "HM-10 should receive SCANNING notice");
}

static void test_esp_match_drives_red_and_buzzer_and_dial_frame(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    sm_payload_t p = {
        .match_name = "Ali_Yilmaz",
        .match_similarity = 0.93f,
    };
    sm_handle_event(SM_EV_ESP_MATCH, &p);

    EXPECT_STATE(SM_STATE_MATCH);
    EXPECT(g_eff.leds[SM_LED_RED], "RED LED on after MATCH");
    EXPECT(!g_eff.leds[SM_LED_AMBER], "AMBER LED off after MATCH");
    EXPECT(g_eff.buzzer, "buzzer on during MATCH");
    EXPECT(hm10_log_contains("MATCH:Ali_Yilmaz"),
           "HM-10 should receive MATCH frame with name");
    EXPECT(hm10_log_contains("0.930"),
           "HM-10 frame should carry similarity value");
}

static void test_esp_nomatch_path(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    sm_handle_event(SM_EV_ESP_NOMATCH, NULL);
    EXPECT_STATE(SM_STATE_NOMATCH);
    EXPECT(g_eff.leds[SM_LED_GREEN], "GREEN LED on in NOMATCH");
    EXPECT(!g_eff.buzzer, "buzzer off in NOMATCH");
    EXPECT(hm10_log_contains("NOMATCH"),
           "HM-10 should receive NOMATCH frame");
}

static void test_scan_timeout_yields_neterr(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    EXPECT_STATE(SM_STATE_SCANNING);
    /* Push past the 15 s scan timeout. */
    advance(SM_SCAN_TIMEOUT_MS + 200);
    EXPECT_STATE(SM_STATE_NETERR);
    EXPECT(hm10_log_contains("NETERR"), "HM-10 should receive NETERR frame");
}

static void test_panic_always_armed_even_in_scan(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    EXPECT_STATE(SM_STATE_SCANNING);
    sm_handle_event(SM_EV_PANIC_PRESS, NULL);
    EXPECT_STATE(SM_STATE_PANIC);
    EXPECT(g_eff.leds[SM_LED_RED], "RED LED on in PANIC");
    EXPECT(g_eff.buzzer, "buzzer on in PANIC");
    EXPECT(hm10_log_contains("PANIC"), "HM-10 should receive PANIC frame");
}

static void test_hold_window_returns_to_idle(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    sm_handle_event(SM_EV_ESP_NOMATCH, NULL);
    EXPECT_STATE(SM_STATE_NOMATCH);
    advance(SM_HOLD_NOMATCH_MS + 200);
    EXPECT_STATE(SM_STATE_IDLE);
}

static void test_heartbeat_emitted_while_idle(void)
{
    reset_env();
    EXPECT_STATE(SM_STATE_IDLE);
    advance(SM_HEARTBEAT_MS + 200);
    EXPECT(hm10_log_contains("HB"),
           "HM-10 should see a HB after the heartbeat window in IDLE");
}

static void test_tara_during_hold_restarts_scan(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    sm_handle_event(SM_EV_ESP_NOMATCH, NULL);
    EXPECT_STATE(SM_STATE_NOMATCH);
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    EXPECT_STATE(SM_STATE_SCANNING);
}

static void test_late_esp_result_is_ignored_after_timeout(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    advance(SM_SCAN_TIMEOUT_MS + 200);
    EXPECT_STATE(SM_STATE_NETERR);
    /* A stale RESULT from ESP shows up after the session closed. */
    sm_handle_event(SM_EV_ESP_NOMATCH, NULL);
    EXPECT_STATE(SM_STATE_NETERR);
}

static void test_neterr_blinks_amber(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    advance(SM_SCAN_TIMEOUT_MS + 200);
    EXPECT_STATE(SM_STATE_NETERR);
    bool first = g_eff.leds[SM_LED_AMBER];
    /* Push at least one full blink toggle. */
    advance(SM_NETERR_BLINK_MS + 100);
    bool second = g_eff.leds[SM_LED_AMBER];
    EXPECT(first != second, "AMBER should toggle during NETERR blink");
}

static void test_long_name_truncated_safely(void)
{
    reset_env();
    sm_handle_event(SM_EV_TARA_PRESS, NULL);
    sm_payload_t p = {
        .match_name = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", /* 57 chars */
        .match_similarity = 0.5f,
    };
    sm_handle_event(SM_EV_ESP_MATCH, &p);
    EXPECT_STATE(SM_STATE_MATCH);
    /* No crash, no overflow; just confirm MATCH frame went out. */
    EXPECT(hm10_log_contains("MATCH:"), "MATCH frame should still be emitted");
}

/* --------------- Entry point --------------------------------------- */

int main(void)
{
    printf("== state_machine host tests ==\n");

    RUN(test_initial_state_is_idle_with_green_led);
    RUN(test_tara_press_starts_scan_and_sends_capture);
    RUN(test_esp_match_drives_red_and_buzzer_and_dial_frame);
    RUN(test_esp_nomatch_path);
    RUN(test_scan_timeout_yields_neterr);
    RUN(test_panic_always_armed_even_in_scan);
    RUN(test_hold_window_returns_to_idle);
    RUN(test_heartbeat_emitted_while_idle);
    RUN(test_tara_during_hold_restarts_scan);
    RUN(test_late_esp_result_is_ignored_after_timeout);
    RUN(test_neterr_blinks_amber);
    RUN(test_long_name_truncated_safely);

    printf("\n== %d run, %d failed ==\n", g_tests_run, g_tests_failed);
    return g_tests_failed == 0 ? 0 : 1;
}
