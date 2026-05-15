import SwiftUI

struct ProfileView: View {
    @Environment(AuthManager.self) private var auth
    @State private var showLogoutConfirm = false

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            VStack(spacing: 24) {
                Spacer().frame(height: 24)
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 88))
                    .foregroundStyle(AppTheme.accent)

                if case let .loggedIn(name, plate) = auth.status {
                    VStack(spacing: 6) {
                        Text(name).font(.title2.bold()).foregroundStyle(.white)
                        Label(plate, systemImage: "car.fill")
                            .font(.callout.monospaced())
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }

                VStack(spacing: 0) {
                    infoRow(title: "Sunucu", value: "EC2 · InsightFace")
                    Divider().overlay(Color.white.opacity(0.08))
                    infoRow(title: "Acil çağrı", value: BLEManager.emergencyNumber)
                    Divider().overlay(Color.white.opacity(0.08))
                    infoRow(title: "Sürüm", value: "1.0")
                }
                .background(AppTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 14))

                Spacer()

                Button {
                    showLogoutConfirm = true
                } label: {
                    Text("Çıkış Yap")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(AppTheme.danger.opacity(0.9))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                }
                .confirmationDialog("Çıkış yapmak istiyor musun?",
                                    isPresented: $showLogoutConfirm,
                                    titleVisibility: .visible) {
                    Button("Çıkış Yap", role: .destructive) {
                        Task { await auth.logout() }
                    }
                    Button("Vazgeç", role: .cancel) {}
                }
            }
            .padding(24)
        }
    }

    private func infoRow(title: String, value: String) -> some View {
        HStack {
            Text(title).foregroundStyle(.white.opacity(0.6))
            Spacer()
            Text(value).foregroundStyle(.white)
        }
        .font(.subheadline)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
