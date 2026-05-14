package com.taxiguard.protocol

/**
 * Parses ASCII frames coming off the HM-10. Each call expects a single
 * already-trimmed line (no trailing newline).
 *
 * HM-10 BLE is transparent — STM32 prints lines into UART2 and they come
 * out of the FFE1 notification characteristic verbatim. The phone side
 * buffers per-line and feeds them into [parse].
 */
object FrameParser {

    fun parse(line: String): MatchEvent {
        val trimmed = line.trim()
        if (trimmed.isEmpty()) return MatchEvent.Unknown(line)
        return when {
            trimmed == "SCANNING"  -> MatchEvent.Scanning
            trimmed == "NOMATCH"   -> MatchEvent.NoMatch
            trimmed == "PANIC"     -> MatchEvent.Panic
            trimmed == "NETERR"    -> MatchEvent.NetError
            trimmed == "HB"        -> MatchEvent.Heartbeat
            trimmed.startsWith("MATCH:") -> parseMatch(trimmed.removePrefix("MATCH:"))
            else -> MatchEvent.Unknown(trimmed)
        }
    }

    private fun parseMatch(payload: String): MatchEvent {
        // expected: "<name>;<score>"  e.g. "Ali_Yilmaz;0.94"
        val parts = payload.split(";")
        val name = parts.getOrNull(0)?.takeIf { it.isNotBlank() } ?: return MatchEvent.Unknown("MATCH:$payload")
        val score = parts.getOrNull(1)?.toFloatOrNull() ?: 0f
        return MatchEvent.Match(name = name, similarity = score)
    }
}
