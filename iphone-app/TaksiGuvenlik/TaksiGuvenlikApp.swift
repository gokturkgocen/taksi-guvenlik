import SwiftUI

@main
struct TaksiGuvenlikApp: App {
    @State private var appState = AppState()
    @StateObject private var ble: BLEManager

    init() {
        let manager = BLEManager()
        _ble = StateObject(wrappedValue: manager)
    }

    var body: some Scene {
        WindowGroup {
            ContentView(ble: ble)
                .environment(appState)
                .onAppear {
                    // Wire BLE → AppState so incoming events update the UI.
                    ble.appState = appState
                }
                .preferredColorScheme(.dark)
        }
    }
}
