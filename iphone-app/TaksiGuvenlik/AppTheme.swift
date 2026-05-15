import SwiftUI

/// Shared color palette + reusable form field. Keeps every screen visually
/// consistent without dragging in a heavyweight design system.
enum AppTheme {
    static let background = Color(red: 0.04, green: 0.08, blue: 0.16)
    static let card = Color.white.opacity(0.06)
    static let cardBorder = Color.white.opacity(0.08)
    static let accent = Color(red: 1.0, green: 0.55, blue: 0.26)   // warm orange
    static let success = Color(red: 0.31, green: 0.80, blue: 0.77)
    static let danger = Color(red: 1.0, green: 0.42, blue: 0.42)
    static let warning = Color.yellow
}

struct AuthField: View {
    let title: String
    @Binding var text: String
    let secure: Bool
    var autoUppercase: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))
            Group {
                if secure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                        .autocapitalization(autoUppercase ? .allCharacters : .none)
                        .keyboardType(.asciiCapable)
                        .disableAutocorrection(true)
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(Color.white.opacity(0.08))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}
