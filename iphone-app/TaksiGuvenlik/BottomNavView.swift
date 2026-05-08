import SwiftUI

/// Alttan custom navigation: Geçmiş + ortada sarı taksi FAB + Ayarlar.
struct BottomNavView: View {
    @Environment(AppState.self) private var state

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            NavTab(
                label: "Geçmiş",
                systemImage: "list.bullet.rectangle",
                active: state.tab == .logs
            ) {
                state.tab = .logs
            }

            CenterTaxiTab(active: state.tab == .home) {
                state.tab = .home
            }

            NavTab(
                label: "Ayarlar",
                systemImage: "gearshape.fill",
                active: state.tab == .settings
            ) {
                state.tab = .settings
            }
        }
        .padding(.top, 10)
        .padding(.bottom, 24)
        .background(.white)
        .overlay(
            Rectangle().fill(Color.divider).frame(height: 1),
            alignment: .top
        )
    }
}

private struct NavTab: View {
    let label: String
    let systemImage: String
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 22))
                Text(label)
                    .font(.system(size: 11,
                                  weight: active ? .bold : .medium))
                    .tracking(0.2)
            }
            .foregroundStyle(active ? Color.navy : Color(red: 154/255, green: 165/255, blue: 189/255))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }
}

private struct CenterTaxiTab: View {
    let active: Bool
    let action: () -> Void

    var body: some View {
        VStack(spacing: 4) {
            Button(action: action) {
                ZStack {
                    Circle()
                        .fill(LinearGradient.taxiYellowFAB)
                        .frame(width: 64, height: 64)
                    Circle()
                        .stroke(.white, lineWidth: 4)
                        .frame(width: 64, height: 64)
                    Image(systemName: "car.side.fill")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(Color.navy)
                }
                .shadow(color: Color.taxiYellowDark.opacity(active ? 0.45 : 0.35),
                        radius: active ? 16 : 10, y: 8)
            }
            .offset(y: -28)

            Text("Ana Ekran")
                .font(.system(size: 11,
                              weight: active ? .bold : .medium))
                .foregroundStyle(active ? Color.navy : Color(red: 154/255, green: 165/255, blue: 189/255))
                .offset(y: -28)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 60)
    }
}

#Preview {
    let s = AppState(); s.loggedIn = true
    return MainTabsView().environment(s)
}
