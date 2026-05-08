import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var state

    private var todayTrips: [TripLog] { SampleData.todayTrips }
    private var recent: [TripLog] { Array(SampleData.trips.prefix(3)) }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                cameraSection
                recentTripsSection
            }
            .padding(.bottom, 100) // bottom nav payı
        }
        .background(Color.white)
        .ignoresSafeArea(edges: .top)
    }

    // MARK: - Header (lacivert gradient)

    private var header: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("VARDİYA AKTİF")
                        .font(.system(size: 12, weight: .medium))
                        .tracking(0.5)
                        .foregroundStyle(Color.white.opacity(0.65))

                    Text("Merhaba, \(state.firstName)")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.top, 4)

                    HStack(spacing: 5) {
                        Image(systemName: "mappin.and.ellipse")
                            .font(.system(size: 10))
                        Text("Beşiktaş, İstanbul · 6 sa 12 dk")
                            .font(.system(size: 13))
                    }
                    .foregroundStyle(Color.white.opacity(0.7))
                    .padding(.top, 4)
                }
                Spacer()

                ZStack(alignment: .topTrailing) {
                    Circle()
                        .fill(Color.white.opacity(0.12))
                        .frame(width: 40, height: 40)
                        .overlay(
                            Image(systemName: "bell.fill")
                                .font(.system(size: 16))
                                .foregroundStyle(.white)
                        )
                    Circle()
                        .fill(Color.warnRed)
                        .frame(width: 8, height: 8)
                        .overlay(Circle().stroke(Color.navy2, lineWidth: 1.5))
                        .offset(x: -9, y: 8)
                }
            }

            HStack(spacing: 10) {
                StatCard(label: "Bugün yolculuk",
                         value: "\(todayTrips.count)",
                         valueColor: .white)
                StatCard(label: "Temiz",
                         value: "\(SampleData.todayClean)",
                         valueColor: .okGreenLight)
                StatCard(label: "Şüpheli",
                         value: "\(SampleData.todayFlagged)",
                         valueColor: SampleData.todayFlagged > 0 ? .warnRedLight : .white)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 60)
        .padding(.bottom, 24)
        .background(LinearGradient.navyHeader)
    }

    // MARK: - Canlı kamera

    private var cameraSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Canlı Kamera")
            CameraView()
        }
        .padding(.horizontal, 20)
        .padding(.top, 24)
    }

    // MARK: - Son yolculuklar

    private var recentTripsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeader(title: "Son Yolculuklar",
                          actionTitle: "Tümünü gör",
                          action: { state.tab = .logs })

            VStack(spacing: 0) {
                ForEach(Array(recent.enumerated()), id: \.element.id) { idx, log in
                    MiniLogRow(log: log)
                    if idx < recent.count - 1 {
                        Divider().background(Color.divider)
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 4)
            .background(.white)
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }
}

// MARK: - Header'daki istatistik kartı

struct StatCard: View {
    let label: String
    let value: String
    let valueColor: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .tracking(0.3)
                .foregroundStyle(Color.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.12), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Bölüm başlığı

struct SectionHeader: View {
    let title: String
    var actionTitle: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack {
            Text(title)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(Color.navy)
                .tracking(-0.2)
            Spacer()
            if let actionTitle, let action {
                Button(action: action) {
                    HStack(spacing: 4) {
                        Text(actionTitle)
                            .font(.system(size: 13, weight: .semibold))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Color.navyAccent)
                }
            }
        }
    }
}

// MARK: - Home ekranındaki mini log satırı

private struct MiniLogRow: View {
    let log: TripLog

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(log.status == .flagged
                          ? Color.warnRed.opacity(0.10)
                          : Color.okGreen.opacity(0.10))
                Image(systemName: log.status == .flagged
                      ? "exclamationmark.shield.fill"
                      : "checkmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(log.status == .flagged ? Color.warnRed : Color.okGreen)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(log.pickupTime)
                        .foregroundStyle(Color.navy)
                    Text("→")
                        .foregroundStyle(Color.textMuted)
                    Text(log.dropoffTime)
                        .foregroundStyle(Color.navy)
                }
                .font(.system(size: 13, weight: .bold))

                HStack(spacing: 4) {
                    Image(systemName: "mappin")
                        .font(.system(size: 9))
                    Text("\(log.pickupShort) → \(log.dropoffShort)")
                        .lineLimit(1)
                }
                .font(.system(size: 11.5))
                .foregroundStyle(Color.textMuted)
            }
            Spacer()

            Text(log.status.label.uppercased())
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(log.status == .flagged ? Color.warnRed : Color.okGreen)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    (log.status == .flagged ? Color.warnRed : Color.okGreen).opacity(0.10)
                )
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
    }
}

#Preview {
    let s = AppState(); s.loggedIn = true
    return MainTabsView().environment(s)
}
