import SwiftUI

/// Şoför girişi — plaka + ad/soyad + PIN.
struct LoginView: View {
    @Environment(AppState.self) private var state

    @State private var plate = "34 ABC 123"
    @State private var firstName = "Ahmet"
    @State private var lastName = "Yıldız"
    @State private var pin = "1234"

    private var ready: Bool {
        !plate.isEmpty && !firstName.isEmpty && !lastName.isEmpty && pin.count >= 4
    }

    var body: some View {
        VStack(spacing: 0) {
            // Üst lacivert blok — taksi içeride
            ZStack(alignment: .topLeading) {
                LinearGradient.navyHeader
                    .ignoresSafeArea(edges: .top)

                VStack(alignment: .leading, spacing: 0) {
                    Color.clear.frame(height: 8) // status bar boşluğu

                    HStack {
                        Spacer()
                        Image("Taxi")
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 310, maxHeight: 210)
                            .shadow(color: .black.opacity(0.35), radius: 12, y: 8)
                        Spacer()
                    }

                    Text("ŞOFÖR GİRİŞİ")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.taxiYellow)
                        .tracking(1.2)
                        .padding(.top, 18)

                    Text("Hoş geldin")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.top, 6)

                    Text("Vardiyana başlamak için bilgilerini gir.")
                        .font(.system(size: 14))
                        .foregroundStyle(Color.white.opacity(0.7))
                        .padding(.top, 6)
                }
                .padding(.horizontal, 24)
                .padding(.top, 40)
                .padding(.bottom, 28)
            }
            .fixedSize(horizontal: false, vertical: true)

            // Form (beyaz, üst köşeleri yuvarlanmış, üste binmiş)
            VStack(alignment: .leading, spacing: 18) {
                LoginField(label: "Plaka", placeholder: "34 ABC 123",
                           icon: "car.fill", text: $plate,
                           capitalization: .characters)

                HStack(spacing: 12) {
                    LoginField(label: "İsim", placeholder: "Ahmet",
                               icon: "person.fill", text: $firstName,
                               capitalization: .words)
                    LoginField(label: "Soyisim", placeholder: "Yıldız",
                               icon: nil, text: $lastName,
                               capitalization: .words)
                }

                LoginField(label: "PIN Kodu", placeholder: "••••",
                           icon: "lock.fill", text: $pin, isSecure: true,
                           capitalization: .never, keyboard: .numberPad)

                Button {
                    state.plate = plate
                    state.firstName = firstName
                    state.lastName = lastName
                    state.login()
                } label: {
                    Text("Vardiyaya başla")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(ready ? Color.taxiYellow : .white)
                        .tracking(0.3)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(ready ? Color.navy : Color(white: 0.78))
                        )
                        .shadow(color: ready ? Color.navy.opacity(0.25) : .clear,
                                radius: 12, y: 8)
                }
                .disabled(!ready)
                .padding(.top, 8)

                HStack(spacing: 4) {
                    Spacer()
                    Text("PIN'ini mi unuttun?")
                        .foregroundStyle(Color.textMuted)
                    Text("Yardım al")
                        .foregroundStyle(Color.navyAccent)
                        .fontWeight(.semibold)
                    Spacer()
                }
                .font(.system(size: 13))
                .padding(.top, 4)
            }
            .padding(.horizontal, 24)
            .padding(.top, 28)
            .padding(.bottom, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(
                UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                    .fill(Color.white)
            )
            .padding(.top, -20)
        }
        .background(Color.white)
        .ignoresSafeArea(.keyboard)
    }
}

/// Login formundaki tek bir input alanı.
private struct LoginField: View {
    let label: String
    let placeholder: String
    let icon: String?
    @Binding var text: String
    var isSecure: Bool = false
    var capitalization: TextInputAutocapitalization = .words
    var keyboard: UIKeyboardType = .default

    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.textMuted)
                .tracking(0.2)

            HStack(spacing: 10) {
                if let icon {
                    Image(systemName: icon)
                        .font(.system(size: 16))
                        .foregroundStyle(focused ? Color.navyAccent : Color(white: 0.55))
                }
                Group {
                    if isSecure {
                        SecureField(placeholder, text: $text)
                    } else {
                        TextField(placeholder, text: $text)
                    }
                }
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.navy)
                .focused($focused)
                .textInputAutocapitalization(capitalization)
                .keyboardType(keyboard)
                .autocorrectionDisabled()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(Color.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(focused ? Color.navyAccent : .clear, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}

#Preview {
    LoginView().environment(AppState())
}
