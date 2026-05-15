import SwiftUI

/// Landing tab. Greeting + plate + a compact system status card. The big
/// scan UI lives in the Scan tab; this screen exists so the driver has a
/// calm, glanceable "everything is fine" view between trips.
struct DashboardView: View {
    @Environment(AuthManager.self) private var auth
    @Environment(AppState.self) private var state

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    greeting
                    statusCard
                    hintsCard
                    if !state.eventLog.isEmpty {
                        recentEvents
                    }
                    Spacer(minLength: 30)
                }
                .padding(.horizontal, 22)
                .padding(.top, 20)
            }
        }
    }

    @ViewBuilder
    private var greeting: some View {
        if case let .loggedIn(name, plate) = auth.status {
            VStack(alignment: .leading, spacing: 6) {
                Text("Hoş geldin")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.6))
                Text(name)
                    .font(.largeTitle.bold())
                    .foregroundStyle(.white)
                HStack(spacing: 8) {
                    Image(systemName: "car.fill")
                        .foregroundStyle(AppTheme.accent)
                    Text(plate)
                        .font(.headline.monospaced())
                        .foregroundStyle(.white.opacity(0.85))
                }
            }
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                Circle()
                    .fill(state.bleConnected ? AppTheme.success : AppTheme.danger)
                    .frame(width: 12, height: 12)
                Text(state.bleConnected ? "Sistem aktif" : "Bağlantı bekleniyor")
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
            }
            Divider().overlay(Color.white.opacity(0.1))
            row(label: "Son durum", value: stateLabel(state.currentState))
            if state.currentState == "MATCH" && !state.matchName.isEmpty {
                row(label: "Eşleşme",
                    value: "\(state.matchName) · %\(Int(state.matchSimilarity * 100))",
                    valueColor: AppTheme.danger)
            }
            if let hb = state.lastHeartbeat {
                row(label: "Son heartbeat", value: timeAgo(hb))
            }
        }
        .padding(18)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var hintsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            hint(icon: "viewfinder",
                 text: "Tarama, sürücü panelindeki TARA butonuyla başlatılır")
            hint(icon: "phone.fill",
                 text: "Eşleşme veya panik durumunda arama ekranı otomatik açılır")
            hint(icon: "wifi",
                 text: "ESP32-CAM Wi-Fi hotspot üzerinden sunucuya bağlanır")
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var recentEvents: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Son olaylar")
                .font(.headline)
                .foregroundStyle(.white)
            VStack(spacing: 0) {
                ForEach(state.eventLog.prefix(5)) { entry in
                    HStack(spacing: 12) {
                        Text(formatter.string(from: entry.timestamp))
                            .font(.caption2.monospaced())
                            .foregroundStyle(.white.opacity(0.5))
                            .frame(width: 64, alignment: .leading)
                        Text(entry.text)
                            .font(.caption.monospaced())
                            .foregroundStyle(.white)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 14)
                    if entry.id != state.eventLog.prefix(5).last?.id {
                        Divider().overlay(Color.white.opacity(0.06))
                    }
                }
            }
            .background(AppTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    private func row(label: String, value: String, valueColor: Color = .white) -> some View {
        HStack {
            Text(label).foregroundStyle(.white.opacity(0.6))
            Spacer()
            Text(value).foregroundStyle(valueColor)
        }
        .font(.subheadline)
    }

    private func hint(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(AppTheme.accent)
                .frame(width: 22)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
            Spacer(minLength: 0)
        }
    }

    private func stateLabel(_ s: String) -> String {
        switch s {
        case "IDLE", "—": return "Hazır"
        case "SCANNING": return "Yolcu taranıyor"
        case "MATCH": return "Eşleşme bulundu"
        case "NOMATCH": return "Eşleşme yok"
        case "PANIC": return "Panik sinyali"
        case "NETERR": return "Bağlantı hatası"
        default: return s
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
