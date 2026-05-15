import SwiftUI

/// Top-level switch: while auth.bootstrap() runs we show a splash spinner;
/// then either the login/register flow or the tabbed home shell.
struct RootView: View {
    @Environment(AuthManager.self) private var auth
    @State private var showRegister = false

    var body: some View {
        switch auth.status {
        case .checking:
            ZStack {
                AppTheme.background.ignoresSafeArea()
                VStack(spacing: 16) {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 48))
                        .foregroundStyle(AppTheme.accent)
                    ProgressView().tint(.white)
                }
            }
        case .loggedOut:
            if showRegister {
                RegisterView(goToLogin: { showRegister = false })
            } else {
                LoginView(goToRegister: { showRegister = true })
            }
        case .loggedIn:
            HomeView()
        }
    }
}
