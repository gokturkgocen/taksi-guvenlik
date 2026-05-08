# Taksi Güvenlik — Bitirme Projesi (NİHAİ MİMARİ)

> **Yeni bir oturuma başladığında ÖNCE bu dosyayı oku.** Sonra "Oturum başı protokolü" adımlarını sırayla uygula. Bu mimari kilitlendi (2026 Mayıs), aksi yönde iş yapma.

## Oturum başı protokolü
1. Bu dosyayı baştan sona oku.
2. Mimari **kilitli**. AWS Rekognition / Lambda / iPhone-app aktif yol değil — birinciyi sildik, ikincisi rafta.
3. Rapor: `/Users/gokturkgocen/Bitirme/Ekin_Ag_aog_lu_Gelis_imRaporu.pdf` — Ege Üniversitesi gelişme raporu. Hedef metrikler ve mimari kısıtlar burada. **Rapor donduruldu, değiştirilemez.**
4. Kullanıcı Göktürk Göcen (gokturk@robodor.com). Rapor "Ekin Ağaoğlu" adına — proje ortağı olabilir, netlik gerektikçe sor.
5. Bu projede **Türkçe konuş** — global "İngilizce" kuralını ezer.
6. Auto modda bile büyük mimari sapmalardan önce kullanıcıyı uyar.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa bir burst ile tarayıp, bizim host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa otomatik **155** (polis) çağrısı.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026 dönemi).
**Danışman:** Aydoğan Savran.
**Teslim:** İkinci dönem sonu (~2026 Haziran).
**Test telefonu:** Samsung Galaxy S20 FE (kullanıcının eski telefonu, tüm izinler verilebilir).

## Nihai mimari

```
                ┌─────────────────────────── ARAÇ İÇİ MODÜL ───────────────────────────┐
                │                                                                       │
   OV2640 ──DCMI──► STM32 NUCLEO-F767ZI                                                │
   (yolcu)         │  • TARA buton IRQ (sürücü)                                         │
                   │  • PANİK buton IRQ (sürücü)                                        │
                   │  • Yeşil/Kırmızı/Sarı LED, buzzer                                  │
                   │  • 5 FPS × 2 s = 10 frame burst capture                            │
                   │                                                                    │
                   ├──UART1 (921600)──► ESP32-WROOM-32                                  │
                   │                    │ session_id üretir, 10 frame'i ardışık POST eder│
                   │                    │ Wi-Fi STA (telefon hotspot)                   │
                   │                    └─HTTP/HTTPS─► Sunucu                           │
                   │                                                                    │
                   └──UART2 (9600)────► HM-10 BLE module                                │
                                        │                                               │
                └───────────────────────┼───────────────────────────────────────────────┘
                                        │ BLE GATT (FFE0/FFE1)
                                        ▼
                                Samsung Galaxy S20 FE
                                • BLE central (foreground service)
                                • MATCH:.. notification
                                • Intent.ACTION_CALL("tel:155")
                                • Hotspot kaynak (4G/5G)

                                Sunucu — Faz 1 / Faz 2 aynı kod
                                ┌──────────────────────────────┐
                                │ Flask + InsightFace buffalo_l │
                                │ session manager + 10-frame   │
                                │ centroid agregasyon          │
                                │ pickle DB (yerel)            │
                                │ passive liveness skoru       │
                                └──────────────────────────────┘
                                Faz 1: Mac LAN  (geliştirme)
                                Faz 2: EC2 t3.small  (production)
```

## Veri akışı (10-frame burst)

```
1. Sürücü TARA butonuna basar
2. STM SARI LED yanar, HM-10'dan "SCANNING\n" iletir
3. STM, HAL timer ile 5 FPS × 2 sn = 10 frame yakalar
4. Her frame yakalandığında:
     STM → UART1 → ESP32: { TYPE=IMG, payload=JPEG bytes }
     ESP32:
       - İlk IMG'de: session_id (UUID v4) üret
       - HTTP POST → SERVER_URL/search
         Headers:
           X-Session-Id: <uuid>
           X-Frame-Index: 1..10
           X-Frame-Total: 10
         Body: JPEG bytes
       - Ara frame'lerde server "continue" döner, ESP STM'e bir şey iletmez
5. 10. frame de gönderildiğinde server agregasyonu yapar:
     - Her frame'de RetinaFace ile yüz tespit
     - Kalite filtresi (det_score, blur, size, yaw)
     - Geçen frame'lerden ArcFace embedding al
     - Embedding centroid'i + cosine similarity ile DB match
     - Passive liveness: embedding cross-frame std
     - Final JSON: {match, name, similarity, frames_used, frames_total, liveness_score}
6. ESP server cevabını parse eder, kompakt CSV "1;Ali_Yilmaz;0.94" olarak STM'e:
     ESP → UART1 → STM: { TYPE=RESULT, payload="1;Ali_Yilmaz;0.94" }
7. STM:
     MATCH: KIRMIZI LED + buzzer 2 sn, HM-10'dan "MATCH:Ali_Yilmaz;0.94\n"
     NOMATCH: YEŞİL LED 1 sn, HM-10'dan "NOMATCH\n"
8. Telefon BLE notify alır, MATCH ise Intent.ACTION_CALL("tel:155")
```

Tipik uçtan uca süre: **~5-7 saniye** (10 frame × ~500 ms server inference + UART/Wi-Fi latency). Yolcu binişinde fazlasıyla kabul edilebilir, sürücü için bu süre boyunca sarı LED yanıp sönüyor.

## Faz 1 — Mac LAN sunucu (geliştirme)

Mac'te `face-mac/server/app.py` Flask development server. Mac telefon hotspot'una veya ev WiFi'sına bağlı, ESP32 aynı ağda.

ESP `config.h`:
```c
#define SERVER_URL "http://192.168.1.50:8000/search"
#define USE_TLS    0
```

Sıfır TLS, sıfır auth, LAN içi. Hızlı debug için ideal. Tüm uçtan uca akış burada doğrulanır.

## Faz 2 — Cloud sunucu (production)

Faz 1'deki **aynı kod** Docker'lanır → EC2 t3.small'a deploy. ESP'nin URL'si değişir.

```c
#define SERVER_URL "https://taxi.your-domain.com/search"
#define USE_TLS    1
```

Maliyet: AWS hediye krediyle ($100) tez bitene kadar bedava. EC2 t3.small ~$15/ay, 6+ ay free tier sonrası.

Geçiş efor: 1-2 gün (Dockerfile var, deploy_ec2.sh var, sadece domain + Let's Encrypt + ESP cert flash).

## Mimari ↔ Rapor uyumu

| Rapor bölümü | Bizim karşılığımız |
|---|---|
| 3.1 görüntü alma + ön-işleme | OV2640 + STM32 DCMI |
| 3.2 API destekli yaklaşım (seçilen) | Kendi InsightFace API'mizi host ediyoruz ✓ |
| 3.3 iş akışı (5 adım) | Capture → crop (server) → API → karar → UART. Bire bir. |
| 3.3.1 ağ yokken safe-mode | ESP timeout → STM SARI LED + "NETERR" mesajı |
| 3.4 STM olay yönetimi | LED/buzzer/panik/BLE forward |
| 3.4.1 BT + telefon gateway | HM-10 + Android (Intent.ACTION_CALL) |
| 3.4.2 mesaj çerçevesi (TYPE/LEN/CRC) | Binary frame STM↔ESP, ASCII STM↔HM-10 |
| 6.1 Pi 4 (1599 TL) | DÜŞER — yerel CV server-side, ESP32+OV2640+HM-10 < 300 TL |

> Tezde "API destekli" = bizim host ettiğimiz InsightFace REST API. AWS Rekognition gibi kapalı kutu değil, modeli biz seçtik (buffalo_l = ArcFace R100), modeli biz değerlendirdik (FAR/FRR), servisi biz deploy ettik.

## Donanım listesi (BOM nihai)

| Parça | Adet | Tahmini fiyat | Not |
|---|---|---|---|
| STM32 NUCLEO-F767ZI | 1 | 2338 TL (var) | Beyin |
| OV2640 modül (DCMI 18-pin başlık) | 1 | ~80 TL | Donanım JPEG encoder |
| ESP32-WROOM-32 DevKit | 1 | ~80 TL | Wi-Fi köprü |
| HM-10 BLE modül | 1 | ~80 TL | Telefon BLE |
| LED kit (yeşil/kırmızı/sarı) + 220 Ω | 3 + 3 | ~10 TL | Sürücü gösterge |
| Aktif buzzer 5 V | 1 | ~15 TL | Eşleşme uyarı |
| Push button (taktil) | 2 | ~10 TL | TARA + PANİK |
| Breadboard + jumper + 5V/3A USB güç | - | ~100 TL | Prototip |
| **Toplam ekstra** | | **~375 TL** | Rapor 5000 TL bütçe içinde |

## Pin plan (taslak — CubeMX'te finalize edilecek)

> F767ZI'de Ethernet default aktif, DCMI pinleri ile çakışıyor. **CubeMX'te ETH disable.**

DCMI (OV2640):
- HSYNC: PA4
- VSYNC: PG9 (PB7 LD2 LED'i ile çakışmasın)
- PIXCLK: PA6
- D0–D7: PC6, PC7, PE0, PE1, PE4, PE5, PE6, PB6
- SCCB I2C1: PB8 (SCL), PB9 (SDA)
- PWDN: PB10, RESET: PB12

UART1 (STM ↔ ESP32, 921600 baud, 8N1):
- TX: PA9, RX: PA10
- ESP tarafı: STM_RX_PIN=16, STM_TX_PIN=17

UART2 (STM ↔ HM-10, 9600 baud — HM-10 default):
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
| sync | sync | 1 B  | 4 B    | LEN B    | 1 B  |
+------+------+------+--------+----------+------+
```

TYPE:
- `0x01` IMG (STM→ESP, JPEG bytes; 10 ardışık IMG = 1 burst)
- `0x02` RESULT (ESP→STM, ASCII `"1;Ali_Yilmaz;0.94"` veya `"0;;0.0"`)
- `0x03` HB (her iki yön, payload=0; her 5 sn)
- `0x04` ERR (ESP→STM, ASCII: `"no_wifi"`, `"http_500"`, `"json_parse"`...)
- `0x05` ACK (her iki yön)

CRC8 polynomial 0x07, payload üzerinde.

ESP burst session yönetimi:
- İlk IMG'de session_id (UUID v4) üretir
- 10 IMG sayar
- Burst gap timeout (3 sn ardışık IMG gelmezse) ile yarım burst düşer

## STM32 ↔ HM-10 protokolü (UART2, 9600, ASCII text, newline)

HM-10 transparent — STM'in UART2'ye yazdığı, BLE notify olarak telefona gider.

STM → telefon:
```
SCANNING\n           (TARA basıldı, burst başlıyor)
MATCH:<isim>;<skor>\n
NOMATCH\n
PANIC\n
NETERR\n             (ESP'ten ERR geldi → safe-mode)
HB\n                 (her 5 sn)
```

Telefon → STM (BLE write, opsiyonel ileride config için):
```
SETPHONE:155\n
RESET\n
```

## Sunucu (Flask + InsightFace)

Konum: `face-mac/server/`

Dosyalar:
- `app.py` — Flask routes, session manager, agregasyon
- `recognition.py` — InsightFace wrapper (buffalo_l), kalite filtresi
- `db.py` — pickle DB, L2-normalized cosine match
- `enroll.py` — CLI: tek fotoğrafla DB'ye kişi ekle
- `requirements.txt`, `Dockerfile`, `deploy_ec2.sh`
- `test_simulate_burst.py` — ESP32'yi simüle eden Mac test scripti

Endpoint:
- `GET /health` → DB boyutu + açık session sayısı
- `POST /search` (header: `X-Session-Id`, `X-Frame-Index`, `X-Frame-Total`; body: JPEG)
  - Ara frame'lerde: `{"status":"continue","frames_received":k,...}`
  - Son frame'de: `{"match":bool,"name":str,"similarity":float,"frames_used":int,"liveness_score":float,...}`

Agregasyon mantığı (final frame):
1. Session içindeki kalite-geçen frame'lerin ArcFace embedding'lerini topla
2. `MIN_QUALITY_FRAMES` (varsayılan 5) altındaysa: `insufficient_quality_frames`
3. Embedding'lerin centroid'ini al → DB ile cosine sim
4. Threshold (varsayılan 0.4) üstündeyse MATCH
5. Embedding cross-frame std → passive liveness skoru (replay tespiti için)

Kalite filtresi (her frame için):
- det_score ≥ 0.7
- bbox alanı ≥ 80×80
- |yaw| ≤ 30°
- Laplacian variance (blur) ≥ 50

Env varlar:
- `DB_PATH` (default: `embeddings.pkl` server klasöründe)
- `MATCH_THRESHOLD` (default: 0.4)
- `MIN_QUALITY_FRAMES` (default: 5)
- `SESSION_TIMEOUT_S` (default: 30)
- `PORT` (default: 8000)

Faz 1 çalıştırma (Mac):
```bash
cd /Users/gokturkgocen/Bitirme/face-mac/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python app.py
# http://0.0.0.0:8000 — Mac IP'siyle ESP'den eriş
```

Faz 1 enrollment:
```bash
cd /Users/gokturkgocen/Bitirme/face-mac/server
source venv/bin/activate
python enroll.py /path/to/photo.jpg "Ali_Yilmaz_001"
```

Faz 1 burst simülasyonu (ESP olmadan):
```bash
python test_simulate_burst.py /path/to/photo.jpg http://localhost:8000/search
# beklenen: 10 POST gider, son cevapta match true/false
```

Faz 2 deploy:
```bash
export EC2_HOST="ec2-user@1.2.3.4"
export KEY_PATH="~/.ssh/taxi-key.pem"
./deploy_ec2.sh
```

## ESP32 firmware

Konum: `face-mac/esp32/`

Dosyalar:
- `platformio.ini`
- `include/config.h` — Wi-Fi creds, server URL, USE_TLS flag, pin/timeout konfig
- `src/main.cpp` — UART frame protokolü + burst session_id üretimi + HTTP POST + JSON parse + result encoding

Faz 1 ↔ Faz 2 farkı: `config.h` içinde `SERVER_URL` ve `USE_TLS` değişir. Reflash, tamam.

## Android app v2 (yeni — donanım gelince)

Konum: `face-mac/android-v2/` (henüz boş, Android Studio projesi olarak açılacak)

Stack:
- Kotlin + Jetpack Compose
- `BluetoothLeScanner` + `BluetoothGatt` (HM-10 service `0000FFE0-...`, char `0000FFE1-...`)
- Foreground Service (BLE persistance)
- `Intent.ACTION_CALL("tel:155")`
- Permissions: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `CALL_PHONE`, `FOREGROUND_SERVICE`, `POST_NOTIFICATIONS`
- Min SDK: API 26 (Android 8.0+)

Mevcut iPhone app UI'sini referans al (5 ekran: Login, Home, Logs, Settings, BottomNav). Compose'a port et. Renk paleti: #0A1F44 navy, #FFD43A yellow.

## v1 — referans (silmedik, atmadık)

v1 (Mac webcam + InsightFace yerel + iPhone) artık production yolu değil ama **referans olarak duruyor.** v2 sunucu kodu (`server/`) v1'in `recognize.py` + `db.py` + `embeddings.pkl` kalbinin damıtılmış halidir.

### v1 dosyaları (top-level, dokunma)
- `recognize.py`, `enroll.py`, `enroll_batch.py` — yerel pipeline
- `db.py`, `embeddings.pkl` — pickle DB (server'ın input source'u olabilir)
- `antispoof.py` + `antispoof_models/` + `src/` — MiniFASNet (server'da kullanılmıyor; multi-frame liveness onun yerini aldı)
- `tracker.py`, `liveness_challenge.py` — IoU tracker, mediapipe blink/yaw (server'da kullanılmıyor; tek-shot değil multi-frame agregasyon)
- `emitter.py`, `event_log.py`, `events.jsonl` — eski USB-serial emitter
- `evaluation/`, `bench.py`, `config.yaml`, `known_faces/`
- `venv/` — Python 3.11 venv (`server/venv/`'ı buradan kopyalamak yerine yeni venv aç)

### iphone-app/ (üst dizinde, Plan B)
**DOKUNMA.** Android engellenirse aktif edilir.

### v1'den server'a damıtma fikri
v1 kodunda anlamlı parçalar:
- `enroll.py` mantığı → `server/enroll.py`
- `recognize.py`'daki face detect + embed çağrıları → `server/recognition.py`
- `db.py`'daki pickle DB → `server/db.py` (L2 norm + cosine eklendi)
- Smoothing/median fikri → multi-frame centroid (eşdeğer)

v1 `embeddings.pkl`'in v2'de doğrudan kullanılabilirliği: format aynı (list of (name, embedding) tuples). v1'den 30 kişi enroll ettiysen `embeddings.pkl`'i `server/`'a kopyalayıp kullanabilirsin.

### v1 gotcha'ları (server'a etki edenler dahil)
- **MiniFASNet input 0-255 float** — `.div(255)` YAPMA. Server kullanmıyor ama v1 referansında.
- **onnxruntime CoreML provider** RetinaFace'te dinamik shape hatası → **server `CPUExecutionProvider` zorla** (recognition.py'da set edilmiş)
- **mediapipe ≥ 0.10.22** Mac arm64'de `mp.solutions` kaldırıldı → 0.10.21 pin (server kullanmıyor, sorun değil)
- **face_crops deque maxlen 5** — v1 stream-time
- **insightface buffalo_l ilk indirme** ~250 MB tek seferlik. `~/.insightface/models/buffalo_l/` altına iniyor. Faz 2 Dockerfile'ında pre-download var.

## İş paketleri (sıralı)

| Sıra | İş | Çıktı | Donanım gerek? |
|---|---|---|---|
| 1 | Server kurulumu (Mac) + venv + requirements | `python app.py` ayağa kalkıyor | Hayır |
| 2 | v1 `embeddings.pkl`'i server/'a kopyala VEYA `enroll.py` ile yeniden ekle | DB dolu | Hayır |
| 3 | `test_simulate_burst.py` ile uçtan uca smoke test | 10-frame burst → match döner | Hayır |
| 4 | BOM siparişi (OV2640, ESP32, HM-10, LED, buzzer, buton, breadboard) | Parça eli | — |
| 5 | ESP32 PlatformIO build + flash, Wi-Fi STA test | Wi-Fi'a bağlanıyor, log'lar OK | ESP geldi |
| 6 | ESP32'yi USB-TTL ile besle, sahte UART frame'i gönder, server'a POST atıyor mu | Lokal LAN test | ESP geldi |
| 7 | STM32 CubeMX projesi: DCMI + UART1 + UART2 + GPIO + EXTI, ETH disable | Pin matrisi temiz, build geçiyor | STM var |
| 8 | STM firmware: OV2640 SCCB init, DCMI tek frame, UART1 hex dump | UART'ta JPEG SOI/EOI görünüyor | OV2640 geldi |
| 9 | STM firmware: 5 FPS × 10 frame burst + state machine + LED/buzzer | Buton bas → 10 frame ESP'ye gidiyor | OV2640 + ESP |
| 10 | HM-10 entegrasyon, MATCH/PANIC frame BLE'de görünür | nRF Connect log | HM-10 |
| 11 | Android app v2: BLE central + Intent.CALL + foreground service | Uçtan uca 155 araması tetikleniyor | Hepsi |
| 12 | 20-30 kişi enroll, FAR/FRR ölçümü (rapor 1.3 hedefi) | Doğruluk tablosu | Hepsi |
| 13 | Test düzeneği: ışık (100/300/600 lx), mesafe (30-120 cm) — Tablo 5.1 | Sonuç tablosu | Hepsi |
| 14 | Faz 2 cloud deploy (Dockerfile + deploy_ec2.sh) | EC2'de healtcheck OK, ESP yeni URL ile çalışıyor | — |
| 15 | Tez yazımı + sergi hazırlığı | Final rapor + demo videosu | — |

## Kararlar (nihai)

| Karar | Neden | Reddedilen |
|---|---|---|
| Kendi sunucumuz + buffalo_l (AWS Rekognition değil) | Modeli biz seçtik, FAR/FRR kontrolümüzde, KVKK netleşir, tezde dolgun savunma | AWS Rekognition (kapalı kutu); Face++ (Çin sunucu); Azure Face (kapatıldı) |
| Multi-frame burst (10 frame) | Tek-frame kırılgan; multi-frame robust + bedava passive liveness | Tek-shot snapshot |
| Centroid agregasyon | Embedding ortalaması basit ve sağlam | Majority voting (daha gürültülü) |
| Pickle DB (PostgreSQL/SQLite değil) | 30 kişi için overkill; v1 ile uyumlu | SQL, vektör DB |
| Faz 1: Mac LAN, Faz 2: EC2 (sıçrama yok) | Risk azaltma; aynı kod, sadece host değişir | Direkt cloud (donanım gelmeden test riski) |
| Flask (FastAPI değil) | Tez için yeterli, dependency az, sync model çağrıları zaten thread-safe değil | FastAPI (async ama InsightFace blocking) |
| ESP32-WROOM (ESP-01 değil) | TLS+cert chain RAM güvenliği | ESP-01 patlama riski |
| OV2640 + DCMI (USB UVC değil) | Donanım JPEG encoder, STM-merkezli, gecikme düşük | USB UVC + OTG, Wi-Fi IP cam |
| HM-10 BLE (HC-05 SPP değil) | Komut data tiny, BLE yeter, iPhone bonus uyumu | HC-05 SPP |
| 921600 UART STM↔ESP (SPI değil) | Basit, debug rahat, 30 KB ~260 ms kabul | SPI ~10 ms ama ekstra kod |
| Intent.ACTION_CALL (tel://dialer değil) | Otomatik 155 araması, sürücü onayı yok | tel://dialer (iOS sandbox kalıntı) |
| Buton tetik (kapı switch değil — şimdilik) | Demo için hızlı | Kapı switch'i sahaya çıkarken eklenir |

## Red flag (yan yola sapıyorum sinyali)
- "AWS Rekognition'a geri dönelim" → HAYIR, kararlı şekilde sildik
- "Lambda da olsun yedek" → HAYIR, scope büyür, gerek yok
- "Yerel + cloud hibrit yapalım" → HAYIR, Faz 1 (Mac LAN) zaten "yerel"in karşılığı
- "iPhone app'i de Android'le paralel sürdürelim" → arşiv kalsın, tek hedef Android
- "buffalo_l yerine başka model deneyelim" → HAYIR, FAR/FRR ölçümü tezde değer; yeni model = yeni baseline
- "MiniFASNet'i geri ekleyelim" → HAYIR, multi-frame centroid varyansı zaten passive liveness, ekstra CPU yükü gereksiz
- "STM32'de TFLite face recog deneyelim" → HAYIR, F767ZI yetmez, kapsam dışı
- "JPEG yerine raw RGB gönderelim" → HAYIR, UART boğulur
- "Pi 4 ekleyelim" → HAYIR, ESP32 yeterli ve bütçe lehine

## Gotcha'lar (donanım gelince doğrulanacak)
- **DCMI ↔ ETH pin çakışması** — CubeMX'te ETH disable, DCMI'ye geç
- **PB7 LD2 mavi LED ↔ DCMI VSYNC** — VSYNC'i PG9'a al
- **OV2640 SCCB init** — Adafruit / ST CubeF7 örneklerinden adapt et
- **OV2640 JPEG değişken boyut** — VSYNC end IRQ'da DMA NDTR oku
- **ESP32 TLS Faz 2** — Let's Encrypt cert için ISRG Root X1, AWS endpoint için Amazon Root CA1. Şu an `setInsecure()` placeholder, prod'da değiştir
- **Android Foreground Service API 26+** — `NotificationChannel` + ongoing notification zorunlu
- **Android 12+ BT runtime permission** — `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` runtime al
- **155 araması SIM'siz çalışmaz** — test telefonunda SIM olduğunu doğrula
- **HM-10 default baud 9600** — STM tarafında 9600 ayarla
- **InsightFace ilk yükleme** — buffalo_l ~250 MB ilk çağrıda iniyor; Mac'te `~/.insightface/models/buffalo_l/`, Docker'da pre-download var
- **Burst gap timeout** — STM ardışık IMG göndermezse ESP yarım session'ı 3 sn'de düşürüyor; STM tarafında timer ile ardışık capture garanti et
- **MIN_QUALITY_FRAMES = 5** — 10 frame'in 5'i kalite geçemezse "tekrar tara" dönüyor; threshold çok katıysa düşür

## Dosya yapısı (mevcut)

```
face-mac/                                  # adı eski ama kayıt karışmasın diye dokunma
├── CLAUDE.md                              # bu dosya (nihai)
│
├── server/                                # ⭐ AKTİF — Flask + InsightFace
│   ├── app.py                             # Flask: /health, /search (multi-frame burst)
│   ├── recognition.py                     # InsightFace wrapper, kalite filtresi
│   ├── db.py                              # Pickle DB, cosine match
│   ├── enroll.py                          # CLI: kişi ekle
│   ├── test_simulate_burst.py             # ESP simülatörü
│   ├── requirements.txt
│   ├── Dockerfile                         # Faz 2
│   └── deploy_ec2.sh                      # Faz 2
│
├── esp32/                                 # ⭐ AKTİF — PlatformIO
│   ├── platformio.ini
│   ├── include/config.h                   # Wi-Fi, server URL, USE_TLS
│   └── src/main.cpp                       # UART frame, burst session, HTTP POST
│
├── stm32/                                 # ⭐ AKTİF — CubeIDE (donanım gelince)
│   └── _v1_archive/                       # eski Mac+iPhone bridge firmware
│
├── android-v2/                            # ⭐ AKTİF — Android Studio (donanım gelince)
│
├── android/                               # v1 Kotlin iskeleti, referans
│
│   ─── v1 referans (dokunma) ──────────────────
├── recognize.py                           # v1 yerel pipeline
├── enroll.py, enroll_batch.py
├── db.py, embeddings.pkl                  # ⚠️ embeddings.pkl server/'a kopyalanabilir
├── antispoof.py, antispoof_models/, src/
├── tracker.py, liveness_challenge.py
├── emitter.py, event_log.py, events.jsonl
├── bench.py, evaluation/
├── config.yaml, requirements.txt
├── known_faces/
└── venv/                                  # v1 venv
```

> `iphone-app/` (üst dizinde, repo kökünde) → Plan B, DOKUNMA.

## Hızlı kullanım (özet)

```bash
# Server kurulumu (Mac, Faz 1)
cd /Users/gokturkgocen/Bitirme/face-mac/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Enroll
python enroll.py /path/to/test.jpg "Test_001"

# Server başlat
python app.py
# → 0.0.0.0:8000

# Smoke test (başka terminalde)
python test_simulate_burst.py /path/to/test.jpg http://localhost:8000/search
# beklenen: 10 POST, son cevapta match=true name=Test_001

# Faz 2 deploy
export EC2_HOST="ec2-user@1.2.3.4"
export KEY_PATH="~/.ssh/taxi-key.pem"
./deploy_ec2.sh

# ESP32 build + flash
cd /Users/gokturkgocen/Bitirme/face-mac/esp32
# config.h içinde SERVER_URL ve Wi-Fi ayarla
pio run -t upload
pio device monitor
```

## İletişim notu
- Türkçe konuş (bu projede), kısa ve direkt
- Terminal komutu verirken **full path** ver
- Onay almadan büyük mimari sapma yapma — mimari kilitli
- Emin olmadığın API/parametreyi araştır, varsayım yapma
- v1 ve `iphone-app/` dosyalarına dokunma
