import Foundation

/// Demo amaçlı sahte yolculuk verisi. Üretimde BLE üzerinden gelen
/// MATCH/PANIC olayları + yerel trip tracking ile değiştirilecek.
enum SampleData {
    static let trips: [TripLog] = [
        TripLog(id: 1, date: "04 May 2026",
                pickupTime: "14:23", dropoffTime: "14:51",
                pickup: "Beşiktaş, İstanbul", dropoff: "Şişli, İstanbul",
                status: .clean, confidence: 96, flagReason: nil),
        TripLog(id: 2, date: "04 May 2026",
                pickupTime: "13:41", dropoffTime: "14:08",
                pickup: "Kadıköy, İstanbul", dropoff: "Beşiktaş, İstanbul",
                status: .clean, confidence: 91, flagReason: nil),
        TripLog(id: 3, date: "04 May 2026",
                pickupTime: "12:55", dropoffTime: "13:18",
                pickup: "Levent, İstanbul", dropoff: "Maslak, İstanbul",
                status: .flagged, confidence: 87,
                flagReason: "Interpol kırmızı bülten eşleşmesi"),
        TripLog(id: 4, date: "04 May 2026",
                pickupTime: "11:14", dropoffTime: "11:32",
                pickup: "Mecidiyeköy, İstanbul", dropoff: "Nişantaşı, İstanbul",
                status: .clean, confidence: 94, flagReason: nil),
        TripLog(id: 5, date: "04 May 2026",
                pickupTime: "10:08", dropoffTime: "10:47",
                pickup: "Bakırköy, İstanbul", dropoff: "Beşiktaş, İstanbul",
                status: .clean, confidence: 93, flagReason: nil),
        TripLog(id: 6, date: "03 May 2026",
                pickupTime: "22:48", dropoffTime: "23:15",
                pickup: "Taksim, İstanbul", dropoff: "Sarıyer, İstanbul",
                status: .flagged, confidence: 82,
                flagReason: "Yerel kolluk arananlar listesi"),
        TripLog(id: 7, date: "03 May 2026",
                pickupTime: "20:12", dropoffTime: "20:38",
                pickup: "Ortaköy, İstanbul", dropoff: "Beyoğlu, İstanbul",
                status: .clean, confidence: 89, flagReason: nil),
        TripLog(id: 8, date: "03 May 2026",
                pickupTime: "18:34", dropoffTime: "19:02",
                pickup: "Ataşehir, İstanbul", dropoff: "Üsküdar, İstanbul",
                status: .clean, confidence: 95, flagReason: nil),
        TripLog(id: 9, date: "03 May 2026",
                pickupTime: "16:21", dropoffTime: "16:54",
                pickup: "Bahçelievler, İstanbul", dropoff: "Levent, İstanbul",
                status: .clean, confidence: 88, flagReason: nil),
    ]

    /// Bugünün tarihi (sahte) — istatistik kartları için.
    static let today = "04 May 2026"

    static var todayTrips: [TripLog] { trips.filter { $0.date == today } }
    static var todayClean: Int { todayTrips.filter { $0.status == .clean }.count }
    static var todayFlagged: Int { todayTrips.filter { $0.status == .flagged }.count }
}
