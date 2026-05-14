# Taksi Güvenlik — Bitirme Projesi

> **Yeni bir oturuma başladığında ÖNCE bu dosyayı oku.** Mimari kilitli, aksi yönde iş yapma.

## Oturum başı protokolü
1. Bu dosyayı baştan sona oku.
2. Rapor: `/Users/gokturkgocen/Bitirme/Ekin_Ag_aog_lu_Gelis_imRaporu.pdf` — Ege Üniversitesi gelişme raporu. Hedef metrikler ve mimari kısıtlar burada. **Rapor donduruldu, değiştirilemez.**
3. Kullanıcı Göktürk Göcen (gokturk@robodor.com). Rapor "Ekin Ağaoğlu" adına — proje ortağı, partner Mac'i `/Users/ekinagaoglu/bitirme/` altında çalışıyor.
4. Bu projede **Türkçe konuş** — global "İngilizce" kuralını ezer.
5. Auto modda bile mimari sapmadan önce kullanıcıyı uyar.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa burst ile tarayıp, EC2'de host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa Android telefon BLE üzerinden komut alıp otomatik **155** çağrısı.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026 dönemi).
**Danışman:** Aydoğan Savran.
**Teslim:** 12 gün içinde sunum + sergi.
**Test telefonu:** Samsung Galaxy S20 FE.

## Nihai mimari (kilitli — Plan B aktif)

> Standalone DVP OV5640 modülü Çankaya'da bulunamadı. Plan A (STM-merkezli +
> DCMI + ayrı kamera) terkedildi. **Plan B** kilitli: kamera + Wi-Fi tek
> board'da ESP32-CAM (AI-Thinker, OV3660 sensör), STM32 olay yönetiminde kalır.

```
                ┌────────────────────────── ARAÇ İÇİ MODÜL ─────────────────────────┐
                │                                                                    │
   Yolcu yüzü → ESP32-CAM (AI-Thinker)                                              │
                │  • OV3660 kamera + ESP32 entegre                                   │
                │  • 5 FPS × 2 s = 10 frame burst capture                            │
                │  • Wi-Fi STA (telefon hotspot)                                     │
                │  • HTTP POST → EC2 sunucu, session/frame headers                   │
                │                                                                    │
                │  IO13 (TX) / IO14 (RX) UART 115200                                 │
                │   ▲                                                                │
                │   │ "CAPTURE\n" komut                                              │
                │   │ "RESULT:<1|0>;<name>;<sim>\n" cevap                            │
                │   ▼                                                                │
   STM32 NUCLEO-F767ZI                                                              │
                │  • TARA buton IRQ (PC13, B1 USER)                                  │
                │  • PANİK buton IRQ (PA0, harici)                                   │
                │  • LED: yeşil/kırmızı/sarı + buzzer                                │
                │  • State machine: IDLE/SCANNING/MATCH/NOMATCH/PANIC/NETERR         │
                │  • Scan timeout 15 s → NETERR                                      │
                │                                                                    │
                └──USART2 (9600)───► HM-10/HM-19 BLE module                          │
                                     │                                              │
                ─────────────────────┼──────────────────────────────────────────────┘
                                     │ BLE GATT (FFE0/FFE1)
                                     ▼
                              Android telefon (Samsung S20 FE veya iPhone)
                              • BLE central (foreground service)
                              • MATCH/PANIC/NETERR notification
                              • Intent.ACTION_CALL("tel:155")
                              • Hotspot kaynak (4G/5G veri)

                              EC2 m7i-flex.large (eu-central-1, Frankfurt)
                              http://18.192.45.175:8000
                              ┌──────────────────────────────┐
                              │ Flask + InsightFace buffalo_l │
                              │ session manager + 10-frame   │
                              │ centroid agregasyon          │
                              │ pickle DB (/app/data/...)    │
                              │ passive liveness skoru       │
                              └──────────────────────────────┘
```

## Veri akışı (10-frame burst)

```
1. Sürücü TARA butonuna basar → STM SARI LED + HM-10'dan "SCANNING\n"
2. STM, 5 FPS × 2 sn = 10 frame yakalar (DCMI/DMA, OV5640 JPEG encoder)
3. Her frame: STM → UART1 → ESP32; ESP HTTP POST → EC2 (X-Session-Id, X-Frame-Index, X-Frame-Total)
4. 10. frame'de server agregasyon:
     - Her frame'de RetinaFace ile yüz tespit
     - Kalite filtresi (det_score ≥0.7, blur ≥50, alan ≥80×80, yaw ≤30°)
     - Geçenlerden ArcFace embedding al, centroid'i hesapla
     - DB ile cosine sim → en yakın eşleşme
     - Embedding cross-frame std → passive liveness skoru
5. ESP sonucu CSV `"1;Ali_Yilmaz;0.94"` olarak STM'e UART üstünden döner
6. STM: MATCH → KIRMIZI LED + buzzer + HM-10 → "MATCH:..\n"; NOMATCH → YEŞİL LED
7. Telefon BLE notify alır, MATCH ise `Intent.ACTION_CALL("tel:155")`
```

Tipik uçtan uca: ~5-7 sn (latency önemsiz, "yolcu binişi başına bir tarama").

## Faz 1 vs Faz 2

**Faz 1 — EC2 sunucu, HTTP, public IP (mevcut durum):**
- `http://18.192.45.175:8000/search`
- TLS yok, auth yok, port 8000 dünyaya açık (`SHARED_SECRET` env ile body-key auth eklenebilir, server kodu hazır)
- Demo + test için yeterli

**Faz 2 — Domain + HTTPS (opsiyonel, vakit kalırsa):**
- Domain (örn. `taxi.example.com`) → EC2 IP'ye A kaydı
- Caddy / nginx reverse proxy + Let's Encrypt sertifikası
- ESP `config.h`: `SERVER_URL` https olur, `USE_TLS 1`, ISRG Root X1 cert eklenir
- Faz 2'ye geçiş: ~half day

## Mimari ↔ Rapor uyumu

| Rapor bölümü | Karşılığı |
|---|---|
| 3.1 görüntü alma + ön-işleme | OV5640 + STM32 DCMI |
| 3.2 API destekli yaklaşım (seçilen) | Kendi InsightFace API'mizi host ediyoruz |
| 3.3 iş akışı (5 adım) | Bire bir uyuyor (multi-frame burst varyantı) |
| 3.3.1 ağ yokken safe-mode | ESP timeout → STM SARI LED + "NETERR" |
| 3.4 STM olay yönetimi | LED/buzzer/panik/BLE forward |
| 3.4.1 BT + telefon gateway | HM-10 (veya HM-19/AT-09) + Android Intent.ACTION_CALL |
| 3.4.2 mesaj çerçevesi (TYPE/LEN/CRC) | Binary frame STM↔ESP, ASCII STM↔HM-10 |
| 6.1 Pi 4 (1599 TL) | DÜŞER — yerel CV server-side, donanım bütçesi <500 TL |

> Tezde "API destekli" = bizim host ettiğimiz InsightFace REST API. AWS Rekognition gibi kapalı kutu değil, modeli biz seçtik (buffalo_l = ArcFace R100), modeli biz değerlendirdik (FAR/FRR), servisi biz deploy ettik.

## Donanım listesi (BOM nihai)

| Parça | Adet | Tahmini fiyat | Not |
|---|---|---|---|
| STM32 NUCLEO-F767ZI | 1 | 2338 TL (var) | Beyin, DCMI sahibi |
| OV5640 modül (DVP/parallel, 18-pin, lens'li, onboard regülatörlü) | 1 | ~100-150 TL | OV2640 alternatifi, ST resmi BSP driver mevcut |
| ESP32-WROOM-32 DevKit (DOIT V1) | 1 | ~80-120 TL | Wi-Fi köprü |
| HM-19 / HM-10 / AT-09 BLE modül | 1 | ~80 TL | HM-19 tercih, CC2541 klonları çalışır |
| LED kit (yeşil/kırmızı/sarı) + 220 Ω | 3 + 3 | ~10 TL | Sürücü gösterge |
| Aktif buzzer 5 V | 1 | ~15 TL | Eşleşme uyarı |
| Push button taktil 6×6 mm | 2-4 | ~10 TL | TARA + PANİK |
| Breadboard + jumper kablo seti | - | ~100 TL | Prototip |
| USB-TTL converter (CP2102 / FT232) | 1 | ~50 TL | HM AT komut, ESP-CAM flash |
| Yedek 40-pin male header pin | 2 strip | ~10 TL | Modül başlığı yoksa |
| **Toplam ekstra** | | **~480 TL** | Rapor 5000 TL bütçe içinde |
| ESP32-CAM AI-Thinker (Plan B sigorta) | 1 | ~120 TL | OV5640+DCMI takılırsa devreye |

EC2 (Faz 1): m7i-flex.large eu-central-1, AWS $200 hediye krediyle 12 gün için ~$23.

## Plan B (ESP32-CAM, OV5640+DCMI başarısız olursa)

Eğer STM32 + OV5640 DCMI entegrasyonu 1-2 günden fazla tıkanırsa:
- ESP32-CAM kameranın yerine geçer, kendi kamerasıyla yakalar ve Wi-Fi'dan AWS'e POST'lar
- STM32 sadece TARA buton + PANİK + LED + buzzer + HM-10 ↔ Android olur
- STM32 ↔ ESP32-CAM UART komut köprüsü: "CAPTURE" komutu + sonuç döner
- Tez argumanı: "STM = olay orkestratörü, ESP32-CAM = delege edilmiş görüntü+ağ peripheral" — hala savunulabilir
- Geçiş süresi: ~1 gün firmware revize

## Pin plan (STM32, CubeMX'te finalize)

> F767ZI'de Ethernet default aktif, DCMI pinleriyle çakışıyor. **CubeMX'te ETH disable.** Wi-Fi'ı ESP'ten alıyoruz.

DCMI (OV5640, 8-bit parallel):
- HSYNC: PA4 (CN7-17)
- VSYNC: PG9 (CN10-16) — PB7 LD2 LED ile çakışmasın
- PIXCLK: PA6 (CN7-13)
- D0-D7: PC6, PC7, PE0, PE1, PE4, PB6, PE5, PE6
- SCCB I2C1: PB8 (SCL), PB9 (SDA)
- PWDN: PB10, RESET: PB12

UART1 (STM ↔ ESP32, 921600 baud):
- TX: PA9, RX: PA10
- ESP32 tarafı: STM_RX_PIN=16, STM_TX_PIN=17

UART2 (STM ↔ HM-10, 9600 baud):
- TX: PD5, RX: PD6

GPIO:
- PB0 = LD1 yeşil (TEMİZ / IDLE)
- PB14 = LD3 kırmızı (EŞLEŞME)
- PD12 = harici sarı LED (İŞLENİYOR / NETERR)
- PD13 = aktif buzzer
- PA0 = B1 USER button → TARA EXTI
- PA1 = harici panik buton → PANİK EXTI

## STM32 ↔ ESP32 protokolü (UART1, 921600, 8N1)

Binary frame:
```
+------+------+------+--------+----------+------+
| 0xAA | 0x55 | TYPE | LEN_LE | PAYLOAD  | CRC8 |
+------+------+------+--------+----------+------+
```

TYPE:
- `0x01` IMG (STM→ESP, JPEG bytes; 10 ardışık IMG = 1 burst)
- `0x02` RESULT (ESP→STM, ASCII `"1;Ali_Yilmaz;0.94"` veya `"0;;0.0"`)
- `0x03` HB (her iki yön, payload=0; her 5 sn)
- `0x04` ERR (ESP→STM, ASCII: `"no_wifi"`, `"http_500"`, `"json_parse"`...)
- `0x05` ACK (her iki yön)

CRC8 polynomial 0x07, payload üzerinde.

## STM32 ↔ HM-10 protokolü (UART2, 9600, ASCII text, newline)

HM-10 transparent — STM'in UART2'ye yazdığı, BLE notify olarak telefona gider.

STM → telefon:
```
SCANNING\n
MATCH:<isim>;<skor>\n
NOMATCH\n
PANIC\n
NETERR\n
HB\n
```

## Sunucu (Flask + InsightFace)

> **Eval harness:** `face-mac/eval/` — donanım yokken bile FAR/FRR ölçümü için
> `bulk_enroll.py` ve `far_frr.py`. Detay: `face-mac/eval/README.md`.

Konum: `face-mac/server/`

Dosyalar:
- `app.py` — Flask routes, session manager, agregasyon
- `recognition.py` — InsightFace wrapper (buffalo_l), kalite filtresi
- `db.py` — pickle DB, L2-normalized cosine match, v1 Person backward-compat shim
- `enroll.py` — CLI: tek fotoğrafla DB'ye kişi ekle
- `requirements.txt`, `Dockerfile`, `deploy_ec2.sh`
- `test_simulate_burst.py` — ESP32'yi simüle eden Mac test scripti

Endpoint:
- `GET /health` → DB boyutu + açık session sayısı
- `POST /search` (header: `X-Session-Id`, `X-Frame-Index`, `X-Frame-Total`; body: JPEG)

Agregasyon mantığı (final frame):
1. Session içindeki kalite-geçen frame'lerin embedding'lerini topla
2. `MIN_QUALITY_FRAMES` (varsayılan 5) altındaysa: `insufficient_quality_frames`
3. Embedding'lerin centroid'i → DB ile cosine sim
4. Threshold (varsayılan 0.4) üstündeyse MATCH
5. Embedding cross-frame std → passive liveness skoru

Kalite filtresi (her frame): det_score ≥0.7, alan ≥80×80, |yaw| ≤30°, blur ≥50.

Env varlar: `DB_PATH`, `MATCH_THRESHOLD`, `MIN_QUALITY_FRAMES`, `SESSION_TIMEOUT_S`, `PORT`, `SHARED_SECRET` (opsiyonel API key).

**Gunicorn -w 1 zorunlu:** Session state in-memory per-process. 2+ worker'da burst frame'leri farklı worker'lara dağılır, agregasyon kırılır. Tek worker = doğru.

EC2'de canlı (Faz 1):
- `http://18.192.45.175:8000`
- DB'de Gokturk + Ekin enrollment'ı var
- `--restart unless-stopped` → instance açık kaldıkça sunucu otonom

## ESP32 firmware

Konum: `face-mac/esp32/`

Dosyalar:
- `platformio.ini`
- `include/config.h` — Wi-Fi creds, server URL, USE_TLS flag, pin/timeout konfig
- `src/main.cpp` — UART frame protokolü + burst session_id üretimi + HTTP POST + JSON parse + result encoding

Faz 1 ↔ Faz 2 farkı: `config.h`'da `SERVER_URL` ve `USE_TLS` değişir. Reflash, tamam.

## Android app v2 (yeni)

Konum: `face-mac/android-v2/` — **iskelet hazır, donanım yokken bile build edilebilir**

**Mevcut durum (2026-05):** Compose + Kotlin tabanlı uygulama iskeleti yazıldı. Çekirdek
akış (BLE scan → GATT connect → FFE1 subscribe → frame parse → 155 dial) tam yazılı.
Donanım yokken doğrulama için ekranda **"DEV: Simulate MATCH"** butonu var — `Hm10Service`
kendi içinde sahte `MATCH:Test_Subject;0.95\n` satırı işliyor, böylece tek telefonda parse +
dial akışı test edilebilir. HM-10 elde olunca sadece BLE scanner gerçek modülü bulup
bağlanacak, geri kalan değişmeyecek.

Detay: `face-mac/android-v2/README.md`

Stack:
- Kotlin + Jetpack Compose
- `BluetoothLeScanner` + `BluetoothGatt` (HM-10/HM-19 service `0000FFE0-...`, char `0000FFE1-...`)
- Foreground Service (BLE persistance)
- `Intent.ACTION_CALL("tel:155")`
- Permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `CALL_PHONE`, `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`
- Min SDK: API 26 (Android 8.0+)

Mevcut iPhone app (`iphone-app/`) UI'sini referans alacak (5 ekran: Login, Home, Logs, Settings, BottomNav). Compose'a port edilecek. Renk paleti: #0A1F44 navy, #FFD43A yellow.

## iPhone app (Plan B)

`/Users/gokturkgocen/Bitirme/iphone-app/` altında. Android engellenirse aktif edilir, **şu an dokunma.** Tez sunumunda Android öncelikli, iPhone fallback olarak duruyor.

## v2 İş paketleri (güncel — 2026-05)

| Sıra | İş | Durum | Çıktı |
|---|---|---|---|
| 1 | EC2 sunucu deploy + Faz 1 test | ✅ | health OK, burst smoke test geçti |
| 2 | Donanım tedarik (Plan B: ESP32-CAM + STM32 + HM-10 + LED/buzzer/buton) | ✅ | Parça eli |
| 3 | ESP32-CAM PlatformIO build + flash, Wi-Fi STA test | ✅ | Wi-Fi'a bağlanıyor |
| 4 | ESP32-CAM → EC2 HTTP POST + JSON cevap | ✅ | Burst server'a gidiyor, RESULT parse ediliyor |
| 5 | STM32 CubeMX projesi açıldı + build + flash | ✅ | Kod board'a yüklendi |
| 6 | STM32 onboard LED testi (LD1/LD2/LD3) | 🟡 | Temel GPIO toggle çalışıyor |
| 7 | Harici LED + buzzer + buton (TARA/PANİK) STM'e bağlanması | ⏳ | Henüz takılmadı |
| 8 | STM32 UART1/UART2 hatları (loopback / USB-TTL ile tek başına) | ⏳ | Henüz test edilmedi |
| 9 | **STM ↔ ESP32-CAM birlikte güç verme + UART köprüsü** | ⏳ | **Henüz aynı anda ayakta değil** |
| 10 | HM-10 tek başına BLE testi (telefon + nRF Connect) | ✅ | FFE0/FFE1 karakteristiği üzerinden veri akışı doğrulandı |
| 10b | HM-10 → STM UART2 entegrasyon (MATCH/PANIC frame'i STM'den gönderme) | ⏳ | STM UART2 hattına lehimleme + test kaldı |
| 11 | Android app v2: BLE central + Intent.CALL + foreground service | ⏳ | Uçtan uca 155 araması tetikleniyor |
| 12 | 20-30 kişi enroll, FAR/FRR ölçümü | ⏳ | Doğruluk tablosu (poster_yeni'de boş matris hazır) |
| 13 | Test: ışık (100/300/600 lx), mesafe (30-120 cm) — rapor Tablo 5.1 | ⏳ | Sonuç tablosu |
| 14 | Tez yazımı + sergi hazırlığı | 🟡 | Poster hazır (`/poster/poster.html` + `poster_yeni.html`), tez metni sürüyor |

### Mevcut donanım durumu (dürüst rapor)

**ESP32-CAM (Plan B kamera+ağ):** PlatformIO ile flash edildi. Wi-Fi STA hotspot'a bağlanıyor,
EC2 sunucusuna HTTP POST atıp JSON cevabını parse ediyor. Server tarafıyla uçtan uca konuşma
doğrulandı. **Bu halka tamam.**

**STM32 NUCLEO-F767ZI (Plan B olay yöneticisi):** CubeMX projesi açıldı, build geçiyor, kart
flash edildi. Şu ana kadar sadece board üzerindeki LD1/LD2/LD3 LED'leriyle temel GPIO testi
yapıldı. Harici LED, buzzer ve buton (TARA/PANİK) henüz bağlanmadı. UART1/UART2 hatları
loopback veya USB-TTL ile bağımsız olarak da test edilmedi.

**STM ↔ ESP32-CAM köprüsü:** Henüz yok. İki board'a aynı anda güç verme ve UART hattı üzerinden
"CAPTURE / RESULT" protokolünü çalıştırma denemesi yapılmadı. **Sıradaki kritik milestone bu.**

**HM-10 BLE:** Modül tek başına test edildi. Telefon üzerinden nRF Connect uygulamasıyla
HM-10'a bağlanıldı, FFE0 service / FFE1 characteristic üzerinden veri okuma-yazma çalıştı.
Modülün BLE tarafı sağlam. **STM UART2 hattına bağlama ve "MATCH:..\n" frame'ini STM'den
göndertme kısmı henüz yapılmadı.**

**Android:** Hiç başlanmadı.

Sıralı yol haritası:
1. STM'e harici LED + buton + buzzer bağla, GPIO/EXTI doğrula.
2. STM UART1'i USB-TTL ile loopback test et (`printf` benzeri).
3. STM ve ESP32-CAM'i aynı güç hattında ayağa kaldır, UART1 üzerinden CAPTURE/RESULT köprüsünü
   doğrula.
4. HM-10'u UART2'ye bağla, AT komutlarıyla pair yap, nRF Connect ile MATCH frame'i gör.
5. Android v2 uygulamasını yaz, telefonu hotspot olarak kullan, uçtan uca 155 aramasını test et.

## Kararlar (nihai)

| Karar | Neden | Reddedilen |
|---|---|---|
| Kendi sunucumuz + buffalo_l | Modeli kontrol ediyoruz, KVKK temiz, FAR/FRR ölçümü tezde dolgun savunma | AWS Rekognition; Face++ (Çin); Azure Face (kapatıldı) |
| Multi-frame burst 10 frame | Tek-frame kırılgan; multi-frame robust + bedava passive liveness | Tek-shot snapshot |
| Centroid agregasyon | Embedding ortalaması basit + sağlam | Majority voting (daha gürültülü) |
| OV5640 (OV2640 yerine) | ST resmi BSP driver, 1-2 gün debug kazancı | OV2640 (driver sıfırdan yazılacaktı) |
| ESP32-WROOM + STM (ESP-CAM değil) | STM-merkezli mimari için kamera STM'e, ESP sadece Wi-Fi köprüsü | ESP32-CAM (Plan B sigorta) |
| HM-10/HM-19/AT-09 BLE | Komut data tiny, BLE yeter, GATT FFE0/FFE1 standart | HC-05 (Classic BT, Android 12+ karmaşık) |
| 921600 UART STM↔ESP | Basit, 30 KB ~260 ms kabul | SPI ~10 ms ama ekstra kod |
| Intent.ACTION_CALL | Otomatik 155, onay yok | tel://dialer (iOS sandbox kalıntı) |
| EC2 m7i-flex.large eu-central-1 | Free Plan içinde en güçlü, $200 hediye krediyle ~$23 / 12 gün | t3.small (CPU credit riski), m7i.large (free plan'da yok) |
| Gunicorn -w 1 | Session state in-memory per-process; multi-worker burst'u kırar | -w 2+ |

## Red flag (yan yola sapma sinyalleri)
- "AWS Rekognition'a geri dönelim" → HAYIR, silindi
- "Yerel + cloud hibrit" → Faz 1 zaten "yerel"in karşılığı
- "iPhone app'i de Android'le paralel sürdürelim" → arşiv, tek hedef Android
- "buffalo_l yerine başka model" → FAR/FRR ölçümü tezde değer; yeni model = yeni baseline
- "MiniFASNet'i geri ekleyelim" → multi-frame std zaten passive liveness
- "STM32'de TFLite face recog" → F767ZI yetmez
- "JPEG yerine raw RGB" → UART boğulur
- "Pi 4 ekleyelim" → ESP32 yeterli, bütçe lehine
- "Gunicorn worker artıralım" → HAYIR, session state per-process

## Gotcha'lar
- **DCMI ↔ ETH pin çakışması** — CubeMX'te ETH disable, DCMI'ye geç
- **PB7 LD2 mavi LED ↔ DCMI VSYNC** — VSYNC'i PG9'a al
- **OV5640 SCCB init** — ST'nin `STM32Cube_FW_F7/Drivers/BSP/Components/ov5640/`'ından adapt et
- **OV5640 JPEG değişken boyut** — VSYNC end IRQ'da DMA NDTR oku
- **ESP32 TLS Faz 2** — Let's Encrypt için ISRG Root X1; AWS endpoint için Amazon Root CA1
- **Android Foreground Service API 26+** — `NotificationChannel` + ongoing notification zorunlu
- **Android 12+ BT runtime permission** — `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` runtime al
- **155 araması SIM'siz çalışmaz** — test telefonunda SIM olduğunu doğrula
- **HM-10 default baud 9600** — STM tarafında 9600 ayarla
- **EC2 Public IPv4 dinamik** — instance stop/start ettiğinde IP değişir, Elastic IP'ye almak gerekebilir
- **Gunicorn -w 1 SABİT** — değiştirme, session state kırılır

## Dosya yapısı

```
Bitirme/                                  # repo kökü
├── AGENTS.md                             # Codex/AI agent context (root)
├── Ekin_Ag_aog_lu_Gelis_imRaporu.pdf     # gelişme raporu, DONDURULDU
├── taxi-key.pem                          # EC2 SSH key (gitignore'da)
├── .gitignore
│
├── face-mac/                             # ana proje klasörü
│   ├── CLAUDE.md                         # bu dosya
│   ├── embeddings.pkl                    # EC2 DB snapshot (yedek; canlı kopya EC2'de /app/data/)
│   ├── server/                           # ⭐ Flask + InsightFace (EC2'de canlı)
│   ├── eval/                             # ⭐ FAR/FRR ölçüm harness'i (offline)
│   ├── esp32-cam/                        # ⭐ PlatformIO firmware (Plan B aktif)
│   ├── stm32/                            # ⭐ CubeIDE firmware
│   └── android-v2/                       # ⭐ Android Studio (donanım gelince)
│
└── iphone-app/                           # PLAN B, DOKUNMA
```

## Hızlı kullanım

```bash
# Sunucu Mac'te ayağa kaldırmak (yerel test/dev)
cd /Users/gokturkgocen/Bitirme/face-mac/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py

# Enroll (yerel veya EC2'de)
python enroll.py /path/to/photo.jpg "Person_Name"

# EC2 sunucu test (smoke)
curl http://18.192.45.175:8000/health
python test_simulate_burst.py /path/to/test.jpg http://18.192.45.175:8000/search

# EC2'ye SSH
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175

# EC2'de enroll
scp -i /Users/gokturkgocen/Bitirme/taxi-key.pem photo.jpg ec2-user@18.192.45.175:~/
ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'docker cp ~/photo.jpg taxi-server:/tmp/ && \
     docker exec taxi-server python enroll.py /tmp/photo.jpg "Name_001"'

# EC2 deploy (Faz 2)
cd /Users/gokturkgocen/Bitirme/face-mac/server
export EC2_HOST="ec2-user@18.192.45.175"
export KEY_PATH="/Users/gokturkgocen/Bitirme/taxi-key.pem"
./deploy_ec2.sh

# ESP32 build + flash
cd /Users/gokturkgocen/Bitirme/face-mac/esp32
# config.h'da SERVER_URL ve Wi-Fi ayarla
pio run -t upload
pio device monitor
```

## İletişim notu
- Türkçe konuş, kısa ve direkt
- Terminal komutu verirken **full path** ver
- Onay almadan büyük mimari sapma yapma — mimari kilitli
- Emin olmadığın API/parametreyi araştır, varsayım yapma
- `iphone-app/` ve `taxi-key.pem`'e dokunma
- Yapılan her kod değişikliği commit + push edilmeli (Codex kuralı)
