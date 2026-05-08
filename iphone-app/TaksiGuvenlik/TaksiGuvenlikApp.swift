import SwiftUI

@main
struct TaksiGuvenlikApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .preferredColorScheme(.light) // tasarım sadece light mode
        }
    }
}
