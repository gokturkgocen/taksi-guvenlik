# AGENTS.md — AI agent (Codex / Claude / etc.) context

> **READ FIRST:** `face-mac/CLAUDE.md` — comprehensive project documentation. This file is a high-level brief; details live there.

## Communication rules
- **Türkçe konuş.** Kullanıcı Türk, projenin sohbet dili Türkçe. Kod, commit mesajı, dosya içi yorum İngilizce kalır.
- Kısa ve direkt cevap ver.
- Onay almadan büyük mimari değişiklik yapma. **Mimari kilitli (2026 Mayıs).**
- Yapılan her kod değişikliğini commit + push et, anlamlı commit mesajı yaz.
- Emin olmadığın API/parametreyi araştır, varsayım yapma.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa burst ile tarayıp, EC2'de host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa Android telefon BLE üzerinden komut alıp otomatik **155** çağrısı.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026).
**Danışman:** Aydoğan Savran.
**Teslim:** 12 gün içinde sunum + sergi.
**Test telefonu:** Samsung Galaxy S20 FE.
**Geliştirme bilgisayarları:** Mac (kullanıcı: `/Users/gokturkgocen/Bitirme/`), partner Mac (`/Users/ekinagaoglu/bitirme/`).

## Nihai mimari (kilitli — **Plan B aktif**)

> Plan A (STM-merkezli + standalone DVP OV5640 + DCMI) terkedildi. Çankaya'da DVP/parallel OV5640
> modülü bulunamadı, DCMI entegrasyonu için kabul edilebilir süreyi aştı. **Plan B kilitli**:
> kamera + Wi-Fi tek board'da ESP32-CAM (AI-Thinker, OV3660), STM32 olay orkestratörü olarak
> kalır. Bütün firmware ve doküman bu mimari üzerine kurulu. **Detayları `face-mac/CLAUDE.md`.**

```
   Yolcu yüzü ─► ESP32-CAM (AI-Thinker, OV3660)
                 │ 5 FPS × 2 s = 10 frame burst
                 │ Wi-Fi STA · HTTP POST ─► EC2 m7i-flex.large (eu-central-1)
                 │                          Flask + InsightFace buffalo_l
                 │                          18.192.45.175:8000 (Faz 1)
                 │                          multi-frame centroid + passive liveness
                 │                          pickle DB
                 │ UART (115200) "CAPTURE" / "RESULT"
                 ▼
   STM32 NUCLEO-F767ZI
                 │ TARA + PANİK buton (EXTI)
                 │ Yeşil/Sarı/Kırmızı LED + buzzer
                 │ State machine: IDLE/SCAN/MATCH/NOMATCH/PANIC/NETERR
                 │ UART2 (9600)
                 ▼
   HM-10/HM-19 ──BLE──► Android (Samsung S20 FE)
                        Intent.ACTION_CALL("tel:155")
```

## Veri akışı (10-frame burst)
1. Sürücü TARA butonu → STM SARI LED + HM-10 üzerinden "SCANNING\n"
2. STM, UART üzerinden ESP32-CAM'e "CAPTURE" komutu yollar
3. ESP32-CAM 5 FPS × 2 sn = 10 frame yakalar, her frame'i Wi-Fi üzerinden EC2'ye POST eder
   (X-Session-Id, X-Frame-Index, X-Frame-Total başlıkları)
4. 10. frame'de server agregasyon (kalite filtresi → ArcFace embedding → centroid → cosine sim
   → DB match → passive liveness)
5. ESP sonucu CSV `"1;name;0.94"` olarak STM'e UART üstünden döner
6. STM: MATCH → KIRMIZI LED + buzzer + HM-10 → "MATCH:..\n"; NOMATCH → YEŞİL LED
7. Telefon BLE notify alır, MATCH ise `Intent.ACTION_CALL("tel:155")` otomatik arar

Toplam ~5-7 sn. Latency önemsiz.

## Faz 1 (mevcut) vs Faz 2 (opsiyonel)

**Faz 1 — EC2 HTTP public IP:** `http://18.192.45.175:8000`, TLS yok, port 8000 açık. Demo + test için yeterli.

**Faz 2 — Domain + HTTPS:** Caddy/nginx + Let's Encrypt, ESP `USE_TLS=1` + ISRG Root X1. ESP `config.h` swap + reflash. ~half day iş.

## Kilit kararlar (LOCK)

| Karar | Neden |
|---|---|
| Kendi sunucumuz + buffalo_l (AWS Rekognition **DEĞİL**) | Modeli kontrol ediyoruz, KVKK temiz, FAR/FRR tezde dolgun savunma |
| Multi-frame burst 10 frame (tek-shot **DEĞİL**) | Robust + bedava passive liveness |
| ESP32-CAM AI-Thinker + OV3660 (**Plan B kilitli**) | DVP OV5640 modülü bulunamadı; kamera + Wi-Fi tek board'da, STM olay orkestratörü |
| STM32 NUCLEO-F767ZI olay yöneticisi | Buton/LED/buzzer/HM-10; tanıma server'da, kamera ESP'te |
| HM-10/HM-19/AT-09 BLE (HC-05 **DEĞİL**) | Komut data tiny, BLE yeter |
| 921600 UART STM↔ESP (SPI değil) | Basit, debug rahat |
| Intent.ACTION_CALL (tel://dialer **DEĞİL**) | Otomatik 155 |
| Android (iPhone **DEĞİL**) | iOS sandbox otomatik aramayı engelliyor; iphone-app rafta Plan B |
| EC2 m7i-flex.large eu-central-1 | Free Plan içinde en güçlü, $200 hediye krediyle ~$23/12 gün |
| Gunicorn -w 1 | Session state in-memory per-process; -w 2+ burst'u kırar |

## Plan B — ESP32-CAM (eğer STM+OV5640+DCMI tıkanırsa)

OV5640+DCMI 1-2 günden fazla tıkanırsa: ESP32-CAM kamerasıyla yakalar, Wi-Fi'dan POST'lar. STM32 sadece LED/buzzer/buton/HM-10. Mimari biraz değişir, "STM=olay orkestratörü, ESP32-CAM=delege edilmiş kamera+ağ peripheral" diye savunulur.

## Red flag — sapma sinyalleri
- "AWS Rekognition'a geri dönelim" → HAYIR, silindi
- "Lambda yedek olarak dursun" → scope büyür, gerek yok
- "Yerel + cloud hibrit" → Faz 1 zaten "yerel"in karşılığı
- "iPhone app'i de Android'le paralel sürdürelim" → arşiv, tek hedef Android
- "buffalo_l yerine başka model" → FAR/FRR ölçümü tezde değer
- "MiniFASNet'i geri ekleyelim" → multi-frame std zaten passive liveness
- "STM32'de TFLite face recog" → F767ZI yetmez
- "JPEG yerine raw RGB" → UART boğulur
- "Pi 4 ekleyelim" → ESP32 yeterli
- "Gunicorn worker artıralım" → session state kırılır

## Dosya yapısı

```
Bitirme/                                  # repo kökü
├── AGENTS.md                             # bu dosya
├── Ekin_Ag_aog_lu_Gelis_imRaporu.pdf     # gelişme raporu, DONDURULDU
├── taxi-key.pem                          # EC2 SSH key (gitignore'da)
├── .gitignore
│
├── face-mac/                             # ana proje klasörü
│   ├── CLAUDE.md                         # ⭐ ANA DOKÜMANTASYON
│   ├── server/                           # ⭐ Flask + InsightFace (EC2'de canlı)
│   ├── esp32-cam/                        # ⭐ PlatformIO firmware (Plan B aktif)
│   └── stm32/                            # ⭐ CubeIDE firmware (donanım üstünde test edildi)
│
├── poster/                               # ⭐ Bitirme sergi posteri (70×100 cm)
│   ├── poster.html                       # ana poster (akademik ETH/MIT tarzı)
│   └── poster_yeni.html                  # +Pin planı, FAR/FRR matrisi, QR ekli versiyon
│
└── iphone-app/                           # Eski iOS denemesi — DOKUNMA
```

## Aktif iş paketleri (güncel — 2026-05)

1. ✅ EC2 sunucu deploy + Faz 1 uçtan uca test (health OK, burst smoke geçti)
2. ✅ Donanım tedarik (Plan B: ESP32-CAM + STM32 F767ZI + HM-10 + LED/buzzer/buton)
3. ✅ ESP32-CAM PlatformIO build + flash, Wi-Fi STA bağlantı testi
4. ✅ ESP32-CAM → EC2 HTTP POST testi (burst frame'leri server'a iletildi, JSON cevap alındı)
5. ✅ STM32 CubeMX projesi: UART1 + UART2 + GPIO + EXTI (ETH disable, DCMI N/A — Plan B)
6. ✅ STM32 firmware: button (TARA/PANİK), LED (yeşil/sarı/kırmızı), buzzer, state machine
7. ✅ STM ↔ ESP32-CAM UART köprüsü çalışıyor (CAPTURE komutu / RESULT cevabı)
8. ⏳ HM-10 entegrasyon + STM → telefon BLE notify
9. ⏳ Android app v2: BLE central + Intent.CALL + foreground service
10. ⏳ 20-30 kişi enroll, FAR/FRR ölçümü
11. ⏳ Test: ışık (100/300/600 lx), mesafe (30-120 cm) — rapor Tablo 5.1
12. ⏳ Tez yazımı + sergi hazırlığı (poster `poster/poster.html` ve `poster/poster_yeni.html` hazır)

> Donanım entegre testi: ESP32-CAM ve STM32 birlikte ayağa kalktı; uçtan uca burst akışı
> (STM TARA → ESP CAPTURE → EC2 POST → JSON dönüş → STM RESULT) doğrulandı. Sonraki adım
> HM-10 + Android halkasının kapatılması.

## EC2 hızlı erişim
- IP: `18.192.45.175`
- SSH: `ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175`
- Health: `curl http://18.192.45.175:8000/health`
- Container: `taxi-server` (Docker, `--restart unless-stopped`)
- DB'de Gokturk + Ekin enrolled

## Codex/Claude/diğer agent için son not
- **Detaylar `face-mac/CLAUDE.md`'de.** Pin plan, protokol, agregasyon mantığı, gotcha'lar orada.
- Mimari kilitli — yukarıdaki "Red flag" listesini iki kere oku.
- Geliştirme raporu PDF kök dizinde — rapor dondu, değiştirme.
- `iphone-app/` ve `taxi-key.pem` DOKUNMA.
- Her kod değişikliği commit + push, anlamlı mesajla.
