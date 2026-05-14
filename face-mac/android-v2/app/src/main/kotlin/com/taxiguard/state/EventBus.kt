package com.taxiguard.state

import com.taxiguard.protocol.MatchEvent
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Process-wide event hub. The BLE service writes to it; the UI reads from it.
 *
 * Two channels:
 *   - [connection]: replayable latest state, fine for UI banner.
 *   - [events]: hot stream of every frame received; UI logs subscribe.
 *
 * Held as a singleton object so the service and the UI naturally share it
 * without any DI framework.
 */
object EventBus {

    private val _connection = MutableStateFlow<ConnectionStatus>(ConnectionStatus.Idle)
    val connection: StateFlow<ConnectionStatus> = _connection.asStateFlow()

    private val _events = MutableSharedFlow<MatchEvent>(
        replay = 0,
        extraBufferCapacity = 32,
    )
    val events: SharedFlow<MatchEvent> = _events.asSharedFlow()

    private val _lastMatch = MutableStateFlow<MatchEvent.Match?>(null)
    val lastMatch: StateFlow<MatchEvent.Match?> = _lastMatch.asStateFlow()

    fun setConnection(status: ConnectionStatus) { _connection.value = status }

    suspend fun emit(event: MatchEvent) {
        if (event is MatchEvent.Match) _lastMatch.value = event
        _events.emit(event)
    }
}

sealed interface ConnectionStatus {
    data object Idle : ConnectionStatus
    data object Scanning : ConnectionStatus
    data class Connecting(val address: String) : ConnectionStatus
    data class Connected(val address: String, val name: String?) : ConnectionStatus
    data class Disconnected(val reason: String) : ConnectionStatus
    data object PermissionMissing : ConnectionStatus
}
