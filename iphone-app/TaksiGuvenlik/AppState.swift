import SwiftUI
import Foundation

/// Single shared state object for the minimal taxi-safety client.
/// BLEManager writes here whenever a line arrives from the ESP32-CAM BLE
/// peripheral; ContentView observes the same instance via @Environment.
@Observable
final class AppState {
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
}

struct LogEntry: Identifiable, Hashable {
    let id = UUID()
    let text: String
    let timestamp: Date
}
