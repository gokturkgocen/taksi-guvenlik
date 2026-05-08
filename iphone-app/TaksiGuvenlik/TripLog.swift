import Foundation

/// Yolculuk kaydı. Yolcular anonim — sadece şüpheli (aranan kişi) eşleşmesinde
/// kameradan çekilen yüz saklanır. Aksi halde sadece zaman + konum + güven.
struct TripLog: Identifiable, Hashable {
    enum Status: String, Hashable {
        case clean    // temiz, anonim
        case flagged  // şüpheli, aranan kişi eşleşmesi

        var label: String {
            switch self {
            case .clean: return "Temiz"
            case .flagged: return "Şüpheli"
            }
        }
    }

    let id: Int
    let date: String         // "04 May 2026"
    let pickupTime: String   // "14:23"
    let dropoffTime: String  // "14:51"
    let pickup: String       // "Beşiktaş, İstanbul"
    let dropoff: String      // "Şişli, İstanbul"
    let status: Status
    let confidence: Int      // 0-100
    let flagReason: String?  // sadece flagged için
}

extension TripLog {
    /// Konum kısa adı (virgülden öncesi).
    var pickupShort: String { pickup.components(separatedBy: ",").first ?? pickup }
    var dropoffShort: String { dropoff.components(separatedBy: ",").first ?? dropoff }
}
