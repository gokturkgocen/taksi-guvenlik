# CubeMX Step-by-Step (NUCLEO-F767ZI)

Hedef: STM32CubeIDE'de boş bir proje aç, aşağıdaki ayarları **birebir** uygula,
**Generate Code**'a tıkla. Ardından oluşan `Core/Src/main.c`'yi bu klasördeki
`main.c` ile değiştir.

## 0. Versiyon

- STM32CubeIDE 1.13+ (önerilir 1.16+)
- HAL F7 firmware paketi 1.17+ (CubeIDE ilk açılışta indirir)

## 1. Yeni Proje

1. **File → New → STM32 Project**
2. Üstteki sekmelerden **Board Selector**
3. Search: `NUCLEO-F767ZI` → seç → **Next**
4. Project Name: `TaksiGuvenlik` (istediğin)
5. Targeted Language: **C**
6. Targeted Binary Type: **Executable**
7. Targeted Project Type: **STM32Cube**
8. **Finish**
9. Pop-up: *"Initialize all peripherals with their default Mode?"* → **No**
   (Ethernet ve diğerlerini otomatik açmasın, pin çakışması olmasın.)

## 2. Pinout — USART3 (ST-LINK VCP, Mac haberleşmesi)

NUCLEO-F767ZI'da ST-LINK VCP `USART3 PD8/PD9`'a bağlı. USB kablonun seri portu
buradan çıkıyor.

1. Sol panelde **Connectivity → USART3**
2. Mode: **Asynchronous**
3. Hardware Flow Control (RS232): **Disable**
4. Pinout otomatik: PD8 = USART3_TX, PD9 = USART3_RX (mor renge dönmeli)
   - Eğer farklı pinler atanırsa: pinout görünümünde PD8'e tıkla → USART3_TX seç
5. Configuration alt sekmeleri:
   - **Parameter Settings**:
     - Baud Rate: `9600`
     - Word Length: `8 Bits (including Parity)`
     - Parity: `None`
     - Stop Bits: `1`
     - Data Direction: `Receive and Transmit`
     - Over Sampling: `16 Samples`
   - **NVIC Settings**: `USART3 global interrupt` → **Enabled** ✓

## 3. Pinout — USART6 (HM-10 BLE)

1. **Connectivity → USART6**
2. Mode: **Asynchronous**
3. Pinout: PC6 = USART6_TX, PC7 = USART6_RX
   - Default farklı atanırsa pinout görünümünden manuel: PC6 → USART6_TX,
     PC7 → USART6_RX
4. Configuration → **Parameter Settings**:
   - Baud Rate: `9600`
   - 8 / None / 1
5. **NVIC Settings**: `USART6 global interrupt` → **Enabled** ✓

## 4. GPIO

Pinout görünümünde ilgili pini bul, sol tıkla, mode seç, sağ tıkla → **Enter
User Label**.

| Pin | Mode | User Label | Not |
|---|---|---|---|
| PB0 | GPIO_Output | `LED_GREEN` | Onboard LD1 |
| PB7 | GPIO_Output | `LED_BLUE` | Onboard LD2 |
| PB14 | GPIO_Output | `LED_RED` | Onboard LD3 |
| PE5 | GPIO_Output | `BUZZER` | Harici aktif buzzer (+5V/GND ile) |
| PC13 | GPIO_EXTI13 | `PANIC_BTN` | Onboard B1 (USER butonu) |

Sonra **System Core → GPIO** → her pin satırına tıkla → ayrıntıları kontrol:

**LED'ler (PB0, PB7, PB14) ve BUZZER (PE5):**
- GPIO output level: `Low`
- GPIO mode: `Output Push Pull`
- GPIO Pull-up/Pull-down: `No pull-up and no pull-down`
- Maximum output speed: `Low`
- User Label: yukarıdaki tablo

**PANIC_BTN (PC13):**
- GPIO mode: `External Interrupt Mode with Falling edge trigger detection`
- GPIO Pull-up/Pull-down: `No pull-up and no pull-down`
  (Board üzerinde zaten 4.7kΩ pull-up var)
- User Label: `PANIC_BTN`

## 5. NVIC

**System Core → NVIC**:

| IRQ | Enabled | Priority |
|---|---|---|
| EXTI line[15:10] interrupts | ✓ | 6 |
| USART3 global interrupt | ✓ | 5 |
| USART6 global interrupt | ✓ | 5 |
| System tick timer | ✓ (default) | 15 |

(Priority numarası önemli değil, sadece SysTick'ten daha yüksek olsun ki UART
interrupt'ı SysTick içerisinden çalışabilsin.)

## 6. Clock Configuration

**Clock Configuration** sekmesi:

1. **HSE**: `8 MHz` (NUCLEO board ST-LINK MCO ile 8 MHz BYPASS sağlar)
2. **PLL Source Mux**: `HSE`
3. **Main PLL**:
   - PLLM: `4`
   - PLLN: `216`
   - PLLP: `2`
   - PLLQ: `9` (USB için 48 MHz, kullanmasak da koyalım)
4. **System Clock Mux**: `PLLCLK`
5. **HCLK (MHz)**: `216` (kutuya yaz, Enter'a bas, kırmızı çıkarsa
   "Resolve Clock Issues" çıkar — onu tıkla, otomatik düzeltir)
6. **APB1 Prescaler**: `/4` → APB1 Peripheral Clock = 54 MHz
7. **APB2 Prescaler**: `/2` → APB2 Peripheral Clock = 108 MHz

> Bu config 216 MHz max'a çıkar (F767ZI tavanı). Daha düşük tutmak istersen
> 108 MHz veya 168 MHz de yeter — main.c'deki SystemClock_Config'i düzeltmen
> gerekir. Default 216 MHz tavsiye.

## 7. Project Manager

**Project Manager** sekmesi:

### Project tab
- Project Name: `TaksiGuvenlik`
- Project Location: istediğin yer
- Toolchain / IDE: `STM32CubeIDE`
- Heap Size: `0x200`
- Stack Size: `0x400`

### Code Generator tab
- ✓ **Generate peripheral initialization as a pair of '.c/.h' files per peripheral**
  (Bu opsiyonu işaretle — main.c daha küçük olur, peripheral init'leri ayrı
  dosyada. Aslında istediğin gibi, ama bizim main.c monolithic versiyon, ikisi
  de çalışır.)
- ✓ **Keep User Code when re-generating**
- ✗ **Delete previously generated files when not re-generated**

## 8. Generate Code

1. Üst toolbar'da kırmızı/turuncu olan **GENERATE CODE** butonu (Alt+K) → tıkla
2. Çıkacak pop-up: *"Open Perspective?"* → Yes
3. CubeIDE Project Explorer'da `TaksiGuvenlik` görünür
4. Build (Ctrl+B) → 0 error 0 warning olmalı (henüz user code yok)

## 9. main.c Değişimi

1. `Core/Src/main.c` dosyasını aç
2. İçeriğini tamamen seç (Ctrl+A) ve sil
3. Bu klasördeki `main.c` içeriğini yapıştır (Ctrl+V)
4. Save (Ctrl+S)
5. Build (Ctrl+B) → 0 error olmalı

> **DİKKAT:** Eğer user label'leri (`LED_GREEN`, `BUZZER`, `PANIC_BTN` vs.)
> tam yukarıdaki gibi yazmazsan, `main.h` farklı define'lar üretir ve build
> hata verir. Hata mesajı `LED_GREEN_Pin undeclared` falan derse → CubeMX'e dön,
> User Label'i düzelt, Generate Code, tekrar dene.

## 10. Flash & Test

1. STM32 NUCLEO'yu USB ile Mac'e bağla
2. CubeIDE → Run → Run As → STM32 C/C++ Application
3. Debug Configurations otomatik oluşur, OK
4. Flash başlar, "Verification successful" → reset
5. Yeşil LED (LD1) yanıyor olmalı

### USART3 testi

Mac terminal'de:
```bash
ls /dev/tty.*
# /dev/tty.usbmodem14303 gibi bir port göreceksin
```

```bash
# screen ile aç (Ctrl+A K Y ile çıkış)
screen /dev/tty.usbmodemXXXX 9600
```

Boot mesajı görmelisin: `STM32 ready`

Klavyeden yaz:
```
PING
```
Cevap:
```
PONG
```

```
MATCH:Test;0.85
```
Cevap: `ACK`, ardından kırmızı/mavi LED yanıp sönmeye başlar (ALERT 10sn),
buzzer öter (takılıysa).

### Panik butonu testi

NUCLEO board üzerindeki **mavi B1 USER butonu** → bas. ALERT modu girer,
USART3'te `PANIC button pressed` mesajı görürsün.

### HM-10 testi (modül takılıysa)

Telefonda BLE scanner uygulaması (örn. **nRF Connect**) ile tara, `TaksiGuvenlik`
adında cihaz görmelisin. Connect → service `0xFFE0` → characteristic `0xFFE1` →
notify enable → her 3 saniyede `HB`, MATCH/PANIC olduğunda mesaj gelmeli.

## 11. Sık Yapılan Hatalar

| Belirti | Çözüm |
|---|---|
| Build error: `LED_GREEN_Pin undeclared` | CubeMX'te User Label tam `LED_GREEN` mi? Generate Code'a bas, tekrar build |
| `huart3 undeclared` | USART3 enable mı? Connectivity → USART3 → Mode Asynchronous |
| LED yanmıyor | GPIO output level `Low`, push-pull, no pull seçili mi? main.c'de `enter_state(STATE_IDLE)` çağrılıyor mu? |
| USART3'te garbage karakterler | Baud 9600 mü? screen 9600 mü açıyorsun? Clock config doğru mu (HCLK 216 MHz, APB1 54 MHz)? |
| Reset sonrası ALERT modu | EXTI13 falling edge yanlış config olabilir, B1 butonu açılışta basılı kalmış sayıyor — board üzerindeki RESET butonuna bas |
| `OverDrive` hatası | F767ZI 216 MHz için OverDrive şart, `HAL_PWREx_EnableOverDrive()` main.c'de var, atlama |

## 12. Sonraki Adım

Firmware çalıştığında **HM-10 modülünü PC6/PC7'ye bağla** (3.3V besleme!),
ardından `stm32/README.md`'deki AT komutlarıyla HM-10 ismini `TaksiGuvenlik`
yap. Mac tarafında `python recognize.py --serial /dev/tty.usbmodemXXXX` ile
gerçek pipeline'ı çalıştır.
