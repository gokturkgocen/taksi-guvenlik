# Donanım Bring-Up Planı

Bu doküman, sergi öncesi donanımı sıfırdan ayağa kaldırmak için
takip edilecek sıralı prosedürü içerir. Her adımın **başarı kriteri**
vardır; bir adım geçmeden sonrakine atlamayın.

> **Önkoşul.** Bütün firmware kodu zaten yazılı ve commit'lenmiş.
> Bu plan yalnızca fiziksel bağlama + tetikleme + doğrulama içerir.

---

## Adım 1 — STM32 harici çevre birimleri

**Amaç:** STM32 üzerinde, kart dışı (breadboard) GPIO ve EXTI çevre
birimlerini bağlayıp temel toggle'ı doğrulamak.

### Bağlantılar

| Çevre birim | STM Pin | Breadboard tarafı |
|---|---|---|
| Yeşil LED (anot)   | PB0  | + 220 Ω → LED → GND |
| Sarı LED (anot)    | PD12 | + 220 Ω → LED → GND |
| Kırmızı LED (anot) | PB14 | + 220 Ω → LED → GND |
| Buzzer (+)         | PD13 | + buzzer → GND (aktif 5V buzzer) |
| TARA butonu        | PC13 | Kart üstü mavi USER butonu (hazır) |
| PANİK butonu       | PA0  | Buton bir ucu → PA0, diğer ucu → GND |

### Test programı

`Core/Src/main.c` içine basit bir blink + EXTI test bloğu yaz:

```c
HAL_GPIO_TogglePin(GPIOB, GPIO_PIN_0);  // yeşil
HAL_Delay(500);
```

EXTI callback'inde:

```c
void HAL_GPIO_EXTI_Callback(uint16_t pin) {
    if (pin == GPIO_PIN_13) HAL_GPIO_TogglePin(GPIOD, GPIO_PIN_12); // TARA
    if (pin == GPIO_PIN_0)  HAL_GPIO_TogglePin(GPIOB, GPIO_PIN_14); // PANİK
}
```

### Başarı kriteri

- [ ] Yeşil LED 500ms'de bir blink
- [ ] TARA butonuna basınca sarı LED toggle
- [ ] PANİK butonuna basınca kırmızı LED toggle
- [ ] Buzzer kısa bir biip test koduyla ötüyor

---

## Adım 2 — STM32 UART hatları (loopback test)

**Amaç:** UART1 ve UART2'nin tek başına çalıştığını, USB-TTL ile PC'den
doğrulamak.

### UART1 testi (115200 8N1)

1. USB-TTL dönüştürücüsünün RX'ini STM PA9'a (TX), TX'ini PA10'a (RX) bağla.
2. GND ortak.
3. STM kodunda:

```c
const char *msg = "STM-UART1-OK\n";
HAL_UART_Transmit(&huart1, (uint8_t*)msg, strlen(msg), 100);
HAL_Delay(1000);
```

4. PC tarafında: `screen /dev/tty.usbserial-XXX 115200` veya minicom.

### UART2 testi (9600 8N1)

Aynı prosedür: USB-TTL → PD5/PD6, baud 9600. Mesaj: `STM-UART2-OK\n`.

### Başarı kriteri

- [ ] UART1'den saniyede bir `STM-UART1-OK` satırı PC'de görünür
- [ ] UART2'den saniyede bir `STM-UART2-OK` satırı PC'de görünür
- [ ] Hatalı karakter (bozulma) yok

---

## Adım 3 — STM32 firmware doğrulama (zaten yazılı)

**Amaç:** `main.c` içindeki inline durum makinesinin Adım 1 ve 2'de
bağlanan çevre birimleriyle uçtan uca çalıştığını doğrulamak.

> **Not.** state machine + buton EXTI + UART1 RX line buffer + UART2 TX
> + LED/buzzer kontrolü `main.c` içine zaten yazılı. Kod değişikliği
> gerektirmez; sadece flash + test.

### Test akışı

1. STM32 board'unu bilgisayara bağla, CubeIDE üzerinden flash et.
2. ST-LINK VCP (USART3, 115200) üzerinden seri monitör aç:
   `screen /dev/tty.usbmodemXXXX 115200`. Açılış log'unda
   `[STM] boot, HCLK=216000000 Hz, plan-B (esp-cam slave)` görünmeli.
3. TARA butonuna (B1 USER) bas → log'da `[STM] TARA pressed,
   requesting capture` ve `[STM] -> SCANNING` satırları gelmeli.
4. ESP-CAM henüz bağlı değilse 15 saniye sonra `[STM] scan timeout`
   ve `[STM] -> NETERR` görmelisin.
5. PANİK butonuna bas → `[STM] PANIC button pressed` ve
   `[STM] -> PANIC` log'u.

### Başarı kriteri

- [ ] Kart açıldığında yeşil LED sabit yanıyor (LD1/PB0)
- [ ] TARA → sarı LED + UART1 TX hattında `CAPTURE\n` (USB-TTL ile gör)
- [ ] TARA + 15 saniye → NETERR (sarı + kırmızı sabit yanıyor)
- [ ] PANİK → kırmızı LED + buzzer + UART2 TX'te `PANIC\n`
- [ ] Onboard mavi LED (LD2/PB7) yarım saniye periyotla blink (heartbeat)

---

## Adım 4 — ESP32-CAM bağımsız test

**Amaç:** ESP32-CAM'i flash edip, doğrudan EC2'ye bir burst gönderebildiğini
doğrulamak.

### Bağlantılar (flash için)

| Sinyal | ESP32-CAM | USB-TTL |
|---|---|---|
| 5V     | VCC      | 5V |
| GND    | GND      | GND |
| TX     | U0R      | TX  |
| RX     | U0T      | RX  |
| Boot   | IO0      | GND (flash sırasında) |

Flash sonrası IO0 serbest bırak, RESET butonuna bas.

### Yazılım yapılandırması

`face-mac/esp32-cam/include/config.h`:

```c
#define WIFI_SSID "..."         // telefon hotspot ya da test routerı
#define WIFI_PASSWORD "..."
#define SERVER_URL "http://18.192.45.175:8000/search"
#define USE_TLS 0
```

PlatformIO ile derle ve flash et:

```bash
cd face-mac/esp32-cam
pio run -t upload
pio device monitor -b 115200
```

### Başarı kriteri

- [ ] Seri çıktıda Wi-Fi bağlantısı + IP adresi görünür
- [ ] Kart üzerinde test butonu varsa basınca bir tane test burst atıyor
- [ ] EC2'nin `/health` health endpoint cevap veriyor:
  ```bash
  curl http://18.192.45.175:8000/health
  ```
- [ ] far_frr.py smoke testi geçer:
  ```bash
  cd face-mac/eval
  python far_frr.py --dataset /tmp/smoke --gallery Gokturk \
      --server http://18.192.45.175:8000 --frames 10 \
      --out results/smoke.csv
  ```

---

## Adım 5 — STM + ESP birlikte (UART köprüsü)

**Amaç:** İki board'a aynı güç hattını verip, STM'in TARA komutuyla
ESP'nin burst yapmasını sağlamak.

### Bağlantılar

| Sinyal | STM Pin | ESP32-CAM Pin |
|---|---|---|
| STM TX  → ESP RX | PA9   | IO14 |
| STM RX  ← ESP TX | PA10  | IO13 |
| GND ortak       | GND   | GND  |

> **Önemli.** STM 3.3V logic; ESP32-CAM da 3.3V logic. Doğrudan bağlanabilir,
> level shifter gerekmez.

İki board ayrı güçten beslenebilir (STM USB'den, ESP-CAM USB-TTL'den) ama
GND mutlaka ortak.

### Test akışı

1. Her iki board'ı ayağa kaldır.
2. STM seri monitörü (UART1'i USB-TTL ile dinle): boş.
3. TARA butonuna bas.
4. ESP-CAM seri monitöründe (USB-TTL): "CAPTURE alındı, burst başlıyor..."
5. ESP-CAM burst'ü EC2'ye atar, JSON cevabı parse eder.
6. ESP-CAM STM'e CSV satırı yollar: `0;;0.12\n` (DB'de değilsen NOMATCH).
7. STM YEŞİL LED yanar, HM-10'a `NOMATCH\n` (HM-10 yoksa sadece UART2'de).

### Başarı kriteri

- [ ] TARA → STM CAPTURE → ESP burst → EC2 → JSON cevap → STM RESULT
- [ ] Uçtan uca süre $\leq$ 10 saniye (Wi-Fi koşuluna bağlı)
- [ ] NETERR senaryosu: ESP'nin Wi-Fi'sini kapat, TARA'ya bas, 15s sonra
      STM NETERR durumuna geçer

---

## Adım 6 — HM-10 STM UART2 entegrasyonu

**Amaç:** STM durum geçiş satırlarını telefona BLE notification olarak
göndermek.

### Bağlantılar

| Sinyal | STM Pin | HM-10 Pin |
|---|---|---|
| STM TX → HM-10 RX | PD5 | RXD |
| STM RX ← HM-10 TX | PD6 | TXD (opsiyonel, telefondan komut için) |
| HM-10 VCC | 3.3V | VCC (modül üstü) |
| HM-10 GND | GND | GND |

### HM-10 AT konfigürasyonu

İlk kullanım için USB-TTL ile bilgisayara bağla, AT komutlarıyla:

```
AT+NAMETaxiGuard
AT+BAUD4         # 9600 (zaten default)
AT+RESET
```

### Test

1. Telefonda nRF Connect aç, "TaxiGuard" advertisement'ını bul.
2. Bağlan, `0xFFE0` servisini → `0xFFE1` karakteristiğini bul.
3. Notifications'ı aktif et.
4. STM'de TARA'ya bas → `SCANNING` satırı telefonda görünür.

### Başarı kriteri

- [ ] HM-10 telefonda görünüyor, bağlanılabiliyor
- [ ] Notification aktif edildiğinde STM'in UART2'ye yazdığı satırlar
      `0xFFE1` karakteristiğinden geliyor
- [ ] `SCANNING`, `NOMATCH`, `HB` satırları telefonda doğru görünüyor

---

## Adım 7 — TaxiGuard Android uçtan uca

**Amaç:** Telefonda TaxiGuard uygulamasını yükleyip, MATCH durumunda
otomatik 155 çağrısının tetiklendiğini doğrulamak.

### Hazırlık

1. Android Studio'da `face-mac/android-v2/` projesini aç.
2. Bağlanan test telefonuna (Samsung S20 FE) build & install et.
3. Uygulamayı aç, izinleri ver:
   - BLUETOOTH_SCAN, BLUETOOTH_CONNECT
   - CALL_PHONE  
   - POST_NOTIFICATIONS

> **SIM kontrolü.** Test telefonunda SIM kartı olduğundan emin ol;
> `Intent.ACTION_CALL("tel:155")` SIM yoksa "no service" döner.

### Test 1 — Dev mode (donanım yokken doğrulama)

1. Uygulamada "Servisi Başlat" → BLE scan başlar (HM-10 yokken yine OK).
2. "DEV: Simulate MATCH" butonuna bas.
3. Telefonun arama uygulaması açılır ve 155'i çevirir.
4. Çağrıyı hemen iptal et (test).

### Test 2 — Gerçek HM-10 üzerinden

1. Adım 6'daki HM-10 + STM düzeneği ayakta.
2. Uygulamayı başlat, BLE scan otomatik HM-10'u bulup bağlanır.
3. STM tarafında DB'de olan bir kişiyi (Gokturk veya Ekin) ESP-CAM'in
   önüne tut, TARA'ya bas.
4. MATCH durumu BLE'ye gelir, uygulama otomatik 155'i çevirir.

### Başarı kriteri

- [ ] Dev mode butonu telefonda 155 araması başlatıyor
- [ ] Gerçek HM-10 bağlantısı kuruluyor (ekranda "Bağlı" görünüyor)
- [ ] `MATCH:..` satırı geldiğinde otomatik arama başlıyor
- [ ] `NOMATCH` satırı geldiğinde arama tetiklenmiyor (sadece banner)

---

## Adım 8 — FAR/FRR ölçümü (küçültülmüş set)

**Amaç:** Tezin Bölüm 5 tablolarını dolduracak ölçümleri almak.

### Hazırlık

1. 5--8 gönüllüden (proje ekibi + arkadaşlar) onay al.
2. Her kişiden:
   - 1 enroll fotoğrafı (frontal, iyi aydınlatma, 60cm mesafe)
   - 3--5 probe fotoğrafı (farklı aydınlatma/mesafe/poz)
3. Klasör yapısı:

```
test_set/
├── Gokturk/
│   ├── enroll.jpg
│   ├── probe_100lx.jpg
│   ├── probe_300lx.jpg
│   ├── probe_600lx.jpg
│   ├── probe_30cm.jpg
│   └── probe_120cm.jpg
├── Ekin/
│   └── ...
└── _impostor_001/        # tanınmayacak, kontrol
    └── face.jpg
```

### Çalıştırma

```bash
# 1) Yerelde DB oluştur
cd face-mac/eval
python bulk_enroll.py /path/to/test_set --db /tmp/eval.pkl --clear

# 2) EC2'ye yükle (DB swap)
scp -i ~/Bitirme/taxi-key.pem /tmp/eval.pkl ec2-user@18.192.45.175:/tmp/
ssh -i ~/Bitirme/taxi-key.pem ec2-user@18.192.45.175 \
    'docker cp /tmp/eval.pkl taxi-server:/app/data/embeddings.pkl && \
     docker restart taxi-server'

# 3) Ölçüm
python far_frr.py \
    --dataset /path/to/test_set \
    --gallery Gokturk,Ekin,...,Friend5 \
    --server http://18.192.45.175:8000 \
    --frames 10 \
    --out results/run_$(date +%Y%m%d).csv
```

### Başarı kriteri

- [ ] far_frr.py terminalde `== summary ==` bloğunu yazdı
- [ ] `results/run_YYYYMMDD_summary.json` EER eşiği içeriyor
- [ ] `run_YYYYMMDD_roc.png` ROC eğrisi üretildi
- [ ] Değerler tez `chapters/05_sonuclar.tex` tablolarına aktarıldı

---

## Toplam zaman tahmini

Sıra | Adım | Bağımsız mı? | Tahmini süre
---|---|---|---
1 | Harici çevre birimleri  | --- | ~1 oturum
2 | UART loopback           | Adım 1 sonrası | ~1 oturum
3 | State machine integrate | Adım 2 sonrası | ~1 oturum
4 | ESP32-CAM bağımsız      | Paralel | ~1 oturum
5 | STM + ESP birlikte      | Adım 3 + 4 | ~1 oturum
6 | HM-10 integrate         | Adım 5 | ~1 oturum
7 | Android uçtan uca       | Adım 6 | ~1 oturum
8 | FAR/FRR ölçüm           | Adım 7 | ~1 oturum

Hepsi birbirine bağlı, paralel yapılabilen az; ama her adım kısa.
