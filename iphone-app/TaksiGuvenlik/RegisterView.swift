import SwiftUI

struct RegisterView: View {
    @Environment(AuthManager.self) private var auth
    @State private var username = ""
    @State private var password = ""
    @State private var plate = ""
    var goToLogin: () -> Void

    var body: some View {
        ZStack {
            AppTheme.background.ignoresSafeArea()
            ScrollView {
                VStack(spacing: 24) {
                    Spacer().frame(height: 32)
                    Image(systemName: "person.badge.plus")
                        .font(.system(size: 60, weight: .semibold))
                        .foregroundStyle(AppTheme.accent)
                    VStack(spacing: 4) {
                        Text("Yeni Hesap")
                            .font(.largeTitle.bold())
                            .foregroundStyle(.white)
                        Text("Taksi şoförü olarak kaydol")
                            .font(.subheadline)
                            .foregroundStyle(.white.opacity(0.6))
                    }

                    VStack(spacing: 14) {
                        AuthField(title: "Kullanıcı adı", text: $username, secure: false)
                        AuthField(title: "Şifre (en az 6 karakter)", text: $password, secure: true)
                        AuthField(title: "Taksi plakası (34 ABC 1234)",
                                  text: $plate,
                                  secure: false,
                                  autoUppercase: true)
                    }
                    .padding(.top, 8)

                    if !plate.isEmpty && !plateValid {
                        Text("Plaka formatı: 34 ABC 1234")
                            .font(.footnote)
                            .foregroundStyle(.yellow.opacity(0.9))
                    }
                    if let msg = auth.errorMessage {
                        Text(msg)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 8)
                    }

                    Button {
                        Task {
                            await auth.register(username: username,
                                                password: password,
                                                plate: plate)
                        }
                    } label: {
                        Group {
                            if auth.inFlight {
                                ProgressView().tint(.white)
                            } else {
                                Text("Kayıt Ol").font(.headline)
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
                        goToLogin()
                    } label: {
                        HStack(spacing: 4) {
                            Text("Zaten hesabın var mı?").foregroundStyle(.white.opacity(0.6))
                            Text("Giriş yap").foregroundStyle(AppTheme.accent).bold()
                        }
                        .font(.footnote)
                    }

                    Spacer(minLength: 20)
                }
                .padding(.horizontal, 28)
            }
        }
    }

    private var plateValid: Bool {
        plate.range(of: Constants.plateRegex, options: .regularExpression) != nil
    }

    private var canSubmit: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 6
            && plateValid
    }
}
