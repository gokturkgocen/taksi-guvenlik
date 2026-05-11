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

## Nihai mimari (kilitli)

```
   OV5640 ──DCMI──► STM32 NUCLEO-F767ZI ──UART1 (921600)──► ESP32-WROOM-32
   (yolcu)         │ TARA + PANİK butonu                    │ Wi-Fi STA
                   │ Yeşil/Kırmızı/Sarı LED, buzzer         │ HTTP POST
                   │ 5 FPS × 2 s = 10 frame burst           ▼
                   │                                       EC2 m7i-flex.large (eu-central-1)
                   │                                       Flask + InsightFace buffalo_l
                   │                                       18.192.45.175:8000 (Faz 1)
                   │                                       multi-frame centroid agregasyon
                   │                                       pickle DB
                   │
                   └──UART2 (9600)────► HM-10/HM-19 ──BLE──► Android (Samsung S20 FE)
                                                            Intent.ACTION_CALL("tel:155")
```

## Veri akışı (10-frame burst)
1. Sürücü TARA butonu → STM SARI LED + HM-10 üzerinden "SCANNING\n"
2. STM, 5 FPS × 2 sn = 10 frame yakalar (DCMI/DMA, OV5640 JPEG)
3. Her frame: STM → UART → ESP32 → HTTP POST → EC2 (X-Session-Id, X-Frame-Index, X-Frame-Total)
4. 10. frame'de server agregasyon (kalite filtresi → ArcFace embedding → centroid → cosine sim → DB match → passive liveness)
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
| OV5640 (OV2640 yerine) | ST resmi BSP driver, 1-2 gün debug kazancı |
| ESP32-WROOM ayrı (ESP32-CAM **Plan B**) | STM-merkezli mimari, ESP sadece Wi-Fi köprüsü |
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
│   │   ├── app.py, recognition.py, db.py, enroll.py
│   │   ├── test_simulate_burst.py
│   │   ├── Dockerfile, deploy_ec2.sh, requirements.txt
│   ├── esp32/                            # ⭐ PlatformIO firmware
│   │   ├── platformio.ini
│   │   ├── include/config.h
│   │   └── src/main.cpp
│   ├── stm32/                            # ⭐ CubeIDE (donanım gelince)
│   └── android-v2/                       # ⭐ Android Studio (donanım gelince)
│
└── iphone-app/                           # PLAN B — DOKUNMA, Android engellenirse aktif
```

## Aktif iş paketleri

1. ✅ EC2 sunucu deploy + Faz 1 uçtan uca test (health OK, burst smoke geçti)
2. Çankaya'dan donanım (BOM CLAUDE.md'de)
3. ESP32 PlatformIO build + flash, Wi-Fi STA test
4. ESP32 sahte UART frame ile server'a POST testi
5. STM32 CubeMX projesi: DCMI + UART1 + UART2 + GPIO + EXTI, ETH disable
6. STM firmware: OV5640 SCCB init, DCMI tek frame, UART1 hex dump
7. STM firmware: 5 FPS × 10 frame burst + state machine + LED/buzzer
8. HM-10 entegrasyon + STM olay yönetimi
9. Android app v2: BLE central + Intent.CALL + foreground service
10. 20-30 kişi enroll, FAR/FRR ölçümü
11. Test: ışık (100/300/600 lx), mesafe (30-120 cm) — rapor Tablo 5.1
12. Tez yazımı + sergi hazırlığı

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
