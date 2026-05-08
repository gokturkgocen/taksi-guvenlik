# STM32 NUCLEO-F767ZI — MATCH köprüsü firmware'i

Mac'ten gelen `MATCH:<name>;<sim>\n` stringini USB-serial üzerinden alır,
HM-10 BLE modülüne aynen iletir, LED/buzzer tetikler. Panik butonu basılırsa
`PANIC\n` stringini BLE'ye gönderir.

## Bu klasördeki dosyalar

| Dosya | Açıklama |
|---|---|
| `main.c` | **Drop-in firmware.** CubeMX projesi oluşturduktan sonra Core/Src/main.c yerine kopyala. Tam çalışır. |
| `CubeMX_setup.md` | **Tıklama tıklama** CubeMX rehberi. Önce bunu uygula, sonra main.c'yi kopyala. |
| `README.md` | Bu dosya — genel mimari, pin planı, HM-10 config, test. |

## Kurulum sırası

1. `CubeMX_setup.md`'yi sırayla uygula → Generate Code
2. CubeIDE'de oluşan `Core/Src/main.c` içeriğini sil, bu klasördeki `main.c` ile değiştir
3. Build → Run (ST-LINK flash)
4. Aşağıdaki **Test** bölümünden testleri çalıştır
5. HM-10 modülünü AT komutlarıyla config'le (aşağıda), USART6 pinlerine bağla

## Pin planı

NUCLEO-F767ZI'da ST-LINK VCP varsayılan olarak USART3'e bağlı (PD8/PD9). Bu
sayede ekstra FTDI gerekmez — USB kablosu hem güç hem seri.

| İşlev | Pin | Peripheral | User Label | Açıklama |
|---|---|---|---|---|
| **Mac UART TX** | PD8 | USART3 (9600 8N1) | otomatik | ST-LINK VCP üzerinden Mac'e |
| **Mac UART RX** | PD9 | USART3 | otomatik | Mac'ten STM32'ye |
| **HM-10 TX** | PC6 | USART6 (9600 8N1) | otomatik | STM32 → HM-10 RXD |
| **HM-10 RX** | PC7 | USART6 | otomatik | HM-10 TXD → STM32 (opsiyonel) |
| **LED yeşil (IDLE)** | PB0 | GPIO_Output | `LED_GREEN` | Onboard LD1 |
| **LED mavi (ALERT)** | PB7 | GPIO_Output | `LED_BLUE` | Onboard LD2 |
| **LED kırmızı (ALERT)** | PB14 | GPIO_Output | `LED_RED` | Onboard LD3 |
| **Buzzer** | PE5 | GPIO_Output | `BUZZER` | Aktif buzzer (+5V/GND) |
| **Panik butonu** | PC13 | GPIO_EXTI13 (falling) | `PANIC_BTN` | Onboard B1 USER |

> Onboard LED'ler kullanılıyor — harici LED takmaya gerek yok. Buzzer için
> tek harici komponent yeterli (aktif buzzer, 5V veya 3.3V model). Panik
> butonu için board üzerindeki mavi USER butonu (B1) kullanılıyor, harici
> buton da gerekmiyor → minimum donanım.

## HM-10 bağlantısı

| HM-10 | STM32 | Not |
|---|---|---|
| VCC | 3.3V (CN8 pin 4) | 5V de tolere eder ama 3.3V güvenli |
| GND | GND (CN8 pin 11) | |
| TXD | PC7 (USART6_RX) | HM-10 → STM32 |
| RXD | PC6 (USART6_TX) | STM32 → HM-10 (3.3V sinyal, voltage divider gerekmez) |
| STATE | bağlama | (opsiyonel: bağlantı durumu LED'i için) |
| BRK | bağlama | (opsiyonel: AT modu reset) |

### HM-10 ilk kurulum (AT komutları)

HM-10 BLE'ye bağlı değilken AT komutlarına cevap verir. STM32'ye takmadan
**önce** bir USB-TTL adapter veya Arduino Uno (TX/RX'i seri köprü olarak)
ile bu komutları çalıştır:

```
AT                       → OK
AT+NAMETaksiGuvenlik     → OK+Set:TaksiGuvenlik
AT+BAUD4                 → OK (9600)
AT+PASS000000            → OK (eşleşme şifresi)
AT+ROLE0                 → OK (peripheral mode)
AT+RESET                 → OK
```

Detaylı seri köprü kurulumu için: arduino IDE → File → Examples → Communication
→ MultiSerialMega (veya basit pass-through skeci yaz).

## Mesaj çerçevesi

Rapor 3.4.2 uyarınca basit metin tabanlı, CRC'siz (BLE ve UART zaten kendi
hata kontrolünü yapıyor):

| Yön | Mesaj | Anlam | STM32 cevabı |
|---|---|---|---|
| Mac → STM32 | `MATCH:<name>;<sim>\n` | Tanıma eşleşti | `ACK\n` + BLE forward + ALERT |
| Mac → STM32 | `HEARTBEAT\n` | Mac canlı | `ACK\n` |
| Mac → STM32 | `PING\n` | Test | `PONG\n` |
| Mac → STM32 | `CLEAR\n` | Alarm iptal | `ACK\n` + COOLDOWN |
| Panik butonu | (lokal) | B1 basıldı | BLE'ye `PANIC\n` + ALERT |
| STM32 → BLE | `READY\n` | Boot mesajı | (Android tarafı opsiyonel) |
| STM32 → BLE | `MATCH:...\n` | Mac'ten forward | (Android arar) |
| STM32 → BLE | `PANIC\n` | Panik | (Android arar) |
| STM32 → BLE | `HB\n` | Heartbeat 3sn | (Android timeout sayar) |

## State machine

```
           ┌────────┐
           │ IDLE   │ ← yeşil LED yanar, buzzer sessiz
           └───┬────┘
               │ MATCH:... geldi VEYA panik butonu
               ▼
           ┌────────┐
           │ ALERT  │ ← mavi+kırmızı LED 300ms toggle, buzzer 300ms on/off
           └───┬────┘
               │ 10 sn sonra veya "CLEAR\n" komutu
               ▼
           ┌─────────┐
           │COOLDOWN │ ← yeşil LED 250ms blink (yeni alarm tetiklenmez)
           └───┬─────┘
               │ 5 sn
               ▼
              IDLE
```

`main.c` içindeki `enter_state()` fonksiyonu state geçişlerini, `update_outputs()`
periyodik LED/buzzer güncellemesini yapar.

## Önemli implementasyon notları

- **UART RX**: tek-byte interrupt + line buffer. `\n` veya `\r` gelince
  `uart3_line_ready` flag'i set olur, main loop tüketir. Buffer 128 byte,
  taşma durumunda reset.
- **EXTI debounce**: callback sadece flag set ediyor, debounce ana loop'ta
  50ms sleep + tekrar pin oku ile yapılıyor.
- **Heartbeat**: BLE'ye 3 saniyede bir `HB\n`. Android tarafı 10sn boyunca
  HB gelmezse "STM32 koptu" diye uyarabilir.
- **ALERT yenileme**: ALERT içindeyken yeni `MATCH:...` gelirse 10sn sayaç
  sıfırlanır (state_enter_tick yeniden set). Python emitter zaten kendi
  cooldown'unu uyguluyor, spam olmaz.
- **216 MHz HCLK**: F767ZI tavanı, OverDrive zorunlu. main.c'de
  `HAL_PWREx_EnableOverDrive()` çağrısı var.

## Test

### 1. Boot doğrulama

```bash
ls /dev/tty.*
# /dev/tty.usbmodemXXXXXX gibi port bul
```

Mac terminalden seri portu aç:
```bash
screen /dev/tty.usbmodemXXXX 9600
```

Reset bas → `STM32 ready` mesajı görmeli. Yeşil LED (LD1) yanık olmalı.

`screen`'den çıkış: **Ctrl+A** sonra **K** sonra **Y**.

### 2. Komut testleri

`screen` içindeyken klavyeden yaz:

| Yazılan | Beklenen |
|---|---|
| `PING` + Enter | `PONG\r\n` |
| `HEARTBEAT` + Enter | `ACK\r\n` |
| `MATCH:Test;0.85` + Enter | `ACK\r\n`, mavi/kırmızı LED toggle, buzzer çalar (10sn) |
| `CLEAR` + Enter (ALERT modunda) | `ACK\r\n`, COOLDOWN'a geçer |

### 3. Tek-shot test (screen olmadan)

```bash
echo "MATCH:Gokturk;0.72" > /dev/tty.usbmodemXXXX
```

ALERT moduna girer.

### 4. Panik butonu

NUCLEO board üzerindeki **mavi USER butonu (B1)** → bas. ALERT moduna girmeli,
USART3'te `PANIC button pressed` görmelisin.

### 5. Python ile uçtan-uca

```bash
cd /Users/gokturkgocen/Bitirme/face-mac
source venv/bin/activate
python recognize.py --serial /dev/tty.usbmodemXXXX
```

Yüzünü göster → `[EMIT] MATCH:Gokturk;...` konsolda + STM32'de ALERT modu.

### 6. HM-10 BLE (modül takılı ve config'liyse)

Telefonda **nRF Connect** uygulaması:
1. Tara → `TaksiGuvenlik` adında cihaz görünmeli
2. Connect → service `0xFFE0` → characteristic `0xFFE1` → Notify enable
3. Her 3sn `HB\n` gelmeli
4. STM32'ye MATCH gönder → karakteristik üzerinde `MATCH:...` görmeli

## Hata durumları

| Durum | Davranış |
|---|---|
| Mac USB kopar | STM32 durum değiştirmez, IDLE'da kalır |
| HM-10 yok / kopuk | UART transmit blocking timeout (200ms), main loop yavaşlar ama crash olmaz |
| UART parity / overrun | `HAL_UART_ErrorCallback` buffer'ı reset eder, RX yeniden başlar |
| Satır > 128 byte | `uart3_idx` overflow'da reset, satır atılır |
| Sürekli bozuk MATCH | `handle_line()` tanımadığı satıra `UNKNOWN` döner, ALERT girmez |
| Build error pin undefined | CubeMX'te User Label yanlış — `CubeMX_setup.md` Bölüm 4 tablosunu birebir uygula |

## Güç tüketimi (rapor 5.2 metriği)

NUCLEO board USB ile beslendiğinde tipik:

| Durum | Akım | Güç @ 3.3V |
|---|---|---|
| IDLE (yeşil LED on) | ~80 mA | ~265 mW |
| ALERT (3 LED toggle + buzzer) | ~120 mA | ~400 mW |
| HM-10 advertising eklendiğinde | +20 mA | +66 mW |

Üretim senaryosunda (Pi4 + STM32 + HM-10) toplam ~3-5W beklenir, taksi
12V akkü için sorunsuz.

## Sonraki adım

Firmware ve HM-10 çalıştığında → `android/README.md`'deki Kotlin app'i
yaz, BLE'ye bağlan, MATCH/PANIC mesajlarını dinle, `Intent.ACTION_CALL`
ile telefonu aratır. Test numarasını oraya koy.
