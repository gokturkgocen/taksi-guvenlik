import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var auth
    @State private var username = ""
    @State private var password = ""
    var goToRegister: () -> Void

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 40)
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 64, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                    VStack(spacing: 4) {
                        Text("Taksi Güvenlik")
                            .font(.largeTitle.bold())
                            .foregroundStyle(.white)
                        Text("Hesabına giriş yap")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.6))
                    }

                    VStack(spacing: 14) {
                        AuthField(title: "Kullanıcı adı", text: $username, secure: false)
                        AuthField(title: "Şifre", text: $password, secure: true)
                    }
                    .padding(.top, 8)

                    if let msg = auth.errorMessage {
                        Text(msg)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 8)
                    }

                    Button {
                        Task { await auth.login(username: username, password: password) }
                    } label: {
                        Group {
                            if auth.inFlight {
                                ProgressView().tint(.white)
                            } else {
                                Text("Giriş Yap").font(.headline)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(canSubmit ? AppTheme.accent : AppTheme.accent.opacity(0.4))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(.white)
                    }
                    .disabled(!canSubmit || auth.inFlight)

                    Button {
                        auth.errorMessage = nil
                        goToRegister()
                    } label: {
                        HStack(spacing: 4) {
                            Text("Hesabın yok mu?").foregroundStyle(.white.opacity(0.6))
                            Text("Kayıt ol").foregroundStyle(AppTheme.accent).bold()
                        }
                        .font(.footnote)
                    }

                    Spacer(minLength: 20)
                }
                .padding(.horizontal, 28)
            }
        }
    }

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 6
    }
}
