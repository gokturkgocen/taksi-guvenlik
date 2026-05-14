/**
 * @file    state_machine.c
 * @brief   Implementation of state_machine.h. Portable C99, no HAL.
 */
#include "state_machine.h"

#include <stdio.h>
#include <string.h>

/* -------------------------------------------------------------------- */
/* Module-private storage                                                */
/* -------------------------------------------------------------------- */

static const sm_callbacks_t *g_cb;
static sm_state_t            g_state;
static uint32_t              g_state_entered_ms;
static uint32_t              g_last_heartbeat_ms;
static uint32_t              g_last_blink_toggle_ms;
static bool                  g_amber_on;       /* NETERR blink phase. */
static char                  g_match_name[SM_MAX_NAME_LEN + 1];
static float                 g_match_sim;

/* -------------------------------------------------------------------- */
/* Helpers                                                               */
/* -------------------------------------------------------------------- */

static void all_leds_off(void)
{
    g_cb->set_led(SM_LED_GREEN, false);
    g_cb->set_led(SM_LED_AMBER, false);
    g_cb->set_led(SM_LED_RED,   false);
}

static void enter_state(sm_state_t next)
{
    g_state = next;
    g_state_entered_ms = g_cb->now_ms();
    g_amber_on = false;
    g_last_blink_toggle_ms = g_state_entered_ms;

    all_leds_off();
    g_cb->set_buzzer(false);

    switch (next) {
    case SM_STATE_IDLE:
        g_cb->set_led(SM_LED_GREEN, true);
        g_last_heartbeat_ms = g_state_entered_ms;  /* defer first HB */
        break;

    case SM_STATE_SCANNING:
        g_cb->set_led(SM_LED_AMBER, true);
        g_cb->send_to_esp ("CAPTURE\n");
        g_cb->send_to_hm10("SCANNING\n");
        break;

    case SM_STATE_MATCH: {
        char line[SM_MAX_NAME_LEN + 32];
        g_cb->set_led(SM_LED_RED, true);
        g_cb->set_buzzer(true);
        /* snprintf is bounded; %s reads up to NUL, sim is fixed width. */
        int n = snprintf(line, sizeof line, "MATCH:%s;%.3f\n",
                         g_match_name, (double)g_match_sim);
        if (n > 0 && (size_t)n < sizeof line) {
            g_cb->send_to_hm10(line);
        }
        break;
    }

    case SM_STATE_NOMATCH:
        g_cb->set_led(SM_LED_GREEN, true);
        g_cb->send_to_hm10("NOMATCH\n");
        break;

    case SM_STATE_PANIC:
        g_cb->set_led(SM_LED_RED, true);
        g_cb->set_buzzer(true);
        g_cb->send_to_hm10("PANIC\n");
        break;

    case SM_STATE_NETERR:
        g_cb->set_led(SM_LED_AMBER, true);     /* first half of blink */
        g_amber_on = true;
        g_cb->send_to_hm10("NETERR\n");
        break;

    default:
        break;
    }
}

static void copy_match_payload(const sm_payload_t *p)
{
    g_match_name[0] = '\0';
    g_match_sim = 0.0f;
    if (!p) return;
    if (p->match_name) {
        size_t n = strlen(p->match_name);
        if (n > SM_MAX_NAME_LEN) n = SM_MAX_NAME_LEN;
        memcpy(g_match_name, p->match_name, n);
        g_match_name[n] = '\0';
    }
    g_match_sim = p->match_similarity;
}

/* -------------------------------------------------------------------- */
/* Public API                                                            */
/* -------------------------------------------------------------------- */

void sm_init(const sm_callbacks_t *callbacks)
{
    g_cb = callbacks;
    g_match_name[0] = '\0';
    g_match_sim = 0.0f;
    enter_state(SM_STATE_IDLE);
}

void sm_handle_event(sm_event_t event, const sm_payload_t *payload)
{
    if (!g_cb) return;

    /* PANIC button is always armed — even mid-scan. */
    if (event == SM_EV_PANIC_PRESS) {
        enter_state(SM_STATE_PANIC);
        return;
    }

    switch (g_state) {
    case SM_STATE_IDLE:
        if (event == SM_EV_TARA_PRESS) {
            enter_state(SM_STATE_SCANNING);
        }
        break;

    case SM_STATE_SCANNING:
        if (event == SM_EV_ESP_MATCH) {
            copy_match_payload(payload);
            enter_state(SM_STATE_MATCH);
        } else if (event == SM_EV_ESP_NOMATCH) {
            enter_state(SM_STATE_NOMATCH);
        } else if (event == SM_EV_ESP_ERROR) {
            enter_state(SM_STATE_NETERR);
        }
        /* TARA pressed mid-scan is ignored — debounce. */
        break;

    case SM_STATE_MATCH:
    case SM_STATE_NOMATCH:
    case SM_STATE_PANIC:
    case SM_STATE_NETERR:
        /* User-triggered TARA cancels the hold and starts a new scan. */
        if (event == SM_EV_TARA_PRESS) {
            enter_state(SM_STATE_SCANNING);
        }
        /* Late ESP responses are dropped — session already closed. */
        break;

    default:
        break;
    }
}

void sm_tick(void)
{
    if (!g_cb) return;
    const uint32_t now = g_cb->now_ms();
    const uint32_t elapsed = now - g_state_entered_ms;

    switch (g_state) {
    case SM_STATE_IDLE:
        if (now - g_last_heartbeat_ms >= SM_HEARTBEAT_MS) {
            g_cb->send_to_hm10("HB\n");
            g_last_heartbeat_ms = now;
        }
        break;

    case SM_STATE_SCANNING:
        if (elapsed >= SM_SCAN_TIMEOUT_MS) {
            enter_state(SM_STATE_NETERR);
        }
        break;

    case SM_STATE_MATCH:
        if (elapsed >= SM_HOLD_MATCH_MS) enter_state(SM_STATE_IDLE);
        break;

    case SM_STATE_NOMATCH:
        if (elapsed >= SM_HOLD_NOMATCH_MS) enter_state(SM_STATE_IDLE);
        break;

    case SM_STATE_PANIC:
        if (elapsed >= SM_HOLD_PANIC_MS) enter_state(SM_STATE_IDLE);
        break;

    case SM_STATE_NETERR:
        /* AMBER blink while held. */
        if (now - g_last_blink_toggle_ms >= SM_NETERR_BLINK_MS) {
            g_amber_on = !g_amber_on;
            g_cb->set_led(SM_LED_AMBER, g_amber_on);
            g_last_blink_toggle_ms = now;
        }
        if (elapsed >= SM_HOLD_NETERR_MS) enter_state(SM_STATE_IDLE);
        break;

    default:
        break;
    }
}

sm_state_t sm_current_state(void) { return g_state; }

const char *sm_state_name(sm_state_t s)
{
    switch (s) {
    case SM_STATE_IDLE:     return "IDLE";
    case SM_STATE_SCANNING: return "SCANNING";
    case SM_STATE_MATCH:    return "MATCH";
    case SM_STATE_NOMATCH:  return "NOMATCH";
    case SM_STATE_PANIC:    return "PANIC";
    case SM_STATE_NETERR:   return "NETERR";
    default:                return "?";
    }
}
