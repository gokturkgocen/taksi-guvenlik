package com.taxiguard.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taxiguard.ble.Hm10Service
import com.taxiguard.protocol.MatchEvent
import com.taxiguard.state.ConnectionStatus
import com.taxiguard.state.EventBus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Single-screen UI. Three logical zones:
 *   1. Connection status banner (mirrors EventBus.connection).
 *   2. Last MATCH card (most recent positive recognition).
 *   3. Recent event log (rolling, in-memory only).
 *   4. Controls: Start/Stop service, Simulate MATCH (dev mode).
 */
@Composable
fun HomeScreen() {
    val ctx = LocalContext.current
    val connection by EventBus.connection.collectAsStateWithLifecycle()
    val lastMatch by EventBus.lastMatch.collectAsStateWithLifecycle()
    val log = remember { mutableStateListOf<LogRow>() }

    LaunchedEffect(Unit) {
        EventBus.events.collect { ev ->
            log.add(0, LogRow(System.currentTimeMillis(), ev))
            if (log.size > 60) log.removeAt(log.lastIndex)
        }
    }

    Scaffold { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Header()
            ConnectionBanner(connection)
            LastMatchCard(lastMatch)
            Controls(ctx, connection)
            EventLog(log)
        }
    }
}

@Composable
private fun Header() {
    Column {
        Text(
            text = "TAXI GUARD",
            style = MaterialTheme.typography.labelMedium.copy(
                fontFamily = FontFamily.Monospace,
                letterSpacing = 4.sp,
                color = MaterialTheme.colorScheme.secondary,
            ),
        )
        Text(
            text = "Yolcu Yüz Tarama",
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Medium,
            ),
        )
        Text(
            text = "Eşleşme durumunda 155 hattı otomatik aranır.",
            style = MaterialTheme.typography.bodySmall.copy(
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            ),
        )
    }
}

@Composable
private fun ConnectionBanner(state: ConnectionStatus) {
    val (label, tint) = when (state) {
        ConnectionStatus.Idle               -> "Hazır" to MaterialTheme.colorScheme.outline
        ConnectionStatus.Scanning           -> "BLE taraması..." to MaterialTheme.colorScheme.secondary
        is ConnectionStatus.Connecting      -> "Bağlanıyor — ${state.address}" to MaterialTheme.colorScheme.secondary
        is ConnectionStatus.Connected       -> "Bağlı — ${state.name ?: state.address}" to MaterialTheme.colorScheme.primary
        is ConnectionStatus.Disconnected    -> "Kopuk — ${state.reason}" to MaterialTheme.colorScheme.error
        ConnectionStatus.PermissionMissing  -> "İzin gerekiyor (Bluetooth / Çağrı)" to MaterialTheme.colorScheme.error
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(12.dp)
                .clip(RoundedCornerShape(50))
                .background(tint),
        )
        Spacer(Modifier.size(10.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium,
            ),
        )
    }
}

@Composable
private fun LastMatchCard(match: MatchEvent.Match?) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = if (match == null)
                MaterialTheme.colorScheme.surface
            else
                MaterialTheme.colorScheme.error,
            contentColor = if (match == null)
                MaterialTheme.colorScheme.onSurface
            else
                Color.White,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(
                text = "SON EŞLEŞME",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 3.sp,
                ),
            )
            Spacer(Modifier.size(6.dp))
            if (match == null) {
                Text("Henüz eşleşme yok.",
                    style = MaterialTheme.typography.bodyLarge)
            } else {
                Text(match.name,
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.SemiBold,
                    ))
                Text("similarity = ${"%.3f".format(match.similarity)}",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontFamily = FontFamily.Monospace,
                    ))
            }
        }
    }
}

@Composable
private fun Controls(ctx: Context, state: ConnectionStatus) {
    val running = state !is ConnectionStatus.Idle
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        if (running) {
            OutlinedButton(
                onClick = { Hm10Service.stop(ctx) },
                modifier = Modifier.weight(1f),
            ) { Text("Servisi Durdur") }
        } else {
            Button(
                onClick = { Hm10Service.start(ctx) },
                modifier = Modifier.weight(1f),
            ) { Text("Servisi Başlat") }
        }
        Button(
            onClick = { Hm10Service.simulateMatch(ctx) },
            modifier = Modifier.weight(1f),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.secondary,
                contentColor = MaterialTheme.colorScheme.onSecondary,
            ),
        ) { Text("DEV: Simulate MATCH") }
    }
}

@Composable
private fun EventLog(rows: List<LogRow>) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                "OLAY KAYDI",
                style = MaterialTheme.typography.labelSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 3.sp,
                ),
            )
            Spacer(Modifier.size(6.dp))
            if (rows.isEmpty()) {
                Text("— henüz veri yok —",
                    style = MaterialTheme.typography.bodySmall.copy(
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.outline,
                    ))
            } else {
                LazyColumn(contentPadding = PaddingValues(vertical = 4.dp)) {
                    items(rows) { row -> LogRowView(row) }
                }
            }
        }
    }
}

@Composable
private fun LogRowView(row: LogRow) {
    val fmt = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }
    val color = when (row.event) {
        is MatchEvent.Match -> MaterialTheme.colorScheme.error
        MatchEvent.Panic    -> MaterialTheme.colorScheme.error
        MatchEvent.NoMatch  -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.onSurface
    }
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(
            fmt.format(Date(row.tsMillis)),
            style = MaterialTheme.typography.bodySmall.copy(
                fontFamily = FontFamily.Monospace,
                color = MaterialTheme.colorScheme.outline,
            ),
        )
        Spacer(Modifier.size(10.dp))
        Text(
            row.event.toLogString(),
            style = MaterialTheme.typography.bodySmall.copy(
                fontFamily = FontFamily.Monospace,
                color = color,
                fontWeight = FontWeight.Medium,
            ),
        )
    }
}

private data class LogRow(val tsMillis: Long, val event: MatchEvent)

private fun MatchEvent.toLogString(): String = when (this) {
    MatchEvent.Scanning           -> "SCANNING"
    is MatchEvent.Match           -> "MATCH  $name  sim=${"%.3f".format(similarity)}"
    MatchEvent.NoMatch            -> "NOMATCH"
    MatchEvent.Panic              -> "PANIC"
    MatchEvent.NetError           -> "NETERR"
    MatchEvent.Heartbeat          -> "HB"
    is MatchEvent.Unknown         -> "??  $raw"
}
