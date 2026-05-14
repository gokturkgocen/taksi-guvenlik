import SwiftUI
import Foundation

/// Single shared state object for the minimal taxi-safety client.
/// The fields with the "compat shim" comment below exist only so the older
/// SwiftUI views (LoginView, HomeView, LogsView, SettingsView, BottomNavView,
/// TripCard) still compile alongside the new minimal ContentView. They are
/// not wired to the live screen anymore.
@Observable
final class AppState {
    // Active UI state — used by ContentView.
    var bleConnected: Bool = false
    var currentState: String = "—"
    var matchName: String = ""
    var matchSimilarity: Double = 0.0
    var lastHeartbeat: Date? = nil
    var eventLog: [LogEntry] = []
    var alertActive: Bool = false

    func append(_ line: String) {
        let entry = LogEntry(text: line, timestamp: Date())
        eventLog.insert(entry, at: 0)
        if eventLog.count > 60 { eventLog.removeLast(eventLog.count - 60) }
    }

    // ─────────── compat shim — keep legacy views compiling ───────────
    enum Tab: Hashable { case home, logs, settings }
    var loggedIn: Bool = true
    var tab: Tab = .home
    var plate: String = ""
    var firstName: String = ""
    var lastName: String = ""
    var driverID: String = ""
    var activeAlert: AlertEvent? = nil
    func login()  { loggedIn = true }
    func logout() { loggedIn = false }
}

struct LogEntry: Identifiable, Hashable {
    let id = UUID()
    let text: String
    let timestamp: Date
}

/// Compat shim used by the legacy HomeView/TripCard previews.
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
        case .match: return "Şüpheli yolcu eşleşmesi"
        case .panic: return "Panik butonu basıldı"
        }
    }
    var subtitle: String {
        switch kind {
        case .match(let name, let sim): return "\(name) · güven %\(Int(sim * 100))"
        case .panic: return "Acil çağrı tetikleniyor"
        }
    }
}
