import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                profileHeader

                SettingsGroup(title: "Hesap") {
                    SettingsRow(label: "Ad Soyad", value: "\(state.firstName) \(state.lastName)")
                    SettingsRow(label: "Telefon", value: "+90 532 *** 47 21")
                    SettingsRow(label: "Şoför Belgesi", value: "Doğrulandı", valueColor: .okGreen)
                }

                SettingsGroup(title: "Kamera & Tarama") {
                    SettingsToggle(label: "Otomatik tarama",
                                   subtitle: "Yolcu binince başlat",
                                   defaultOn: true)
                    SettingsToggle(label: "Yüksek doğruluk modu",
                                   subtitle: "Daha fazla pil tüketir")
                    SettingsToggle(label: "Şüpheli durumda titreşim", defaultOn: true)
                    SettingsRow(label: "Eşleşme eşiği", value: "%85")
                }

                SettingsGroup(title: "Bildirimler") {
                    SettingsToggle(label: "Şüpheli yolcu uyarıları", defaultOn: true)
                    SettingsToggle(label: "Vardiya hatırlatıcı", defaultOn: true)
                    SettingsToggle(label: "Haftalık özet")
                }

                SettingsGroup(title: "Diğer") {
                    SettingsRow(label: "Dil", value: "Türkçe", showsChevron: true)
                    SettingsRow(label: "Yardım & Destek", showsChevron: true)
                    SettingsRow(label: "Gizlilik politikası", showsChevron: true)
                    SettingsRow(label: "Versiyon", value: "1.4.2")
                }

                logoutButton
            }
            .padding(.bottom, 100)
        }
        .background(Color.surface)
        .ignoresSafeArea(edges: .top)
    }

    // MARK: - Header

    private var profileHeader: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("PROFİL & AYARLAR")
                .font(.system(size: 12, weight: .medium))
                .tracking(0.5)
                .foregroundStyle(Color.white.opacity(0.65))

            HStack(spacing: 16) {
                AvatarBubble(initials: initials(state.firstName, state.lastName))

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(state.firstName) \(state.lastName)")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    Text("Şoför · ID \(state.driverID)")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.white.opacity(0.7))

                    HStack(spacing: 5) {
                        Circle()
                            .fill(Color.okGreenLight)
                            .frame(width: 5, height: 5)
                        Text("VARDİYADA")
                            .font(.system(size: 11, weight: .bold))
                    }
                    .foregroundStyle(Color.okGreenLight)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.okGreen.opacity(0.25))
                    .overlay(
                        Capsule().stroke(Color.okGreen.opacity(0.5), lineWidth: 1)
                    )
                    .clipShape(Capsule())
                    .padding(.top, 6)
                }
                Spacer(minLength: 0)
            }

            // Plaka kartı
            HStack(spacing: 12) {
                Image(systemName: "car.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Color.taxiYellow)

                VStack(alignment: .leading, spacing: 2) {
                    Text("AKTİF PLAKA")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(0.5)
                        .foregroundStyle(Color.white.opacity(0.6))
                    Text(state.plate)
                        .font(.system(size: 16, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                }
                Spacer()
                Button {
                    // değiştir
                } label: {
                    Text("Değiştir")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.08))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal, 24)
        .padding(.top, 60)
        .padding(.bottom, 32)
        .background(LinearGradient.navyHeader)
    }

    private func initials(_ first: String, _ last: String) -> String {
        let f = first.first.map { String($0) } ?? ""
        let l = last.first.map { String($0) } ?? ""
        return (f + l).uppercased()
    }

    // MARK: - Logout

    private var logoutButton: some View {
        Button {
            state.logout()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "arrow.right.square")
                    .font(.system(size: 16, weight: .bold))
                Text("Vardiyayı bitir ve çık")
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(Color.warnRed)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.warnRed.opacity(0.25), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

// MARK: - Reusable parts

private struct AvatarBubble: View {
    let initials: String
    var body: some View {
        Circle()
            .fill(Color.taxiYellow)
            .frame(width: 64, height: 64)
            .overlay(
                Text(initials)
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundStyle(Color.navy)
            )
            .overlay(
                Circle().stroke(Color.white.opacity(0.2), lineWidth: 3)
            )
    }
}

private struct SettingsGroup<Content: View>: View {
    let title: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(Color.textMuted)
                .padding(.horizontal, 8)
                .padding(.bottom, 8)

            VStack(spacing: 0) {
                content
            }
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 16)
        .padding(.top, 20)
    }
}

private struct SettingsRow: View {
    let label: String
    var value: String? = nil
    var valueColor: Color = .textMuted
    var showsChevron: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.navy)
            Spacer()
            if let value {
                Text(value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(valueColor)
            }
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textMuted)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .overlay(
            Rectangle().fill(Color(red: 242/255, green: 244/255, blue: 249/255)).frame(height: 1),
            alignment: .bottom
        )
    }
}

private struct SettingsToggle: View {
    let label: String
    var subtitle: String? = nil
    var defaultOn: Bool = false

    @State private var isOn: Bool = false

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.navy)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.textMuted)
                }
            }
            Spacer()
            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Color.navyAccent)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .overlay(
            Rectangle().fill(Color(red: 242/255, green: 244/255, blue: 249/255)).frame(height: 1),
            alignment: .bottom
        )
        .onAppear { isOn = defaultOn }
    }
}

#Preview {
    let s = AppState(); s.loggedIn = true; s.tab = .settings
    return MainTabsView().environment(s)
}
