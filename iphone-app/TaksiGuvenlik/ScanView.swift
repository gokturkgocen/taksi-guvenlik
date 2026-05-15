import SwiftUI

/// Live scan view — the original single-screen UI, rehoused inside a tab.
/// Big colored state card driven by AppState.currentState, scrollable
/// event log underneath. MATCH / PANIC still triggers the auto-dialer
/// from BLEManager; this view is just the visualisation.
struct ScanView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            VStack(spacing: 16) {
                header
                statusCard
                eventLog
            }
            .padding(20)
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Canlı Tarama")
                    .font(.title2.bold())
                    .foregroundStyle(.white)
                Text(state.bleConnected ? "BLE bağlı" : "BLE bağlantı arıyor…")
                    .font(.caption)
                    .foregroundStyle(state.bleConnected ? AppTheme.success : AppTheme.warning)
            }
            Spacer()
            Circle()
                .fill(state.bleConnected ? AppTheme.success : AppTheme.danger)
                .frame(width: 14, height: 14)
        }
    }

    private var statusCard: some View {
        VStack(spacing: 8) {
            Text(state.currentState)
                .font(.system(size: 52, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .padding(.top, 28)
            statusSubtitle
            Spacer()
            if let hb = state.lastHeartbeat {
                Text("son heartbeat: \(timeAgo(hb))")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
                    .padding(.bottom, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 260)
        .background(statusColor)
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    @ViewBuilder
    private var statusSubtitle: some View {
        switch state.currentState {
        case "MATCH":
            VStack(spacing: 4) {
                Text("\(state.matchName)  ·  benzerlik %\(Int(state.matchSimilarity * 100))")
                    .font(.title3.bold())
                Text("Acil çağrı ekranı açıldı")
                    .font(.subheadline)
            }
            .foregroundStyle(.white)
        case "PANIC":
            Text("Panik sinyali — arama başlatıldı")
                .font(.title3.bold())
                .foregroundStyle(.white)
        case "SCANNING":
            Text("Yolcu yüzü taranıyor…")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.9))
        case "NOMATCH":
            Text("Veritabanında eşleşme yok")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.9))
        case "NETERR":
            Text("Bağlantı/sunucu sorunu — log'a bakın")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.9))
        default:
            Text("Sistem hazır")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
        }
    }

    private var eventLog: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Olay günlüğü")
                .font(.headline)
                .foregroundStyle(.white)
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 6) {
                    if state.eventLog.isEmpty {
                        Text("Henüz olay yok. Sürücü panelindeki TARA butonuna bas.")
                            .font(.footnote)
                            .foregroundStyle(.white.opacity(0.55))
                            .padding(.vertical, 12)
                    }
                    ForEach(state.eventLog) { entry in
                        HStack(spacing: 10) {
                            Text(formatter.string(from: entry.timestamp))
                                .font(.caption2.monospaced())
                                .foregroundStyle(.white.opacity(0.5))
                                .frame(width: 64, alignment: .leading)
                            Text(entry.text)
                                .font(.caption.monospaced())
                                .foregroundStyle(.white)
                            Spacer(minLength: 0)
                        }
                    }
                }
                .padding(12)
            }
            .frame(maxWidth: .infinity)
            .background(AppTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private var statusColor: Color {
        switch state.currentState {
        case "MATCH", "PANIC":   return AppTheme.danger.opacity(0.85)
        case "SCANNING":         return AppTheme.accent.opacity(0.85)
        case "NOMATCH":          return AppTheme.success.opacity(0.75)
        case "NETERR":           return AppTheme.warning.opacity(0.75)
        default:                 return Color.white.opacity(0.10)
        }
    }

    private var formatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }

    private func timeAgo(_ d: Date) -> String {
        let s = Int(Date().timeIntervalSince(d))
        if s < 60 { return "\(s) sn önce" }
        return "\(s / 60) dk önce"
    }
}
