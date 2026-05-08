import SwiftUI

/// Logs ekranındaki ayrıntılı yolculuk kartı.
/// Şüpheli yolcuda yüz thumb gösterir, anonim yolcuda dashed "ANONİM" kutusu.
struct TripCard: View {
    let log: TripLog

    private var flagged: Bool { log.status == .flagged }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if flagged {
                FlaggedFaceThumb()
            } else {
                AnonPassengerThumb()
            }

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                        Text("\(log.pickupTime) – \(log.dropoffTime)")
                    }
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.navy)

                    Spacer()

                    HStack(spacing: 4) {
                        if flagged {
                            Image(systemName: "exclamationmark.shield.fill")
                                .font(.system(size: 10, weight: .bold))
                        }
                        Text(log.status.label.uppercased())
                            .font(.system(size: 10, weight: .bold))
                            .tracking(0.4)
                    }
                    .foregroundStyle(flagged ? Color.warnRed : Color.okGreen)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background((flagged ? Color.warnRed : Color.okGreen).opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 5))
                }

                // Konum çubukları
                ZStack(alignment: .leading) {
                    // Dikey nokta çizgi
                    Rectangle()
                        .fill(Color(white: 0.85))
                        .frame(width: 1.5)
                        .padding(.leading, 5.5)
                        .padding(.vertical, 14)

                    VStack(alignment: .leading, spacing: 6) {
                        RoutePoint(kind: .pickup, location: log.pickup)
                        RoutePoint(kind: .dropoff, location: log.dropoff)
                    }
                }
                .padding(.top, 10)

                // Alt bilgi
                HStack(spacing: 12) {
                    Text("Güven %\(log.confidence)")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.textMuted)
                    if flagged, let reason = log.flagReason {
                        Text("· \(reason)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color.warnRed)
                            .lineLimit(1)
                    }
                    Spacer()
                }
                .padding(.top, 10)
                .overlay(
                    Rectangle().fill(Color.divider).frame(height: 1),
                    alignment: .top
                )
            }
        }
        .padding(14)
        .background(.white)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(flagged
                        ? Color.warnRed.opacity(0.35)
                        : Color.divider,
                        lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Subviews

private struct RoutePoint: View {
    enum Kind { case pickup, dropoff }
    let kind: Kind
    let location: String

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(kind == .pickup ? Color.okGreen : Color.navy)
                .frame(width: 12, height: 12)
                .overlay(Circle().stroke(.white, lineWidth: 2))
                .overlay(
                    Circle().stroke(kind == .pickup ? Color.okGreen : Color.navy, lineWidth: 1.5)
                        .padding(-1.5)
                )
            Text(kind == .pickup ? "Biniş:" : "İniş:")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.textMuted)
            Text(location)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.navy)
                .lineLimit(1)
        }
    }
}

/// Şüpheli yolcuda gösterilen yüz thumbnail (mock — üretimde gerçek kamera yakalaması).
struct FlaggedFaceThumb: View {
    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                LinearGradient(
                    colors: [Color(red: 26/255, green: 37/255, blue: 64/255),
                             Color(red: 10/255, green: 22/255, blue: 40/255)],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
                // Basit yüz silüeti
                GeometryReader { _ in
                    Canvas { ctx, size in
                        let w = size.width, h = size.height
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: 0.30*w, y: 0.16*h, width: 0.40*w, height: 0.46*h)),
                            with: .color(Color(red: 232/255, green: 184/255, blue: 148/255).opacity(0.7))
                        )
                        var hairPath = Path()
                        hairPath.move(to: CGPoint(x: 0.30*w, y: 0.36*h))
                        hairPath.addQuadCurve(to: CGPoint(x: 0.50*w, y: 0.16*h),
                                              control: CGPoint(x: 0.30*w, y: 0.18*h))
                        hairPath.addQuadCurve(to: CGPoint(x: 0.70*w, y: 0.36*h),
                                              control: CGPoint(x: 0.70*w, y: 0.18*h))
                        ctx.fill(hairPath, with: .color(Color(red: 40/255, green: 30/255, blue: 18/255).opacity(0.85)))
                        var bodyPath = Path()
                        bodyPath.move(to: CGPoint(x: 0.25*w, y: 0.90*h))
                        bodyPath.addQuadCurve(to: CGPoint(x: 0.50*w, y: 0.66*h),
                                              control: CGPoint(x: 0.25*w, y: 0.70*h))
                        bodyPath.addQuadCurve(to: CGPoint(x: 0.75*w, y: 0.90*h),
                                              control: CGPoint(x: 0.75*w, y: 0.70*h))
                        ctx.fill(bodyPath, with: .color(Color(red: 40/255, green: 60/255, blue: 90/255).opacity(0.85)))
                    }
                }
            }
            .frame(width: 56, height: 56)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.warnRed, lineWidth: 2)
            )

            Image(systemName: "exclamationmark.shield.fill")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
                .padding(4)
                .background(Color.warnRed)
                .clipShape(Circle())
                .overlay(Circle().stroke(.white, lineWidth: 2))
                .offset(x: 4, y: 4)
        }
    }
}

/// Anonim yolcu — boş, dashed "ANONİM" kutusu (KVKK ilkesini görsel olarak vurgular).
struct AnonPassengerThumb: View {
    var body: some View {
        Text("ANONİM")
            .font(.system(size: 9, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(Color(red: 160/255, green: 170/255, blue: 194/255))
            .frame(width: 56, height: 56)
            .background(Color.surface)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color(red: 200/255, green: 208/255, blue: 222/255),
                                  style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
            )
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

#Preview {
    VStack(spacing: 12) {
        TripCard(log: SampleData.trips[2]) // flagged
        TripCard(log: SampleData.trips[0]) // clean
    }
    .padding()
    .background(Color.surface)
}
