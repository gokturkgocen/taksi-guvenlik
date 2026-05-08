import SwiftUI

/// Tasarımdaki renk paleti — `safety-protocol-design/shared.jsx` ile birebir.
extension Color {
    /// Lacivert ana renk #0A1F44
    static let navy = Color(red: 10/255, green: 31/255, blue: 68/255)
    /// Daha açık lacivert (gradient sonu) #16306B
    static let navy2 = Color(red: 22/255, green: 48/255, blue: 107/255)
    /// Aksan lacivert (hover/focus) #1B3A6B
    static let navyAccent = Color(red: 27/255, green: 58/255, blue: 107/255)
    /// Açık zemin #F4F6FB
    static let surface = Color(red: 244/255, green: 246/255, blue: 251/255)
    /// Soluk metin #6B7A99
    static let textMuted = Color(red: 107/255, green: 122/255, blue: 153/255)
    /// Sarı taksi accent #FFD43A
    static let taxiYellow = Color(red: 255/255, green: 212/255, blue: 58/255)
    /// Açık sarı (gradient başı) #FFE066
    static let taxiYellowLight = Color(red: 255/255, green: 224/255, blue: 102/255)
    /// Koyu sarı (gradient sonu) #F5B400
    static let taxiYellowDark = Color(red: 245/255, green: 180/255, blue: 0/255)
    /// Başarı/temiz #1F8A55
    static let okGreen = Color(red: 31/255, green: 138/255, blue: 85/255)
    /// Açık yeşil (rozetler) #7AE0A8
    static let okGreenLight = Color(red: 122/255, green: 224/255, blue: 168/255)
    /// Uyarı/şüpheli #C7423A
    static let warnRed = Color(red: 199/255, green: 66/255, blue: 58/255)
    /// Açık kırmızı #FF8A82
    static let warnRedLight = Color(red: 255/255, green: 138/255, blue: 130/255)
    /// Ayraç çizgi rengi #EEF1F7
    static let divider = Color(red: 238/255, green: 241/255, blue: 247/255)
}

/// Tekrar eden gradient'lar.
extension LinearGradient {
    /// Header lacivert gradient
    static let navyHeader = LinearGradient(
        colors: [.navy, .navy2],
        startPoint: .top,
        endPoint: .bottom
    )
    /// Sarı taksi FAB gradient
    static let taxiYellowFAB = LinearGradient(
        colors: [.taxiYellowLight, .taxiYellowDark],
        startPoint: .top,
        endPoint: .bottom
    )
}
