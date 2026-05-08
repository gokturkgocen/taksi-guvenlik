import SwiftUI

/// Mock canlı kamera görünümü. Tasarımdaki yolcu silueti + tanıma çerçevesi
/// + CANLI rozet + alt durum şeridi.
///
/// Üretimde Mac'in yayınladığı MJPEG stream'ini alıp burada gösterecek.
/// Şu an placeholder.
struct CameraView: View {
    @State private var pulseAnim = false

    var body: some View {
        ZStack {
            // Arka plan koyu gradient (taksi içi karanlık hissi)
            LinearGradient(
                colors: [Color(red: 26/255, green: 37/255, blue: 64/255),
                         Color(red: 10/255, green: 22/255, blue: 40/255)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            // Yolcu silueti (basit SVG-vari path)
            GeometryReader { geo in
                Canvas { ctx, size in
                    let w = size.width, h = size.height

                    // Gövde (omuz - boyun bölgesi)
                    var bodyPath = Path()
                    bodyPath.move(to: CGPoint(x: 0.3*w, y: 1.0*h))
                    bodyPath.addQuadCurve(to: CGPoint(x: 0.5*w, y: 0.66*h),
                                          control: CGPoint(x: 0.3*w, y: 0.73*h))
                    bodyPath.addQuadCurve(to: CGPoint(x: 0.7*w, y: 1.0*h),
                                          control: CGPoint(x: 0.7*w, y: 0.73*h))
                    ctx.fill(bodyPath, with: .color(Color(red: 40/255, green: 60/255, blue: 90/255).opacity(0.7)))

                    // Yüz oval
                    let faceRect = CGRect(x: 0.39*w, y: 0.36*h, width: 0.22*w, height: 0.34*h)
                    ctx.fill(Path(ellipseIn: faceRect),
                             with: .color(Color(red: 232/255, green: 184/255, blue: 148/255).opacity(0.85)))

                    // Saç
                    var hairPath = Path()
                    hairPath.move(to: CGPoint(x: 0.39*w, y: 0.50*h))
                    hairPath.addQuadCurve(to: CGPoint(x: 0.50*w, y: 0.36*h),
                                          control: CGPoint(x: 0.39*w, y: 0.37*h))
                    hairPath.addQuadCurve(to: CGPoint(x: 0.61*w, y: 0.50*h),
                                          control: CGPoint(x: 0.61*w, y: 0.37*h))
                    hairPath.addLine(to: CGPoint(x: 0.60*w, y: 0.47*h))
                    hairPath.addQuadCurve(to: CGPoint(x: 0.50*w, y: 0.46*h),
                                          control: CGPoint(x: 0.55*w, y: 0.45*h))
                    hairPath.addQuadCurve(to: CGPoint(x: 0.40*w, y: 0.47*h),
                                          control: CGPoint(x: 0.45*w, y: 0.45*h))
                    hairPath.closeSubpath()
                    ctx.fill(hairPath, with: .color(Color(red: 60/255, green: 42/255, blue: 24/255).opacity(0.85)))
                }
            }

            // Yüz tanıma çerçevesi (4 köşe)
            FaceFrame()

            // Üst rozetler ve alt durum
            VStack {
                HStack(alignment: .top) {
                    LiveBadge(pulseAnim: $pulseAnim)
                    Spacer()
                    LocationBadge()
                }
                .padding(12)

                Spacer()

                StatusBar()
                    .padding(12)
            }
        }
        .aspectRatio(4.0/3.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: Color.navy.opacity(0.18), radius: 12, y: 6)
        .onAppear {
            withAnimation(.easeInOut(duration: 1.4).repeatForever()) {
                pulseAnim.toggle()
            }
        }
    }
}

private struct FaceFrame: View {
    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width, h = geo.size.height
            let frame = CGRect(x: 0.32*w, y: 0.28*h, width: 0.36*w, height: 0.46*h)
            ZStack {
                Corner(.topLeft).position(x: frame.minX + 10, y: frame.minY + 10)
                Corner(.topRight).position(x: frame.maxX - 10, y: frame.minY + 10)
                Corner(.bottomLeft).position(x: frame.minX + 10, y: frame.maxY - 10)
                Corner(.bottomRight).position(x: frame.maxX - 10, y: frame.maxY - 10)
            }
        }
    }

    private enum CornerPos { case topLeft, topRight, bottomLeft, bottomRight }

    private struct Corner: View {
        let pos: CornerPos
        init(_ pos: CornerPos) { self.pos = pos }
        var body: some View {
            ZStack {
                Rectangle()
                    .fill(Color.taxiYellow)
                    .frame(width: 20, height: 3)
                    .offset(y: pos == .topLeft || pos == .topRight ? -8.5 : 8.5)
                Rectangle()
                    .fill(Color.taxiYellow)
                    .frame(width: 3, height: 20)
                    .offset(x: pos == .topLeft || pos == .bottomLeft ? -8.5 : 8.5)
            }
        }
    }
}

private struct LiveBadge: View {
    @Binding var pulseAnim: Bool

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(.white)
                .frame(width: 6, height: 6)
                .opacity(pulseAnim ? 0.4 : 1.0)
                .scaleEffect(pulseAnim ? 0.8 : 1.0)
            Text("CANLI")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.8)
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.warnRed.opacity(0.95))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

private struct LocationBadge: View {
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: "mappin").font(.system(size: 11))
            Text("Beşiktaş").font(.system(size: 11, weight: .semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

private struct StatusBar: View {
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("DURUM")
                    .font(.system(size: 11, weight: .medium))
                    .tracking(0.5)
                    .foregroundStyle(Color.white.opacity(0.7))
                Text("Yolcu taranıyor…")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
            }
            Spacer()
            HStack(spacing: 6) {
                Image(systemName: "checkmark")
                    .font(.system(size: 12, weight: .bold))
                Text("Temiz")
                    .font(.system(size: 12, weight: .bold))
            }
            .foregroundStyle(Color.okGreenLight)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.okGreen.opacity(0.25))
            .overlay(
                Capsule().stroke(Color.okGreen.opacity(0.5), lineWidth: 1)
            )
            .clipShape(Capsule())
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial.opacity(0.75))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    CameraView().padding()
}
