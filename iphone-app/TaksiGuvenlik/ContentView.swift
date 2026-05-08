import SwiftUI

/// Kök view. Login durumuna göre LoginView veya 3-sekmeli ana app.
struct ContentView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        ZStack {
            if state.loggedIn {
                MainTabsView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: state.loggedIn)
    }
}

/// Login sonrası ana yapı: ekran içeriği + alttan custom BottomNav.
struct MainTabsView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch state.tab {
                case .home:     HomeView()
                case .logs:     LogsView()
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            BottomNavView()
        }
        .ignoresSafeArea(.container, edges: .top) // header lacivert üstten taşar
    }
}

#Preview("Login") {
    ContentView().environment(AppState())
}

#Preview("Logged in") {
    let s = AppState(); s.loggedIn = true
    return ContentView().environment(s)
}
