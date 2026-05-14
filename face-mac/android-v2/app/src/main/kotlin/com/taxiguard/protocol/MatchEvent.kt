package com.taxiguard.protocol

/**
 * Events emitted by the STM32 over HM-10 BLE.
 *
 * Frames are ASCII text, newline-terminated. The STM side documentation
 * (face-mac/CLAUDE.md "STM32 ↔ HM-10 protokolü") defines:
 *
 *     SCANNING\n
 *     MATCH:<name>;<score>\n
 *     NOMATCH\n
 *     PANIC\n
 *     NETERR\n
 *     HB\n
 */
sealed interface MatchEvent {
    /** Driver pressed TARA; STM is starting a burst capture. */
    data object Scanning : MatchEvent

    /** STM aggregated a positive match. Triggers the 155 dial. */
    data class Match(val name: String, val similarity: Float) : MatchEvent

    /** Burst completed but no DB entry exceeded the threshold. */
    data object NoMatch : MatchEvent

    /** Driver pressed PANIC; treated like Match for dial-out. */
    data object Panic : MatchEvent

    /** STM could not reach the cloud within the scan window. */
    data object NetError : MatchEvent

    /** Liveness heartbeat from STM, ~every 5 s. */
    data object Heartbeat : MatchEvent

    /** Anything we did not recognise. Kept around for log inspection. */
    data class Unknown(val raw: String) : MatchEvent
}
