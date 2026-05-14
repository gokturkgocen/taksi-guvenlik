# Taksi Güvenlik — Bitirme Projesi (FINAL ARCHITECTURE — Plan B v2)

> **Yeni bir oturum: ÖNCE bu dosyayı baştan sona oku.** Mimari kilitli, aksi yönde iş yapma.

## Oturum başı protokolü
1. Bu dosyayı baştan sona oku.
2. **Plan B v2** aktif: ESP32-CAM hem kamera+Wi-Fi hem BLE peripheral. HM-10 atıldı, STM32 sadece olay yönetimi yapıyor, telefon ESP-CAM'in BLE'sine bağlanıyor.
3. Rapor: `/Users/gokturkgocen/Bitirme/Ekin_Ag_aog_lu_Gelis_imRaporu.pdf` — Ege Üniversitesi gelişme raporu, **dondu, değiştirilemez.**
4. Kullanıcı Göktürk Göcen (gokturk@robodor.com). Partner Ekin Ağaoğlu, partner Mac `/Users/ekinagaoglu/bitirme/` altında çalışıyor.
5. Bu projede **Türkçe konuş** — global "İngilizce" kuralını ezer. Kod, commit mesajı, yorum yine İngilizce.
6. Her kod değişikliği commit + push edilmeli, anlamlı commit mesajı.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa burst ile tarayıp, EC2'de host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa şoförün iPhone'una BLE bildirim, otomatik **155** çağrı ekranı.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026).
**Danışman:** Aydoğan Savran.
**Test telefonu:** iPhone 16 (kullanıcının kendisi). Android (Samsung S20 FE) plan B, şu an kullanılmıyor.
**Geliştirme bilgisayarları:** Mac (kullanıcı `/Users/gokturkgocen/Bitirme/`), partner Mac (`/Users/ekinagaoglu/bitirme/`).

## Nihai mimari (kilitli)

```
                ┌──────────── ARAÇ İÇİ MODÜL ────────────┐
                │                                          │
   Yolcu yüzü ─► ESP32-CAM (AI-Thinker, OV3660)            │
                │  • 5 FPS × 2 s = 10 frame burst          │
                │  • Wi-Fi STA (telefon hotspot 4G/5G)     │
                │  • HTTP POST → EC2 (multi-frame agreg.)  │
                │  • BLE peripheral: "TaxiGuard"           │
                │     GATT service FFE0, char FFE1         │
                │     forwards STM events to phone         │
                │                                          │
                │   USART (Arduino D0/D1) 115200 ASCII     │
                │   "CAPTURE" / "RESULT:..." / events       │
                │                                          │
                ▼                                          │
   STM32 NUCLEO-F767ZI (HSI×PLL → 216 MHz)                 │
                │  • TARA buton  (B1 USER, PC13, EXTI)     │
                │  • PANİK buton (PA0, EXTI, harici)       │
                │  • Yeşil/Sarı/Kırmızı LED (onboard) +    │
                │    harici buzzer (PD14)                  │
                │  • State machine: IDLE/SCANNING/MATCH/   │
                │    NOMATCH/PANIC/NETERR                  │
                │  • Scan timeout 15 s → NETERR            │
                │                                          │
                └──────────────────────────────────────────┘
                                  │
                                  │ BLE GATT (FFE0/FFE1) — ESP-CAM advertises
                                  ▼
                          iPhone 16 (SwiftUI app `iphone-app/`)
                          - CoreBluetooth central
                          - "TaxiGuard" otomatik connect
                          - SCANNING/MATCH/NOMATCH/PANIC/NETERR notify
                          - MATCH/PANIC'te tel://155 dialer
                          - Hotspot kaynak (4G/5G veri)

                          EC2 m7i-flex.large (eu-central-1, Frankfurt)
                          http://18.192.45.175:8000
                          ┌──────────────────────────────┐
                          │ Flask + InsightFace buffalo_l │
                          │ session manager + multi-frame│
                          │ centroid agregasyon          │
                          │ pickle DB (Gokturk + Ekin)   │
                          │ passive liveness skoru       │
                          │ kalite filtresi (blur min 10)│
                          └──────────────────────────────┘
```

## Veri akışı (10-frame burst)

```
1. Şoför STM32'nin B1 USER butonuna basar (TARA)
2. STM, USART6 üstünden ESP-CAM'e "CAPTURE\n" yollar
   + ESP-CAM'in forward edeceği "SCANNING\n" mesajını da gönderir
3. ESP-CAM:
   - Flash LED açar, kameradan 5 FPS × 2 sn = 10 JPEG yakalar
   - Her frame'i Wi-Fi üstünden EC2'ye HTTP POST eder
     (header'lar: X-Session-Id UUID, X-Frame-Index, X-Frame-Total)
   - 10. frame'de server agregasyon yapar:
     - RetinaFace yüz tespit (kalite filtresi: det_score, alan, yaw, blur)
     - Geçen frame'lerden ArcFace embedding'leri toplar
     - Centroid alıp pickle DB ile cosine similarity karşılaştırır
     - Cross-frame std → passive liveness skoru
     - JSON döner: {match, name, similarity, frames_used, liveness_score}
4. ESP-CAM JSON'u parse edip UART'tan STM'e gönderir:
   "RESULT:1;Gokturk;0.66\n" veya "RESULT:0;;0.00\n" veya "ERR:no_wifi\n"
5. STM RESULT'u parse eder:
   - MATCH → KIRMIZI LED + buzzer + "MATCH:Gokturk;0.66\n" → ESP'ye → BLE
   - NOMATCH → YEŞİL LED + "NOMATCH\n" → ESP'ye → BLE
   - ERR → SARI LED + "NETERR\n" → ESP'ye → BLE
6. ESP-CAM telefon-yönü mesajlarını BLE FFE1 notify ile iPhone'a yollar
7. iPhone'daki SwiftUI app:
   - notify'ı alır, UI'ı günceller (büyük renkli kart)
   - MATCH veya PANIC ise tel://155 URL'ini açar → iOS dialer açılır
   - Şoför "Ara" butonuna tek tıkla çağrıyı tamamlar
```

Tipik uçtan uca süre: **~5-7 saniye**. iOS sandbox tam-otomatik arama izin vermez; tek tık onay = "yanlış pozitif arama koruması" diye tezde savunulur.

## Faz 1 (mevcut) vs Faz 2 (opsiyonel)

**Faz 1 — EC2 HTTP public IP:** `http://18.192.45.175:8000`, TLS yok, port 8000 dünyaya açık. Demo + test için yeterli, AWS hediye krediyle ~12 gün bedava.

**Faz 2 — Domain + HTTPS:** Caddy/nginx + Let's Encrypt, ESP `USE_TLS=1` + ISRG Root X1 cert. ESP `config.h` swap + reflash. ~half day iş.

## Mimari ↔ Rapor uyumu

| Rapor bölümü | Karşılığı |
|---|---|
| 3.1 görüntü alma + ön-işleme | ESP32-CAM (OV3660 sensör) |
| 3.2 API destekli yaklaşım (seçilen) | Kendi InsightFace API'mizi host ediyoruz (AWS Rekognition DEĞİL) |
| 3.3 iş akışı (5 adım) | Bire bir uyuyor — multi-frame burst varyantı |
| 3.3.1 ağ yokken safe-mode | ESP timeout → STM SARI LED + "NETERR" + UI |
| 3.4 STM olay yönetimi | LED/buzzer/panik/BLE forward (via ESP-CAM) |
| 3.4.1 BT + telefon gateway | ESP-CAM'in entegre BLE'si + iPhone app + tel://155 |
| 3.4.2 mesaj çerçevesi | UART: STM↔ESP ASCII satır; BLE: aynı ASCII satırları FFE1 notify olarak |
| 6.1 Pi 4 (1599 TL) | DÜŞER — yerel CV yok |

> Tezde "API destekli" = bizim host ettiğimiz InsightFace REST API. Modeli biz seçtik (buffalo_l = ArcFace R100), FAR/FRR ölçümü bizde, KVKK netleşir.

## Donanım listesi (BOM nihai)

| Parça | Adet | Durum |
|---|---|---|
| STM32 NUCLEO-F767ZI | 1 | Var, kullanıcının elinde |
| ESP32-CAM AI-Thinker (OV3660 sensör entegre) | 1 | Var, test edildi |
| ESP32-CAM-MB programlama dock'u | 1 | Var, sadece flash'larken kullanılır |
| Aktif buzzer 5V | 1 | Var (PD14'te kullanılıyor) |
| Push button (TARA için) | 0 | Gerekmedi — B1 USER kullanılıyor |
| Push button (PANİK için, harici) | 1 (opsiyonel) | PA0'a wired değil, demo'da TARA tek başına yeter |
| LED'ler (yeşil, kırmızı) | onboard | NUCLEO LD1/LD3 yetiyor |
| LED (sarı, harici) | 1 (opsiyonel) | PD12'ye wired değil, onboard LD2 mavi yedek |
| Jumper kabloları | yeter sayıda | Var |
| iPhone 16 | 1 | Kullanıcının kendi telefonu |

**Kullanılmayan donanım (kutuda yedek):**
- ESP32-WROOM-32 DevKit — Plan A için alınmıştı, gerek yok
- HM-10 BLE modülü — ESP-CAM'in BLE'si geçti, atıldı
- FT232 USB-TTL converter — HM-10 AT config içindi, kullanılmadı
- USB-mini kablo — USB-TTL içindi

EC2 maliyet: AWS $200 hediye krediyle ~$23 / 12 gün → tez sonuna kadar bedava.

## Pin plan (kilitli)

### STM32 NUCLEO-F767ZI

**Clock:** HSI 16 MHz → PLL → 216 MHz HCLK (HSE_VALUE=25MHz yanlışlığını bypass etmek için HSI üzerinden PLL; SystemClock_Config_216MHz fonksiyonu USER CODE 4'te).

**ESP-CAM ↔ STM köprü (USART6, Arduino D0/D1, 115200 baud, ASCII):**

| STM32 pin | Arduino label | İşlev |
|---|---|---|
| PG9  | **D0** | USART6_RX — ESP-CAM IO13 (ESP TX → STM RX) |
| PG14 | **D1** | USART6_TX — ESP-CAM IO14 (STM TX → ESP RX) |
| GND  | GND   | Ortak referans |

**Diğer:**
- USART3 (PD8/PD9): ST-LINK VCP üzerinden Mac terminal'a printf debug, 115200
- USART2 (PD5/PD6, varsayılan): config var ama **kullanılmıyor** (HM-10 atıldığı için)
- USART1 (PA9/PA10): config var ama **kullanılmıyor**
- PB0 = LD1 yeşil (LED_GREEN, IDLE/NOMATCH gösterge)
- PB7 = LD2 mavi (heartbeat ~1 Hz, firmware alive gösterge)
- PB14 = LD3 kırmızı (LED_RED, MATCH/PANIC)
- PD12 = LED_YELLOW (harici, takılı değil)
- PD14 = BUZZER (harici, takılı değilse onboard LD3 yeter)
- PC13 = B1 USER button → TARA (GPIO_EXTI13)
- PA0 = PANİK button (harici, takılı değil)

### ESP32-CAM (AI-Thinker)

**Kamera pinleri:** dahili, `esp_camera` library yönetir (PWDN=32, XCLK=0, SCCB=26/27, D0-D7=5/18/19/21/36/39/34/35, VSYNC=25, HREF=23, PCLK=22).

**STM ↔ ESP UART (HardwareSerial 2):**

| ESP32-CAM pin | STM32 NUCLEO pin |
|---|---|
| IO13 (TX out) | D0 (PG9, USART6_RX) |
| IO14 (RX in)  | D1 (PG14, USART6_TX) |
| GND | GND (ortak) |
| 5V veya 3.3V | (ESP-CAM kendi dock USB'sinden besleniyor; STM 5V'tan beslemek brown-out yapar) |

**Flash LED:** IO4 (run_burst sırasında otomatik açılır/kapanır).

**Güç:** ESP32-CAM Wi-Fi+kamera aktifken ~500 mA peak. STM32 NUCLEO 5V pin USB-limited (~300 mA), brown-out riski. **Doğru kurulum: ESP-CAM ayrı micro-USB ile (dock'tan veya direkt USB charger'dan) beslensin.** Sadece UART (3 wire: IO13/IO14/GND) STM'e gitsin.

## STM32 ↔ ESP-CAM protokolü (USART6, 115200 8N1, ASCII text, newline-delimited)

**STM → ESP:**
```
CAPTURE\n          TARA basıldı, ESP burst başlat
SCANNING\n         (ESP'nin telefona forward etmesi için)
MATCH:<name>;<sim>\n
NOMATCH\n
PANIC\n
NETERR\n
```

**ESP → STM:**
```
RESULT:<1|0>;<name>;<sim>\n   burst sonucu (örn. "RESULT:1;Gokturk;0.66")
ERR:<code>\n                  burst hatası (no_wifi, http_500, json, no_final)
HB\n                          her 5 saniyede bir heartbeat
```

STM RESULT'u parse eder, MATCH/NOMATCH/NETERR'a göre state geçişi yapar, telefon-yönü mesajları (MATCH:.., NOMATCH, NETERR, vs.) AYNI UART üstünden ESP'ye geri yollar. ESP bunları BLE notify olarak telefona forward eder.

## ESP-CAM ↔ iPhone BLE (GATT)

**Device name:** `TaxiGuard`
**Service:** `0000ffe0-0000-1000-8000-00805f9b34fb` (FFE0)
**Characteristic:** `0000ffe1-0000-1000-8000-00805f9b34fb` (FFE1, NOTIFY + READ + WRITE)
**MTU:** `BLEDevice::setMTU(247)` (default 23 mesajları kırpıyordu)

iPhone abone olur, notify'lar gelir, her satır iPhone parser'ına işlenir:
- `MATCH:<name>;<sim>\n` → kırmızı kart + tel://155
- `NOMATCH\n` → yeşil kart
- `SCANNING\n` → turuncu kart
- `PANIC\n` → kırmızı kart + tel://155
- `NETERR\n` → sarı kart
- `HB\n` → state.lastHeartbeat güncellenir

## Sunucu (Flask + InsightFace)

Konum: `face-mac/server/`

Dosyalar:
- `app.py` — Flask routes, session manager, agregasyon
- `recognition.py` — InsightFace wrapper (buffalo_l), kalite filtresi
- `db.py` — pickle DB (L2 normalized cosine match, v1 Person backward-compat shim)
- `enroll.py` — CLI: tek fotoğrafla DB'ye kişi ekle
- `requirements.txt`, `Dockerfile`, `deploy_ec2.sh`
- `test_simulate_burst.py` — ESP'yi simüle eden Mac test scripti

Endpoint'ler:
- `GET /health` → `{ok: true, db_size: N, open_sessions: K}`
- `POST /search` (X-Session-Id / X-Frame-Index / X-Frame-Total + JPEG body)
  - Ara frame'lerde: `{status: "continue", quality_ok_this_frame: bool, ...}`
  - Son frame'de: `{match: bool, name: str, similarity: float, frames_used: int, liveness_score: float, ...}`

**Kalite filtresi (recognition.py):**
- det_score ≥ 0.7
- bbox area ≥ 80×80
- |yaw| ≤ 30°
- blur (Laplacian variance) ≥ **10** (orijinal 50'di, ESP-CAM küçük lens için düşürüldü)

Agregasyon: en az 5 frame kaliteyi geçmeli → embedding'lerin centroid'i → cosine sim ≥ threshold (0.4) → MATCH. Cross-frame std → passive liveness skoru.

EC2'de canlı:
- IP: `18.192.45.175`, port 8000, HTTP
- Region: eu-central-1 (Frankfurt)
- Instance: m7i-flex.large, AWS Free Plan'da en güçlü
- Container `taxi-server`, `--restart unless-stopped`
- Diagnostic log: her frame için `[search] sid=X frame=N/M det=.. area=.. yaw=.. blur=.. ok=..`
- DB: `/home/ec2-user/data/embeddings.pkl` (Gokturk + Ekin enrolled)
- Gunicorn `-w 1` SABİT — multi-worker session state'i kırar.

## ESP32-CAM firmware

Konum: `face-mac/esp32-cam/`

Dosyalar:
- `platformio.ini` (board: esp32cam, framework: arduino, upload_speed: 460800)
- `include/config.h` — Wi-Fi creds, server URL, USE_TLS, BURST_FRAME_COUNT, pins
- `include/aws_root_ca.h` — Amazon Root CA (Faz 2 için, şu an kullanılmıyor)
- `src/main.cpp` — Wi-Fi STA, esp_camera, HTTP POST, UART RX, BLE peripheral

Build + flash:
```bash
cd /Users/gokturkgocen/Bitirme/face-mac/esp32-cam
pio run -t upload --upload-port /dev/tty.usbserial-1130  # dock USB
```

Flash sırasında STM'in UART wire'larını ESP'den çıkar, sonra geri tak. ESP-CAM dock'a tam yerleştirildiğinde IO13/IO14 erişilemez, runtime'da dock'tan çıkarmak gerekiyor — VEYA dock'a yarım yerleştirme ile bir taraf havada bırakılır.

Wi-Fi creds şu an `config.h`'da hardcoded: `GG` / `GGocen2690` (iPhone hotspot). Hotspot kapalıysa ESP-CAM "no_wifi" hatası verir.

## STM32 firmware

Konum: `face-mac/Stm32/taxi_guvenlik/` (CubeIDE projesi; `Stm32` capital S, CubeMX bizim için böyle yarattı)

Önemli dosyalar:
- `Core/Src/main.c` — clock config, peripheral init, state machine
- `Core/Inc/main.h` — pin label macro'ları (CubeMX-generated)
- `taxi_guvenlik.ioc` — CubeMX projesi
- `Drivers/STM32F7xx_HAL_Driver/` — HAL kütüphanesi

USER CODE bölümlerinde:
- `SystemClock_Config_216MHz()` (USER CODE 4) — HSI×PLL → 216 MHz
- `MX_USART6_UART_Init_Manual()` (USER CODE 4) — Arduino D0/D1 için elle init
- `USART6_IRQHandler()` (USER CODE 4) — CubeMX generate etmedi, biz yazdık
- State machine (USER CODE WHILE + USER CODE 4)
- printf retarget USART3'e (`_write` override)

Build + flash: CubeIDE → Project → Refresh → Build → Run.

## iPhone app

Konum: `iphone-app/`

Stack:
- SwiftUI, iOS 17+
- 4 dosya: `TaksiGuvenlikApp.swift`, `AppState.swift`, `BLEManager.swift`, `ContentView.swift`
- CoreBluetooth central
- Tek ekran UI: BLE durum badge'i + büyük renkli state kartı + olay log'u
- Auto-dial: MATCH veya PANIC alınca `tel://155` URL'i açılır (iOS dialer)
- Info.plist (project.yml içinden generate): BT permission + tel:// scheme + bluetooth-central background mode

Build + run:
1. `open /Users/gokturkgocen/Bitirme/iphone-app/TaksiGuvenlik.xcodeproj`
2. iPhone'u USB ile bağla, Settings → Developer Mode = On
3. Xcode'da target = kendi iPhone'un
4. Cmd+R → ilk seferde Settings → Device Management → Trust

Şu an sade UI'da:
- Üst: "Taksi Güvenlik" + BLE bağlantı durum noktası
- Orta: büyük renkli state kartı (IDLE/SCANNING/MATCH/NOMATCH/PANIC/NETERR)
- Alt: scroll edilebilir olay log'u (timestamp + ham satır)

Xcode project XcodeGen ile yönetiliyor (`project.yml`). Dosya ekle/sil yapınca:
```bash
cd /Users/gokturkgocen/Bitirme/iphone-app
xcodegen
```

## Mevcut çalışma durumu (2026-05-14)

**Tamamen yeşil:**
- ✅ EC2 sunucu canlı, /health 200, AWS recognition uçtan uca çalışıyor
- ✅ ESP-CAM Wi-Fi STA + HTTP POST + JSON parse
- ✅ ESP-CAM kamerası 10-frame burst, kalite filtresi geçiyor (flash LED ile)
- ✅ EC2 DB'de Gokturk + Ekin enrolled
- ✅ STM32 216 MHz clock, USART3 VCP printf debug, USART6 RX/TX
- ✅ STM ↔ ESP-CAM UART köprüsü (IO13/IO14 ↔ D0/D1)
- ✅ STM B1 USER → CAPTURE → ESP burst → AWS match → RESULT → STM MATCH state
- ✅ ESP-CAM BLE peripheral "TaxiGuard" advertising
- ✅ iPhone app `TaxiGuard`'a otomatik bağlanıyor, FFE1 notify alıyor
- ✅ MATCH'te iOS dialer 155 ile açılıyor, şoför tek tık ile arıyor
- ✅ Olay log'u UI'da görünüyor

**Yarı pürüzlü (henüz son test bekliyor):**
- 🟡 MATCH ekranında "benzerlik %0" görünüyordu — BLE MTU 247'ye bump yapıldı, iPhone parser defansif yapıldı, son flash sonrası tekrar test edilecek
- 🟡 ESP-CAM dock'tan çıkarınca brown-out riski (STM 5V yetmiyor) — fix: ESP-CAM ayrı USB güçten beslenmeli

**Yapılmadı (gelecek):**
- ⏳ 20-30 kişi enrollment + FAR/FRR ölçümü (rapor 1.3)
- ⏳ Aydınlatma testi (100/300/600 lx) + mesafe testi (30-120 cm) — rapor Tablo 5.1
- ⏳ Tez yazımı + sergi hazırlığı (poster `poster/poster.html` ve `poster_yeni.html` ana hatlarıyla mevcut)
- ⏳ PANİK butonu harici fiziksel buton (opsiyonel — şu an PA0 wire'sız)

## Kilit kararlar (LOCK)

| Karar | Neden | Reddedilen |
|---|---|---|
| Kendi sunucumuz + buffalo_l (AWS Rekognition **DEĞİL**) | KVKK temiz, FAR/FRR ölçümü tezde değer, model bizim | AWS Rekognition (kapalı kutu), Face++ (Çin), Azure Face (kapatıldı) |
| Multi-frame burst 10 frame (tek-shot **DEĞİL**) | Robust + bedava passive liveness (cross-frame std) | Tek-shot |
| ESP32-CAM (AI-Thinker, OV3660) + tek board | Çankaya'da DVP standalone OV5640 bulunamadı; ESP-CAM hem kamera+Wi-Fi hem BLE | Plan A: standalone OV5640 + DCMI + STM32 |
| ESP-CAM'in entegre BLE'si (HM-10 **DEĞİL**) | HM-10 + USART2 PD5/PD6 Morpho karmaşası; ESP zaten BLE yapabiliyor | HM-10/HM-19, USART2 Morpho |
| USART6 Arduino D0/D1 (Morpho USART1 **DEĞİL**) | Silkscreen labels D0/D1 görmek kolay, Morpho zor identify ediliyor | USART1 PA9/PA10 Morpho |
| HSI×PLL → 216 MHz (HSE bypass **DEĞİL**) | HAL'in HSE_VALUE=25 MHz makro'su HSE bypass için yanlış, BRR hesabı sapıtıyor | HSE bypass 8 MHz |
| iPhone (Android **şu an değil**) | Kullanıcının elinde iPhone 16, iOS dialer tel://155 tek-tık yeter, demo için pratik | Android Intent.ACTION_CALL (gelecek için Plan B, iphone-app/ rafta) |
| Intent.ACTION_CALL yerine tel:// dialer | iOS sandbox tam otomatik aramaya izin vermez; tek-tık onay = yanlış pozitif koruma katmanı | Otomatik arama |
| EC2 m7i-flex.large eu-central-1 | Free Plan içinde en güçlü, $200 hediye krediyle ~$23/12 gün | t3.small (burstable, FAR/FRR testinde throttle riski) |
| Gunicorn `-w 1` SABİT | Session state in-memory per-process; multi-worker burst'u kırar | `-w 2+` |
| Kalite filtresi min_blur=10 (50 **DEĞİL**) | ESP-CAM küçük lens VGA: blur ~15-30 normal aralık, 50 hep eler | min_blur=50 |
| BLE MTU 247 (varsayılan 23 **DEĞİL**) | "MATCH:Name;0.66\n" 20 byte sınırının üstüne çıkıyor, kesiliyordu | varsayılan MTU |

## Red flag — sapma sinyalleri (HAYIR de)
- "AWS Rekognition'a geri dönelim" → silindi, geri yok
- "HM-10'u tekrar ekleyelim" → atıldı, ESP-CAM BLE'si zaten çalışıyor
- "Standalone OV5640 + DCMI yapalım" → Plan A reddedildi (modül yok)
- "Android app yazalım demo öncesi" → iPhone app çalışıyor, demo zamanı yetmez
- "HSE bypass kullanalım" → HAL HSE_VALUE makrosu bozuk, HSI×PLL kalsın
- "USART1/PA9-PA10 Morpho'dan ESP'ye bağlayalım" → D0/D1 silkscreen var, kolay
- "buffalo_l yerine başka model" → FAR/FRR ölçümü tezde değer
- "MiniFASNet anti-spoof ekleyelim" → multi-frame std passive liveness yeterli
- "STM32'de TFLite face recog" → F767ZI yetmez
- "JPEG yerine raw RGB" → UART boğulur
- "Pi 4 ekleyelim" → ESP-CAM yeterli
- "Gunicorn worker artıralım" → session state kırılır
- "ESP-CAM'i STM 5V'tan beslemek yeter" → brown-out, dock USB veya ayrı USB lazım

## Gotcha'lar
- **HAL HSE_VALUE makrosu**: stm32f7xx_hal_conf.h'da 25 MHz tanımlı, NUCLEO'da HSE 8 MHz. HSE bypass kullanırsan PLL hesabı 3x bozuk, UART baud sapıtır. Çözüm: HSI×PLL kullan (HSI_VALUE doğru).
- **ESP-CAM brown-out**: kamera+Wi-Fi peak akımı STM 5V pin'inden yetmez, reset olur, flash LED kısa yanıp söner sonra RESULT dönmez. Çözüm: ESP-CAM ayrı USB güçten.
- **BLE MTU varsayılan 23**: payload 20 byte, mesajlar kesilir. Çözüm: ESP'de `BLEDevice::setMTU(247)`.
- **iPhone hotspot otomatik kapanma**: iOS bir süre kimse bağlı değilse kapatır. Demo öncesi açık kalsın, ESP-CAM bağlı kalsın.
- **Hotspot 5 GHz**: iPhone "Uyumluluğu Maksimuma Çıkar" ayarı açık olmalı, ESP-CAM 2.4 GHz görüyor.
- **ESP-CAM-MB dock erişim**: ESP-CAM dock'a tam yerleştirilince IO13/IO14 dış jumper'a erişilemez. Yarım yerleştir veya runtime'da dock'tan çıkar.
- **ESP-CAM flash sırasında STM bağlı kalmamalı**: STM TX, ESP-CAM bootloader'ına interferans yapıyor. Flash öncesi UART jumper'ları çek.
- **Gunicorn -w 1 SABİT**: değiştirme, session state in-memory.
- **NUCLEO ST-LINK VCP port adı değişkenlik**: `/dev/tty.usbmodem103` veya `1103` olabilir, `ls /dev/tty.usbmodem*` ile kontrol et.
- **iOS dialer otomatik arama yapamaz**: tel:// URL'i dialer'ı açar, kullanıcı tek tık ile onaylar. Tez savunma: "yanlış pozitif arama koruma katmanı".
- **AGENTS.md ve CLAUDE.md senkron tut**: her mimari değişiklik iki dosyaya da yansıtılmalı.

## Dosya yapısı

```
Bitirme/                                  # repo kökü (https://github.com/gokturkgocen/taksi-guvenlik)
├── AGENTS.md                             # repo root AI agent brief, CLAUDE.md'ye pointer
├── Ekin_Ag_aog_lu_Gelis_imRaporu.pdf     # gelişme raporu, DONDURULDU
├── taxi-key.pem                          # EC2 SSH key (gitignore'da, push'lanmaz)
├── .gitignore
│
├── face-mac/                             # ana proje klasörü (adı eski, dokunma)
│   ├── CLAUDE.md                         # ⭐ BU DOSYA (ana dokümantasyon)
│   ├── embeddings.pkl                    # EC2 DB snapshot (Gokturk + Ekin)
│   │
│   ├── server/                           # ⭐ Flask + InsightFace, EC2'de canlı
│   │   ├── app.py
│   │   ├── recognition.py
│   │   ├── db.py
│   │   ├── enroll.py
│   │   ├── test_simulate_burst.py
│   │   ├── Dockerfile, deploy_ec2.sh, requirements.txt
│   │
│   ├── esp32-cam/                        # ⭐ ESP32-CAM Arduino firmware (PlatformIO)
│   │   ├── platformio.ini
│   │   ├── include/config.h
│   │   ├── include/aws_root_ca.h
│   │   └── src/main.cpp
│   │
│   └── Stm32/                            # ⭐ STM32 CubeIDE projesi
│       └── taxi_guvenlik/
│           ├── taxi_guvenlik.ioc
│           ├── Core/Inc/, Core/Src/
│           ├── Drivers/STM32F7xx_HAL_Driver/
│           └── (CubeIDE workspace state da git'te, kross-Mac taşıma için)
│
├── poster/                               # Sergi posteri (70×100 cm HTML)
│   ├── poster.html
│   └── poster_yeni.html
│
└── iphone-app/                           # ⭐ SwiftUI iPhone app (aktif)
    ├── project.yml                       # XcodeGen
    ├── TaksiGuvenlik/
    │   ├── TaksiGuvenlikApp.swift
    │   ├── AppState.swift
    │   ├── BLEManager.swift
    │   └── ContentView.swift
    ├── TaksiGuvenlik.xcodeproj/          # XcodeGen-generated
    └── README.md
```

## Hızlı kullanım

```bash
# EC2 sunucu durumu
curl http://18.192.45.175:8000/health

# EC2 server log (per-frame diagnostic)
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175 'docker logs --tail 20 taxi-server'

# Server koduna değişiklik → yeniden deploy
rsync -az --exclude '__pycache__' -e 'ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem' \
    /Users/gokturkgocen/Bitirme/face-mac/server/ ec2-user@18.192.45.175:/home/ec2-user/taksi-guvenlik/server/
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'cd taksi-guvenlik/server && docker build -t taxi-server:latest . && docker rm -f taxi-server && \
     docker run -d --name taxi-server -p 8000:8000 -v /home/ec2-user/data:/app/data \
     -e DB_PATH=/app/data/embeddings.pkl --restart unless-stopped taxi-server:latest'

# Server koduna kişi enroll
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'docker exec -i taxi-server python enroll.py /path/to/photo.jpg "Name_001"'

# ESP-CAM flash (dock USB Mac'te, STM UART wire'ları çekili)
cd /Users/gokturkgocen/Bitirme/face-mac/esp32-cam
pio run -t upload --upload-port /dev/tty.usbserial-1130

# ESP-CAM serial monitor (dock USB ile)
/opt/homebrew/Cellar/platformio/6.1.19_1/libexec/bin/python3 -c "
import serial, time
ser = serial.Serial('/dev/tty.usbserial-1130', 115200, timeout=1)
ser.dtr=False; ser.rts=True; time.sleep(0.2); ser.rts=False
start = time.time()
while time.time() - start < 15:
    d = ser.read(512)
    if d: print(d.decode(errors='replace'), end='')
"

# STM32 build + flash: CubeIDE'de Project → Refresh → Build → Run

# STM32 serial monitor (ST-LINK VCP via USART3, 115200)
/opt/homebrew/Cellar/platformio/6.1.19_1/libexec/bin/python3 -c "
import serial, time
ser = serial.Serial('/dev/tty.usbmodem103', 115200, timeout=1)
start = time.time()
while time.time() - start < 30:
    d = ser.read(512)
    if d: print(d.decode(errors='replace'), end='')
"

# iPhone app build + run
open /Users/gokturkgocen/Bitirme/iphone-app/TaksiGuvenlik.xcodeproj
# Xcode: target = iPhone, Cmd+R

# iPhone app dosya ekle/sil sonrası Xcode projesini yeniden üret
cd /Users/gokturkgocen/Bitirme/iphone-app && xcodegen
```

## İletişim notu
- Türkçe konuş, kısa ve direkt
- Terminal komutu verirken **full path**
- Onay almadan mimari değişiklik yapma — mimari kilitli
- Emin olmadığın API/parametre/pin'i araştır, varsayım yapma
- Her kod değişikliği commit + push, anlamlı mesaj
- iPhone hotspot SSID ve şifresi `config.h`'da hardcoded (kullanıcı onayladı, public repo'da OK)
- Demo öncesi: iPhone hotspot açık + 2.4 GHz uyumlu + ESP-CAM güçlü + STM USB Mac'te + iPhone uygulamada
