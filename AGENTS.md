# AGENTS.md — AI agent (Codex / Claude / etc.) context

> **READ FIRST:** `face-mac/CLAUDE.md` — comprehensive project documentation, single source of truth. This file is a high-level brief; details and full pin/protocol/decision tables live there.

## Communication rules
- **Türkçe konuş.** Kullanıcı Türk, projenin sohbet dili Türkçe. Kod, commit mesajı, dosya içi yorum İngilizce kalır.
- Kısa ve direkt cevap ver.
- Onay almadan büyük mimari değişiklik yapma. **Mimari kilitli (Plan B v2 — 2026 Mayıs).**
- Yapılan her kod değişikliğini commit + push et, anlamlı commit mesajı yaz.
- Emin olmadığın API/parametreyi araştır, varsayım yapma.

## Proje özeti
**Ne:** Takside arka koltuğa oturan yolcunun yüzünü 10 frame'lik kısa burst ile tarayıp, EC2'de host ettiğimiz InsightFace tabanlı sunucuda suçlu yüz veritabanıyla karşılaştırmak. Eşleşme varsa şoförün iPhone'una BLE üzerinden bildirim, otomatik 155 çağrı ekranı.

**Kime:** Ege Üniversitesi EE Bölümü bitirme tezi (2025–2026).
**Danışman:** Aydoğan Savran.
**Test telefonu:** iPhone 16.
**Geliştirme Mac'leri:** `/Users/gokturkgocen/Bitirme/`, partner `/Users/ekinagaoglu/bitirme/`.

## Nihai mimari (Plan B v2 — kilitli)

```
   Yolcu yüzü ─► ESP32-CAM (AI-Thinker, OV3660)
                 │ Wi-Fi STA · HTTP POST ─► EC2 (Flask + InsightFace buffalo_l)
                 │                          18.192.45.175:8000  eu-central-1
                 │
                 │ USART (Arduino D0/D1, 115200, ASCII satır)
                 │ "CAPTURE" ⇄ "RESULT:..." ⇄ STM event mesajları
                 │
                 ├─► BLE peripheral "TaxiGuard" (FFE0/FFE1, notify+write, MTU 247)
                 │      └─► iPhone 16 (SwiftUI app), MATCH→tel://155 dialer
                 ▼
   STM32 NUCLEO-F767ZI (HSI×PLL → 216 MHz)
                 │ TARA = B1 USER (PC13)  ·  PANİK = PA0 (harici)
                 │ LED'ler onboard + harici buzzer
                 │ State machine: IDLE/SCANNING/MATCH/NOMATCH/PANIC/NETERR
```

**HM-10 atıldı.** ESP-CAM'in dahili BLE'si telefon-yönü işini görüyor.

## Kilit kararlar (LOCK)

| Karar | Neden |
|---|---|
| Kendi sunucumuz + buffalo_l (AWS Rekognition **DEĞİL**) | Modeli kontrol, KVKK temiz, FAR/FRR tezde dolgun |
| Multi-frame burst 10 frame (tek-shot **DEĞİL**) | Robust + bedava passive liveness |
| ESP32-CAM (Plan B kilitli, standalone OV5640 **DEĞİL**) | DVP modülü bulunamadı; tek board hem kamera hem BLE |
| ESP-CAM entegre BLE (HM-10 **DEĞİL**) | Tek board, daha az kablo, Morpho karmaşası yok |
| USART6 Arduino D0/D1 (USART1 Morpho **DEĞİL**) | Silkscreen kolay identify |
| HSI×PLL → 216 MHz (HSE bypass **DEĞİL**) | HAL HSE_VALUE makrosu 25 MHz, NUCLEO 8 MHz, BRR sapıtıyor |
| iPhone SwiftUI (Android **şu an değil**) | iPhone elde, iOS dialer tek-tık demo için pratik |
| `tel://155` dialer (auto-call DEĞİL) | iOS sandbox tam otomatik vermez; tek-tık onay tezde "yanlış pozitif koruma" |
| EC2 m7i-flex.large eu-central-1 | Free Plan içinde en güçlü, $200 hediye krediyle ~$23/12 gün |
| Gunicorn `-w 1` | Session state in-memory; multi-worker burst'u kırar |
| Kalite filtresi min_blur=10 | ESP-CAM küçük lens VGA için 50 hep eler |
| BLE MTU 247 | Varsayılan 23 mesajları 20 byte'ta kesiyor |

## Red flag — sapma sinyalleri (HAYIR de)
- AWS Rekognition'a dönüş
- HM-10'u geri ekleme
- Standalone OV5640 + DCMI
- HSE bypass (HAL HSE_VALUE bozuk)
- USART1/Morpho ile ESP-CAM
- Android app yazımı (demo zamanı yetmez)
- buffalo_l yerine başka model
- MiniFASNet anti-spoof ekleme
- STM32'de TFLite face recog
- JPEG yerine raw RGB
- Pi 4 ekleme
- Gunicorn worker artırma
- ESP-CAM'i STM 5V'tan besleme (brown-out)

## Donanım (BOM)
- STM32 NUCLEO-F767ZI ✓
- ESP32-CAM AI-Thinker (OV3660) ✓
- ESP32-CAM-MB programlama dock'u ✓
- Aktif buzzer 5V ✓
- iPhone 16 (kullanıcının kendisi) ✓
- Jumper kablolar ✓
- **Yedek/kullanılmıyor:** ESP32-WROOM-32 DevKit, HM-10, FT232 USB-TTL, harici LED'ler (onboard yetiyor)

## Çalışan akış (uçtan uca verified)

Şoför B1 USER butonuna basar → STM "CAPTURE\n" + "SCANNING\n" USART6'dan ESP-CAM'e gönderir → ESP "SCANNING" mesajını BLE'den iPhone'a forward eder → ESP flash LED açar, 10 frame yakalar, EC2'ye POST'lar → EC2 InsightFace agregasyon yapar (centroid + cosine sim) → JSON döner → ESP "RESULT:1;Gokturk;0.66\n" UART'tan STM'e → STM state MATCH'e geçer, KIRMIZI LED yakar, "MATCH:Gokturk;0.66\n" ESP'ye gönderir → ESP BLE notify ile iPhone'a yollar → iPhone uygulaması büyük kırmızı kart gösterir + `tel://155` URL'i açar → iOS dialer açılır, şoför yeşil butona tek tık.

## Wiring (sade)

```
ESP-CAM IO13 ────► STM D0 (PG9 USART6 RX)
ESP-CAM IO14 ◄──── STM D1 (PG14 USART6 TX)
ESP-CAM GND ─────► STM GND (ortak referans)
ESP-CAM 5V ◄──── kendi dock USB'sinden (STM 5V'tan değil, brown-out yapıyor)
STM USB ────────► Mac (ST-LINK, debug + flash)
```

## Dosya yapısı

```
Bitirme/
├── AGENTS.md                             # bu dosya
├── Ekin_Ag_aog_lu_Gelis_imRaporu.pdf     # gelişme raporu, DONDURULDU
├── taxi-key.pem                          # EC2 SSH key (.gitignore)
├── .gitignore
│
├── face-mac/
│   ├── CLAUDE.md                         # ⭐ ANA DOKÜMANTASYON
│   ├── embeddings.pkl                    # EC2 DB snapshot
│   ├── server/                           # Flask + InsightFace (EC2'de canlı)
│   ├── esp32-cam/                        # PlatformIO Arduino firmware
│   └── Stm32/taxi_guvenlik/              # CubeIDE projesi
│
├── poster/                               # sergi posteri HTML
│
└── iphone-app/                           # SwiftUI iPhone app (aktif)
    ├── project.yml                       # XcodeGen
    ├── TaksiGuvenlik/                    # 4 dosya: App, AppState, BLEManager, ContentView
    └── TaksiGuvenlik.xcodeproj/
```

## Aktif iş paketleri (durum: 2026-05-14)
1. ✅ EC2 sunucu deploy + uçtan uca AWS test
2. ✅ ESP-CAM Wi-Fi + HTTP POST + camera burst + JSON parse
3. ✅ STM 216 MHz HSI×PLL clock + USART3 VCP printf
4. ✅ STM ↔ ESP-CAM UART köprü (Arduino D0/D1)
5. ✅ STM state machine (IDLE/SCANNING/MATCH/NOMATCH/PANIC/NETERR)
6. ✅ ESP-CAM BLE peripheral "TaxiGuard" advertising
7. ✅ iPhone SwiftUI app BLE central + auto-dial 155
8. ✅ Uçtan uca demo: B1 → SCANNING → MATCH → 155 dialer (Gokturk + Ekin tanındı)
9. 🟡 MATCH ekranında benzerlik %0 görünme bug'ı → MTU 247'ye bump yapıldı, parser defansif, son test bekliyor
10. ⏳ 20-30 kişi enrollment + FAR/FRR ölçümü
11. ⏳ Aydınlatma (100/300/600 lx) + mesafe (30-120 cm) testleri
12. ⏳ Tez yazımı + sergi hazırlığı (poster taslakları mevcut)

## EC2 quick reference
- IP: `18.192.45.175`, HTTP port 8000
- SSH: `ssh -i /Users/gokturkgocen/Bitirme/taxi-key.pem ec2-user@18.192.45.175`
- Health: `curl http://18.192.45.175:8000/health`
- Server logs: `docker logs --tail 20 taxi-server`
- DB: `/home/ec2-user/data/embeddings.pkl` (Gokturk + Ekin)

## Codex onboarding sırası (sıfırdan açan agent için)

**İlk turn'de bu sırayla oku (atlama):**
1. `AGENTS.md` (bu dosya) — proje brief, kilit kararlar, red flag listesi.
2. `face-mac/CLAUDE.md` — ⭐ ana doküman. Pin plan, protokol, agregasyon, gotcha, kullanım komutları.
3. Açık iş'e göre ilgili kaynak:
   - BLE / iPhone bug: `iphone-app/TaksiGuvenlik/BLEManager.swift` + `face-mac/esp32-cam/src/main.cpp`
   - Sunucu / kalite filtresi: `face-mac/server/recognition.py` + `face-mac/server/app.py`
   - STM state machine / clock: `face-mac/Stm32/taxi_guvenlik/Core/Src/main.c`

**İlk turn'de yapma:**
- Mimariye soru sorma, "Plan B v2" kilitli. Önce "Kilit kararlar" + "Red flag" tablolarını oku.
- Yeni dosya/abstraction üretme. Mevcut 4 Swift / 1 ESP cpp / 1 STM main.c üzerine işle.
- `taxi-key.pem`, `.git/`, PDF rapor — dokunma.
- HM-10, OV5640+DCMI, AWS Rekognition, Android, HSE bypass önerisi getirme (red flag).

**Açık iş (durum: 2026-05-14):**
- BLE MTU 247 + defensive parser fix push'landı (commit `b68dded`), cihazda doğrulanmadı.
- Doğrulama akışı:
  1. ESP-CAM'i dock'a tak, USB'den besle (STM 5V'tan değil — brown-out).
  2. PlatformIO ile `face-mac/esp32-cam/` flash et (`pio run -t upload`).
  3. Xcode'da `iphone-app/TaksiGuvenlik.xcodeproj`'i aç, Cmd+R ile cihaza build et.
  4. STM32'yi de flash et (CubeIDE veya `face-mac/Stm32/`), USB takılı kalsın.
  5. iPhone app "TaxiGuard"a bağlanır → B1 USER (PC13) bas → SCANNING → MATCH.
  6. iPhone ekranında similarity **%0 değil ~%66** görünmeli (Gokturk için).
  7. Xcode console'da `[BLE raw] X bytes: ...` log satırı, X ≥ 20 byte olmalı (eski MTU 23'te 20'de kesiliyordu).

**Yazma kuralları (tekrar):**
- Türkçe konuş. Kod / commit / dosya yorumu İngilizce.
- Onay almadan büyük mimari değişiklik yok.
- Her kod değişikliği commit + push, anlamlı mesaj.
- `CLAUDE.md` güncellersen `AGENTS.md`'yi de güncelle (ikisi senkron olmalı).
- Emin değilsen araştır, varsayım yapma.
