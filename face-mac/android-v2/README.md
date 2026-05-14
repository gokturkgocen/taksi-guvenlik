# TaxiGuard — Android v2 Scaffold

Kotlin + Jetpack Compose tabanlı BLE central uygulaması. HM-10 BLE modülü
üzerinden STM32'den gelen `MATCH:..\n` çerçevesini yakalayıp otomatik
**155 Polis İmdat** araması başlatır.

Bu klasör donanım yokken de açılıp build edilebilecek bir **iskelet**.
Uygulamanın çekirdek akışı (BLE → frame parse → 155 dial) tam yazıldı;
HM-10 elde olmayınca **DEV: Simulate MATCH** butonuyla aynı akış tek
telefonda doğrulanabiliyor.

## Açma

```bash
# Android Studio Hedgehog (2023.1) veya sonrası
File → Open → face-mac/android-v2

# Veya komut satırından gradle wrapper'ı ilk kez üretmek için:
cd face-mac/android-v2
# (Android Studio sync sırasında wrapper'ı kendi indirir.)
```

Min SDK 26 (Android 8.0+). Test telefonu: Samsung Galaxy S20 FE (Android 13).

## Çalışma akışı

1. Uygulama açılır → izin ister: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`,
   `CALL_PHONE`, `POST_NOTIFICATIONS`.
2. Kullanıcı **"Servisi Başlat"** butonuna basar. `Hm10Service`
   foreground servis olarak ayağa kalkar.
3. Servis FFE0 service UUID'sini yayınlayan bir cihaz arar. HM-10 bulunca
   GATT bağlantısı kurar ve FFE1 karakteristiğine `setCharacteristicNotification`
   ile abone olur.
4. STM32'den UART2 üzerinden gönderilen ASCII satırlar BLE notification
   olarak gelir. `Hm10Service` her `\n` ile satırı keser, `FrameParser`
   ile parse eder, `EventBus`'a `MatchEvent` olarak yazar.
5. `MATCH:..` veya `PANIC` durumunda `EmergencyDialer.call()` →
   `Intent.ACTION_CALL("tel:155")` ile otomatik arama.

## Dev mode (donanım yokken test)

Ekrandaki **"DEV: Simulate MATCH"** butonu, `Hm10Service`'e
`ACTION_SIMULATE_MATCH` intent'i gönderir; servis kendine sahte
`MATCH:Test_Subject;0.95` satırı işler. Böylece:

- HM-10 olmadan da BLE servisin parse + dial akışını test edebilirsin
- 155 araması tetikleniyor mu, telefonda canlı görürsün (Önemli not:
  `CALL_PHONE` izni verilmemişse `ACTION_DIAL`'a fallback yapar — dialer
  açılır ama otomatik tuşlanmaz; bu hata değil, izin yoksa Android'in
  davranışı bu).

## Mimari özet

```
HM-10 (BLE FFE1 notify)
        │ ASCII lines, terminated by \n
        ▼
Hm10Service (Foreground, CONNECTED_DEVICE)
  ├─ BluetoothLeScanner          ← FFE0 ServiceUuid filter
  ├─ BluetoothGatt (central)
  ├─ lineBuffer + absorbChunk()  ← MTU-safe per-line accumulator
  ├─ FrameParser.parse(line)     ← MATCH / NOMATCH / PANIC / NETERR / HB
  ├─ EventBus.emit(MatchEvent)   ← UI subscribes
  └─ EmergencyDialer.call()      ← Intent.ACTION_CALL on MATCH | PANIC

UI (Compose, single screen)
  ├─ HomeScreen
  │    ConnectionBanner   ← EventBus.connection (StateFlow)
  │    LastMatchCard      ← EventBus.lastMatch  (StateFlow)
  │    Controls           ← Start / Stop / Simulate
  │    EventLog           ← EventBus.events     (SharedFlow, in-memory)
  └─ TaxiGuardTheme        ← navy/brass palette, matches poster
```

## Dosya haritası

```
android-v2/
├── build.gradle.kts                 # AGP 8.2 / Kotlin 1.9 / Compose Compiler plugin
├── settings.gradle.kts
├── gradle.properties
├── app/
│   ├── build.gradle.kts             # min SDK 26, target 34, BOM 2024.02
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml      # permissions + service declaration
│       ├── kotlin/com/taxiguard/
│       │   ├── TaxiGuardApp.kt
│       │   ├── MainActivity.kt
│       │   ├── ble/
│       │   │   ├── BleConstants.kt
│       │   │   └── Hm10Service.kt   # foreground, scan + GATT + dispatch
│       │   ├── protocol/
│       │   │   ├── MatchEvent.kt
│       │   │   └── FrameParser.kt
│       │   ├── dial/
│       │   │   └── EmergencyDialer.kt
│       │   ├── state/
│       │   │   └── EventBus.kt      # StateFlow + SharedFlow singletons
│       │   └── ui/
│       │       ├── HomeScreen.kt
│       │       └── theme/Theme.kt
│       └── res/
│           ├── values/strings.xml, themes.xml
│           ├── drawable/ic_notif.xml, ic_launcher_*
│           └── mipmap-anydpi-v26/ic_launcher.xml
```

## TODO (donanım gelince)

1. Gerçek HM-10 MAC adresine bağlanma (şu an servis UUID'sine güveniyor;
   birden çok HM modülü ortamda varsa MAC filtre eklenmeli).
2. Foreground servisin reconnect davranışını gerçek "menzil dışına çık,
   geri gel" senaryosunda profilleyip backoff'u ayarla.
3. Logs ekranını ayrı bir route'a taşı (BottomNav: Home / Logs / Settings).
4. Settings: emergency number override (test ortamında 155 yerine 5xx...).
5. Sergi öncesi `applicationId` ve imza yapılandırması.

## Bağımlılıklar

- Compose BOM 2024.02.02
- AndroidX activity-compose, lifecycle-runtime-compose, lifecycle-service
- Material 3
- Hiçbir BLE kütüphanesi (Nordic-Android-BLE-Library, vb.) kullanılmadı —
  AOSP framework API'leri yeterli; bağımlılık yükünü düşük tuttuk.

Co-locates with the rest of the thesis project at
`face-mac/CLAUDE.md` and `face-mac/server/`.
