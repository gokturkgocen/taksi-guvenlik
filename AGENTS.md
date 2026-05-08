# AGENTS.md — AI agent (Codex / Claude / etc.) context

> **READ FIRST:** `face-mac/CLAUDE.md` — comprehensive project documentation, kept in sync. This file is a high-level brief; deep details live there.

## Communication rules
- **Türkçe konuş.** Kullanıcı Türk, projenin sohbet dili Türkçe. Kod, commit mesajı, dosya içi yorum İngilizce kalır.
- Kısa ve direkt cevap ver. Plan dump'lama, fikir alışverişi gibi yaz.
- Onay almadan büyük mimari değişiklik yapma. **Mimari kilitli (2026 Mayıs).**
- Emin olmadığın API/parametreyi araştır, varsayım yapma.
- Terminal komutu verirken **full path** kullan.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa burst ile tarayıp, kendi host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa Android telefon BLE üzerinden komut alıp otomatik **155** (polis) çağrısı yapar.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026 dönemi).
**Danışman:** Aydoğan Savran.
**Teslim:** ~2026 Haziran.
**Test telefonu:** Samsung Galaxy S20 FE (eski telefon, tüm izinler verilebilir).
**Geliştirme bilgisayarı:** Mac (M-series).

## Nihai mimari (kilitli)

```
   OV2640 ──DCMI──► STM32 NUCLEO-F767ZI ──UART1 (921600)──► ESP32-WROOM-32
   (yolcu)         │ TARA + PANİK butonu                    │ Wi-Fi STA
                   │ Yeşil/Kırmızı/Sarı LED, buzzer         │ HTTP/HTTPS POST
                   │ 5 FPS × 2 s = 10 frame burst           ▼
                   │                                       Sunucu (Faz 1: Mac LAN, Faz 2: EC2)
                   │                                       Flask + InsightFace buffalo_l
                   │                                       multi-frame centroid agregasyon
                   │                                       pickle DB
                   │
                   └──UART2 (9600)────► HM-10 BLE ──BLE──► Android (Samsung S20 FE)
                                                            Intent.ACTION_CALL("tel:155")
```

## Veri akışı (10-frame burst)
1. Sürücü TARA butonuna basar → STM SARI LED + HM-10 üzerinden telefona "SCANNING\n"
2. STM, 5 FPS × 2 sn = 10 frame yakalar (DCMI/DMA, OV2640 JPEG encoder)
3. Her frame için: STM → UART1 → ESP32; ESP HTTP POST → server (`X-Session-Id`, `X-Frame-Index`, `X-Frame-Total` header'ları)
4. 10. frame'de server agregasyon yapar (kalite filtresi → ArcFace embedding → centroid → cosine sim → DB match → passive liveness)
5. ESP sonucu kompakt CSV `"1;Ali_Yilmaz;0.94"` olarak STM'e UART üzerinden döner
6. STM: MATCH ise KIRMIZI LED + buzzer + HM-10 → "MATCH:Ali_Yilmaz;0.94\n"; NOMATCH ise YEŞİL LED
7. Telefon BLE notify alır, MATCH ise `Intent.ACTION_CALL("tel:155")` ile otomatik arar

Toplam ~5-7 saniye uçtan uca. Latency önemsiz (kullanıcı kararı).

## Faz 1 vs Faz 2

**Faz 1 — Mac LAN (geliştirme):** Mac'te Flask app, telefon hotspot'una bağlı, ESP aynı ağda, `http://192.168.x.x:8000/search`. TLS yok, auth yok. Hızlı debug.

**Faz 2 — Cloud (production):** Aynı kod Docker'da, EC2 t3.small'a deploy, `https://taxi.your-domain.com/search`. ESP `config.h`'da URL + `USE_TLS=1` swap, reflash. Kod aynı.

## Kilit kararlar (LOCK — geri çevrilmiş yollardan biri değil)

| Karar | Neden |
|---|---|
| Kendi sunucumuz + buffalo_l (AWS Rekognition **DEĞİL**) | Modeli kontrol ediyoruz, KVKK temiz, FAR/FRR ölçümü tezde dolgun savunma |
| Multi-frame burst 10 frame (tek-shot **DEĞİL**) | Tek-frame kırılgan, multi-frame robust + bedava passive liveness |
| Centroid agregasyon | Embedding ortalaması basit + sağlam |
| Faz 1 + Faz 2 staging (direkt cloud **DEĞİL**) | Donanım gelmeden Mac'te uçtan uca doğrula, sonra cloud'a swap |
| OV2640 + DCMI (USB UVC **DEĞİL**) | Donanım JPEG encoder, STM-merkezli |
| ESP32-WROOM (ESP-01 **DEĞİL**) | TLS RAM güvenliği |
| HM-10 BLE (HC-05 SPP **DEĞİL**) | Komut data tiny, BLE yeter, iPhone bonus uyumu |
| 921600 UART (SPI **DEĞİL**) | Basit, debug rahat, 30 KB ~260 ms kabul |
| Intent.ACTION_CALL (tel://dialer **DEĞİL**) | Otomatik arama, sürücü onayı yok |
| Android (iPhone **DEĞİL**) | iOS sandbox otomatik aramayı engelliyor; iphone-app rafta Plan B |

## Red flag — sapma sinyalleri
Aşağıdaki teklifler kullanıcıya gelirse veya kafanda oluşursa, **HAYIR de** ve kullanıcıya gerekçeyi hatırlat:
- "AWS Rekognition'a geri dönelim" → SİLİNDİ, geri yok
- "Lambda yedek olarak dursun" → scope büyür, gerek yok
- "Yerel + cloud hibrit" → Faz 1 (Mac LAN) zaten "yerel"in karşılığı
- "iPhone app'i de Android'le paralel sürdürelim" → arşiv, tek hedef Android
- "buffalo_l yerine başka model" → FAR/FRR ölçümü tezde değer; yeni model = yeni baseline
- "MiniFASNet'i geri ekleyelim" → multi-frame std zaten passive liveness
- "STM32'de TFLite face recog" → F767ZI yetmez
- "JPEG yerine raw RGB" → UART boğulur
- "Pi 4 ekleyelim" → ESP32 yeterli, bütçe lehine

## Dosya yapısı (DOKUNMA bölgeleri belirtilmiş)

```
Bitirme/                                  # repo kökü
├── AGENTS.md                             # bu dosya (Codex/AI agent context)
├── Ekin_Ag_aog_lu_Gelis_imRaporu.pdf     # gelişme raporu (Ege Üniv) — DONDU, değiştirme
│
├── face-mac/                             # ana proje klasörü (adı eski)
│   ├── CLAUDE.md                         # ⭐ ANA DOKÜMANTASYON — buradan oku
│   │
│   ├── server/                           # ⭐ AKTİF — Flask + InsightFace
│   │   ├── app.py                        # /health, /search (multi-frame burst)
│   │   ├── recognition.py                # InsightFace wrapper, kalite filtresi
│   │   ├── db.py                         # Pickle DB, cosine match
│   │   ├── enroll.py                     # CLI: kişi ekle
│   │   ├── test_simulate_burst.py        # ESP simülatörü
│   │   ├── requirements.txt
│   │   ├── Dockerfile                    # Faz 2
│   │   └── deploy_ec2.sh                 # Faz 2 deploy
│   │
│   ├── esp32/                            # ⭐ AKTİF — PlatformIO
│   │   ├── platformio.ini
│   │   ├── include/config.h              # Wi-Fi, server URL, USE_TLS
│   │   └── src/main.cpp                  # UART frame, burst session, HTTP POST
│   │
│   ├── stm32/                            # ⭐ AKTİF — CubeIDE (donanım gelince)
│   │   └── _v1_archive/                  # eski Mac+iPhone bridge firmware (DOKUNMA)
│   │
│   ├── android-v2/                       # ⭐ AKTİF — Android Studio (donanım gelince)
│   │
│   ├── android/                          # v1 Kotlin iskeleti, referans (DOKUNMA)
│   │
│   │── (v1 referans — DOKUNMA, eski yerel pipeline) ──
│   ├── recognize.py, enroll.py, enroll_batch.py
│   ├── db.py, embeddings.pkl             # embeddings.pkl server'a kopyalanabilir
│   ├── antispoof.py, antispoof_models/, src/
│   ├── tracker.py, liveness_challenge.py
│   ├── emitter.py, event_log.py
│   ├── bench.py, evaluation/
│   ├── config.yaml, requirements.txt
│   ├── known_faces/
│   └── venv/                             # gitignore'da
│
├── iphone-app/                           # PLAN B — DOKUNMA
│   └── ...                               # SwiftUI app, Android engellenirse aktif
│
└── safety-protocol-design/               # UI mockup (React JSX)
    └── ...                               # Android v2 UI referans kaynağı
```

## Aktif iş paketleri

1. Server kurulumu (Mac, Faz 1) — `face-mac/server/` Flask + venv + requirements
2. v1 `embeddings.pkl`'i server'a kopyala VEYA `enroll.py` ile yeniden ekle
3. `test_simulate_burst.py` ile uçtan uca smoke test (donanımsız)
4. BOM siparişi: OV2640, ESP32-WROOM, HM-10, LED, buzzer, buton, breadboard, jumper (~375 TL)
5. ESP32 PlatformIO build + flash, Wi-Fi STA test
6. ESP32'yi sahte UART frame ile besle, server'a POST testi
7. STM32 CubeMX projesi: DCMI + UART1 + UART2 + GPIO + EXTI, ETH disable
8. STM firmware: OV2640 SCCB init, DCMI tek frame, UART1 hex dump
9. STM firmware: 5 FPS × 10 frame burst + state machine + LED/buzzer
10. HM-10 entegrasyon, MATCH/PANIC frame BLE'de görünür (nRF Connect log)
11. Android app v2: BLE central + Intent.CALL + foreground service
12. 20-30 kişi enroll, FAR/FRR ölçümü
13. Test: ışık (100/300/600 lx), mesafe (30-120 cm) — rapor Tablo 5.1
14. Faz 2 cloud deploy (Dockerfile + deploy_ec2.sh)
15. Tez yazımı + sergi hazırlığı

## Hızlı kullanım (özet — full path'lar `face-mac/CLAUDE.md`'de)

```bash
# Server kurulumu (Faz 1, Mac)
cd face-mac/server
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Enroll
python enroll.py /path/to/test.jpg "Test_001"

# Server başlat
python app.py

# Smoke test (başka terminalde)
python test_simulate_burst.py /path/to/test.jpg http://localhost:8000/search

# ESP32
cd ../esp32
# config.h'da SERVER_URL ve Wi-Fi ayarla
pio run -t upload
```

## Codex/Claude/diğer agent için son not
- **Detaylar `face-mac/CLAUDE.md`'de.** Pin plan, protokol detayları, gotcha'lar, agregasyon mantığı orada.
- Mimari kilitli — yukarıdaki "Red flag" listesini iki kere oku.
- Geliştirme raporu PDF kök dizinde — rapor dondu, değiştirme; ama hedef metrikler (Bölüm 1.3) ve mimari kısıtlar (Bölüm 3) hâlâ geçerli, dokümantasyonun bu sınırlar içinde kalıyor.
- v1 (Mac+InsightFace yerel + iPhone) referans olarak duruyor, server kodu v1'in damıtılmış hali. v1'e dokunma.
