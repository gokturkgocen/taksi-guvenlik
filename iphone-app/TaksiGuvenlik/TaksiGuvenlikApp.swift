import SwiftUI

@main
struct TaksiGuvenlikApp: App {
    @State private var appState = AppState()
    @State private var auth = AuthManager()
    @StateObject private var ble = BLEManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .environment(auth)
                .task {
                    // Wire BLE → AppState once; subsequent events flow through.
                    ble.appState = appState
                    await auth.bootstrap()
                }
                .preferredColorScheme(.dark)
        }
    }
}
