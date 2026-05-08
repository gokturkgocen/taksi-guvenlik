import SwiftUI

/// Uygulama genelinde paylaşılan oturum durumu. Login + sekme.
@Observable
final class AppState {
    /// Aktif sekme.
    enum Tab: Hashable {
        case home, logs, settings
    }

    var loggedIn: Bool = false
    var tab: Tab = .home

    /// Şoför bilgileri (giriş ekranından).
    var plate: String = "34 ABC 123"
    var firstName: String = "Ahmet"
    var lastName: String = "Yıldız"
    var driverID: String = "4837"

    /// BLE durum bayrakları (gerçek BLEManager bunları günceller).
    var bleConnected: Bool = false
    var lastHeartbeat: Date? = nil
    /// Aktif alarm (MATCH veya PANIC alındığında set olur).
    var activeAlert: AlertEvent? = nil

    func login() {
        loggedIn = true
        tab = .home
    }

    func logout() {
        loggedIn = false
    }
}

/// Tek bir alarm olayı.
struct AlertEvent: Identifiable, Hashable {
    enum Kind: Hashable {
        case match(name: String, similarity: Double)
        case panic
    }

    let id = UUID()
    let kind: Kind
    let timestamp: Date

    var headline: String {
        switch kind {
        case .match(let name, _): return "Şüpheli yolcu eşleşmesi"
        case .panic: return "Panik butonu basıldı"
        }
    }

    var subtitle: String {
        switch kind {
        case .match(let name, let sim):
            return "\(name) · güven %\(Int(sim * 100))"
        case .panic:
            return "Acil çağrı tetikleniyor"
        }
    }
}
