import SwiftUI

struct LogsView: View {
    @State private var filter: Filter = .all
    @State private var search: String = ""

    private enum Filter: String, CaseIterable, Hashable {
        case all = "Tümü", clean = "Temiz", flagged = "Şüpheli"
    }

    private var filtered: [TripLog] {
        SampleData.trips.filter { log in
            let matchesFilter: Bool
            switch filter {
            case .all: matchesFilter = true
            case .clean: matchesFilter = log.status == .clean
            case .flagged: matchesFilter = log.status == .flagged
            }
            guard matchesFilter else { return false }
            if search.isEmpty { return true }
            let q = search.lowercased()
            return log.pickup.lowercased().contains(q) ||
                   log.dropoff.lowercased().contains(q)
        }
    }

    private var grouped: [(date: String, logs: [TripLog])] {
        // Tarih sırasına göre grupla, tarih sıralaması veride mevcut
        var seen: [String: [TripLog]] = [:]
        var order: [String] = []
        for log in filtered {
            if seen[log.date] == nil { order.append(log.date) }
            seen[log.date, default: []].append(log)
        }
        return order.map { ($0, seen[$0] ?? []) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                header
                filterChips
                tripsList
            }
            .padding(.bottom, 100)
        }
        .background(Color.surface)
        .ignoresSafeArea(edges: .top)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("GEÇMİŞ")
                    .font(.system(size: 12, weight: .medium))
                    .tracking(0.5)
                    .foregroundStyle(Color.white.opacity(0.65))
                Text("Yolculuk Kayıtları")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(.white)
                Text("\(SampleData.trips.count) yolculuk · son 7 gün")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.white.opacity(0.7))
            }

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white.opacity(0.7))
                TextField("", text: $search,
                          prompt: Text("Konuma göre ara…")
                            .foregroundStyle(Color.white.opacity(0.55)))
                    .font(.system(size: 14))
                    .foregroundStyle(.white)
                    .autocorrectionDisabled()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(Color.white.opacity(0.12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal, 24)
        .padding(.top, 60)
        .padding(.bottom, 20)
        .background(LinearGradient.navyHeader)
    }

    // MARK: - Filtre chip'leri

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Filter.allCases, id: \.self) { f in
                    let count = countFor(f)
                    let active = filter == f
                    Button {
                        filter = f
                    } label: {
                        HStack(spacing: 4) {
                            Text(f.rawValue)
                            Text("\(count)")
                                .opacity(active ? 0.7 : 0.5)
                        }
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 7)
                        .foregroundStyle(active ? .white : Color.navy)
                        .background(active ? Color.navy : .clear)
                        .overlay(
                            Capsule().stroke(active ? Color.navy : Color(white: 0.88), lineWidth: 1)
                        )
                        .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        .background(Color.white)
        .overlay(
            Rectangle().fill(Color.divider).frame(height: 1),
            alignment: .bottom
        )
    }

    private func countFor(_ f: Filter) -> Int {
        switch f {
        case .all: return SampleData.trips.count
        case .clean: return SampleData.trips.filter { $0.status == .clean }.count
        case .flagged: return SampleData.trips.filter { $0.status == .flagged }.count
        }
    }

    // MARK: - Liste

    private var tripsList: some View {
        VStack(alignment: .leading, spacing: 0) {
            if grouped.isEmpty {
                Text("Eşleşen yolculuk bulunamadı")
                    .font(.system(size: 14))
                    .foregroundStyle(Color.textMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
            } else {
                ForEach(grouped, id: \.date) { group in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(group.date.uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .tracking(0.8)
                            .foregroundStyle(Color.textMuted)
                            .padding(.horizontal, 8)
                            .padding(.bottom, 8)

                        ForEach(group.logs) { log in
                            TripCard(log: log)
                        }
                    }
                    .padding(.top, 16)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

#Preview {
    let s = AppState(); s.loggedIn = true; s.tab = .logs
    return MainTabsView().environment(s)
}
