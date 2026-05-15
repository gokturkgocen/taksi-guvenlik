import SwiftUI

/// Tab shell for the logged-in user. Scan stays as the core feature but is
/// now one tab among three so the app feels like a finished product instead
/// of a single debug screen.
struct HomeView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Ana Sayfa", systemImage: "house.fill") }

            ScanView()
                .tabItem { Label("Tarama", systemImage: "viewfinder") }

            ProfileView()
                .tabItem { Label("Profil", systemImage: "person.crop.circle.fill") }
        }
        .tint(AppTheme.accent)
        .preferredColorScheme(.dark)
    }
}
