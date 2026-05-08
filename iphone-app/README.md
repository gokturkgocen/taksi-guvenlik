# Taksi Güvenlik — iPhone App

SwiftUI native iOS uygulaması. HM-10 BLE modülünden gelen `MATCH:<name>;<sim>` veya
`PANIC` sinyalini dinler, `tel://` URL'iyle iPhone dialer'ını açar.

## Mimari

```
┌──────────┐   USB     ┌────────┐   UART    ┌───────┐  BLE   ┌─────────────┐
│ Mac      │ ────────► │ STM32  │ ────────► │ HM-10 │ ─────► │ iPhone (bu) │
│ Python   │ MATCH:... │ F767ZI │           │  BLE  │        │ CoreBluetoth│
└──────────┘           └────────┘           └───────┘        └──────┬──────┘
                                                                    │ tel://
                                                                    ▼
                                                              [SIM dialer]
```

## ⚠️ iOS programatik arama kısıtı

Apple güvenlik politikası gereği iOS uygulaması **otomatik arama yapamaz**.
`tel://` URL'i dialer'ı açar, kullanıcı bir tık ile aramayı **onaylar**.

Tezde savunulur: "iOS sandbox tek-tık onayı zorunlu kılar; bu yanlış pozitif arama
ihtimalini ortadan kaldırarak güvenliği artırır."

## Dosya yapısı

```
iphone-app/
├── README.md                      # bu dosya
├── TaksiGuvenlik/                 # Swift kaynakları (Xcode projesine eklenecek)
│   ├── TaksiGuvenlikApp.swift     # @main entry point
│   ├── ContentView.swift          # kök view (login/main router)
│   ├── AppState.swift             # @Observable global state
│   ├── AppColors.swift            # renk paleti
│   ├── TripLog.swift              # veri modeli
│   ├── SampleData.swift           # mock yolculuk verisi
│   ├── LoginView.swift            # giriş ekranı
│   ├── HomeView.swift             # ana ekran (canlı kamera + son yolculuklar)
│   ├── LogsView.swift             # tüm yolculuk geçmişi
│   ├── SettingsView.swift         # profil + ayarlar
│   ├── BottomNavView.swift        # alt nav (3 sekme + sarı taksi FAB)
│   ├── CameraView.swift           # mock canlı kamera (ileride MJPEG)
│   ├── TripCard.swift             # detaylı yolculuk kartı + thumb'lar
│   ├── BLEManager.swift           # CoreBluetooth + HM-10 protokolü
│   ├── Info.plist                 # izinler ve config
│   └── Assets.xcassets/
│       ├── Taxi.imageset/         # taxi.png (login ekranı)
│       └── AppIcon.appiconset/
```

## Xcode projesi oluşturma (ilk seferinde)

1. **Xcode 15.0+** aç (App Store'dan)
2. **File → New → Project**
3. iOS → **App** → Next
4. Ayarlar:
   - Product Name: `TaksiGuvenlik`
   - Team: kendi Apple ID'n (ücretsiz hesap, 7 günlük cert verir)
   - Organization Identifier: `com.gokturk` (veya kendi ters domain'in)
   - Interface: **SwiftUI**
   - Language: **Swift**
   - Storage: **None**
   - Include Tests: ✗ (istemiyorsan)
5. Kaydet — istediğin yere, **`/Users/gokturkgocen/Bitirme/iphone-app/`** içinde olmasın.
   Xcode kendi temiz projesini oluştursun.
6. Xcode'un default oluşturduğu `ContentView.swift` ve `TaksiGuvenlikApp.swift`'i sil.
7. Bu klasördeki (`/Users/gokturkgocen/Bitirme/iphone-app/TaksiGuvenlik/`) **tüm Swift
   dosyalarını ve `Assets.xcassets` klasörünü** Xcode'un Project Navigator'una sürükle
   (Copy items if needed: ✓, Create groups: ✓, Targets: TaksiGuvenlik ✓).
8. `Info.plist` özel — Xcode bunu generate eder. Bizim Info.plist'teki ayarları **manuel
   olarak** Project → TaksiGuvenlik target → Info sekmesinden ekle (aşağıda detay).
9. Project → TaksiGuvenlik target → General:
   - Minimum Deployments: **iOS 17.0**
   - Bundle Identifier: `com.gokturk.taksiguvenlik`
   - Display Name: `Taksi Güvenlik`
10. Build (Cmd+B). Hata olmamalı.

### Info.plist ayarları (Xcode UI'dan)

Project → TaksiGuvenlik target → **Info** sekmesi → Custom iOS Target Properties'e
şu satırları **+ ile ekle**:

| Key | Type | Value |
|---|---|---|
| `Privacy - Bluetooth Always Usage Description` | String | `HM-10 BLE modülünden MATCH ve PANIC sinyallerini dinlemek için.` |
| `Privacy - Bluetooth Peripheral Usage Description` | String | `HM-10 BLE modülü ile haberleşmek için.` |
| `Required background modes` | Array | `App communicates using CoreBluetooth` (`bluetooth-central`) |
| `LSApplicationQueriesSchemes` | Array | `tel` (string item) |

Veya daha kolay: Build Settings → "Generated Info.plist" → No yap, sonra
`Info.plist`'i Project Navigator'a sürükle, target'a ekle.

## İlk derleme & cihazda çalıştırma

1. iPhone'u USB ile Mac'e bağla
2. iPhone Settings → Privacy & Security → **Developer Mode** → On (cihaz reset ister)
3. Xcode → top bar'da target cihaz seç (kendi iPhone'un)
4. **Cmd+R** ile çalıştır
5. İlk seferinde iPhone'da Settings → General → VPN & Device Management →
   senin Apple ID → **Trust**
6. App açılır, login ekranı görünür
7. Default değerlerle "Vardiyaya başla" → ana ekran

## BLE testi (HM-10 hazırsa)

1. STM32 firmware flash'lanmış, HM-10 PC6/PC7'ye bağlı, advertise ediyor olmalı
2. iPhone Settings → Bluetooth → açık
3. App'i aç → BLEManager otomatik scan başlatır
4. HM-10 görünürse pairing onayı çıkabilir (PIN: `000000`)
5. Bağlanınca console'da:
   ```
   [BLE] connected
   [BLE] <- HB
   [BLE] <- HB
   ```
6. STM32'ye Mac'ten test: `echo "MATCH:Test;0.85" > /dev/tty.usbmodemXXXX`
7. iPhone dialer açılmalı, test numarası önceden yazılmış halde

## Mevcut kısıtlar (V1 prototip)

- **Login** mock — gerçek auth yok, herhangi bir bilgi giriliyor
- **Canlı kamera** mock — silüet görünüyor, gerçek MJPEG stream yok (Mac'in HTTP
  server'ı eklenince WebView veya AVFoundation ile bağlanabilir)
- **Yolculuk verisi** mock — `SampleData.swift`'te sabit, gerçek tracking yok
- **BLE arka plan** sınırlı — iPhone screen kapalıyken iOS BLE'yi yavaşlatır.
  Üretim için: foreground service + push notification + Background Bluetooth Mode

## Sonraki adımlar (sırayla)

1. **HM-10 alındığında** BLE manager'ı gerçek cihazla test et
2. **Acil çağrı UI** ekle — full-screen takeover when `activeAlert != nil`
   (büyük "ARA" butonu + 5 saniye countdown otomatik tap simülasyonu)
3. **Mac → iPhone canlı kamera** — Mac'te basit Flask MJPEG server, iPhone
   `WKWebView` veya `AVPlayer` ile gösterir
4. **Vardiya tracking** — start/end shift, GPS ile yolculuk kaydı
5. **Push bildirimi** — APNs ile arka planda da MATCH alabilsin (production scenario)
6. **App Icon** — gerçek 1024×1024 PNG, ücretsiz: bgenerator.io

## Tezde savunulacak noktalar

- **Native iOS app**: SwiftUI ile sıfırdan yazıldı, hibrit (RN/Flutter) değil
- **CoreBluetooth**: HM-10 generic UART servisi (FFE0/FFE1) standart yaklaşım
- **iOS güvenlik kısıtı**: tel:// + tek-tık onay = yanlış-pozitif koruma katmanı
- **KVKK uyumlu UI**: anonim yolcu görünümü vurgulanır (TripCard "ANONİM" thumb)
- **Foreground BLE limit**: arka plan stratejisi açıklanır, üretimde APNs çözümü
