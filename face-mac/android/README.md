# Android BLE Gateway App

HM-10 modülünden `MATCH:<name>;<sim>\n` veya `PANIC\n` stringini alır,
Intent.ACTION_CALL ile test numarasını otomatik çevirir.

## Neden bu tasarım

- STM32'de Bluetooth HFP (Hands-Free Profile) yok → STM32 doğrudan telefonu aratamaz
- En kolay köprü: STM32 → HM-10 BLE → Android app → `ACTION_CALL` intent
- Android 6.0+ yeterli, izinler dışında özel bir şey yok

## Gereksinimler

- Android Studio Hedgehog (2023.1) veya üstü
- Test cihazı: Android 8+ (BLE + foreground service stabil)
- SIM kart + arama kredisi
- HM-10 config bitmiş olmalı (bkz. `stm32/README.md`)

## İzinler (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.CALL_PHONE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
```

## Minimal Kotlin iskelet (~150 satır)

### BleService.kt
```kotlin
class BleService : Service() {
    private lateinit var bluetoothAdapter: BluetoothAdapter
    private var gatt: BluetoothGatt? = null
    private val TARGET_NAME = "TaksiGuvenlik"
    private val HM10_SERVICE = UUID.fromString("0000FFE0-0000-1000-8000-00805F9B34FB")
    private val HM10_CHAR = UUID.fromString("0000FFE1-0000-1000-8000-00805F9B34FB")
    private val TEST_NUMBER = "05000000000"   // BURAYA test numarasi
    private val buffer = StringBuilder()

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(1, buildNotification())
        bluetoothAdapter = (getSystemService(BLUETOOTH_SERVICE) as BluetoothManager).adapter
        scanAndConnect()
        return START_STICKY
    }

    private fun scanAndConnect() {
        bluetoothAdapter.bluetoothLeScanner.startScan(object : ScanCallback() {
            override fun onScanResult(type: Int, result: ScanResult) {
                if (result.device.name == TARGET_NAME) {
                    bluetoothAdapter.bluetoothLeScanner.stopScan(this)
                    gatt = result.device.connectGatt(this@BleService, true, gattCb)
                }
            }
        })
    }

    private val gattCb = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) g.discoverServices()
            else if (newState == BluetoothProfile.STATE_DISCONNECTED) scanAndConnect()
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val ch = g.getService(HM10_SERVICE)?.getCharacteristic(HM10_CHAR) ?: return
            g.setCharacteristicNotification(ch, true)
            val desc = ch.getDescriptor(UUID.fromString("00002902-0000-1000-8000-00805F9B34FB"))
            desc.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            g.writeDescriptor(desc)
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, ch: BluetoothGattCharacteristic) {
            val chunk = String(ch.value, Charsets.UTF_8)
            buffer.append(chunk)
            var nl = buffer.indexOf('\n')
            while (nl >= 0) {
                val line = buffer.substring(0, nl).trim()
                buffer.delete(0, nl + 1)
                handleLine(line)
                nl = buffer.indexOf('\n')
            }
        }
    }

    private fun handleLine(line: String) {
        Log.i("BLE", "recv: $line")
        when {
            line.startsWith("MATCH:") -> triggerCall(line)
            line == "PANIC" -> triggerCall("PANIC")
            line == "HB" -> { /* heartbeat, sayaci guncelle */ }
        }
    }

    private fun triggerCall(reason: String) {
        val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$TEST_NUMBER"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
        Log.w("BLE", "CALL started: $reason")
    }

    private fun buildNotification(): Notification {
        val ch = NotificationChannel("bl", "BLE", NotificationManager.IMPORTANCE_LOW)
        (getSystemService(NotificationManager::class.java)).createNotificationChannel(ch)
        return Notification.Builder(this, "bl")
            .setContentTitle("Taksi Guvenlik aktif")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .build()
    }

    override fun onBind(intent: Intent?) = null
}
```

### MainActivity.kt (minimal)
```kotlin
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val perms = arrayOf(
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
        if (perms.any { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }) {
            requestPermissions(perms, 1)
        }

        findViewById<Button>(R.id.btnStart).setOnClickListener {
            startForegroundService(Intent(this, BleService::class.java))
        }
        findViewById<Button>(R.id.btnStop).setOnClickListener {
            stopService(Intent(this, BleService::class.java))
        }
    }
}
```

## activity_main.xml (iskelet)
```xml
<LinearLayout ... orientation="vertical">
    <Button android:id="@+id/btnStart" android:text="BLE baglan"/>
    <Button android:id="@+id/btnStop" android:text="Durdur"/>
</LinearLayout>
```

## Test senaryosu

1. HM-10 config bitsin, STM32 firmware flash'lansın
2. Uygulamayı telefona yükle, izinleri ver
3. "BLE bağlan" butonu → foreground service başlar, HM-10'a bağlanır
4. Mac'te `recognize.py --serial /dev/tty.usbmodem...`
5. Yüzün DB'deyse (kendi yüzün ile test) → MATCH → STM32 → BLE → telefon çağrı başlatır
6. Test numarası **kendi ikinci hattın** veya aile büyüğünün (izinli)

## Not — tez savunması için

- **Test numarası olarak 112 KULLANILMAZ.** Yasal risk, gerçek acil hattı meşgul etmek.
- Poster/raporda "112 yerine test numarası kullanılmıştır, üretim senaryosunda 112 çağrılacaktır" notu şart.
- Demo videosunda arama başladığında "Simülasyon — test numarası" overlay ekle.

## Plan B — app yazamazsam?

Zor ama mümkün:
- Android'de **"Serial Bluetooth Terminal"** (ücretsiz, Kai Morich)
- Tasker app + AutoTools plugin → BLE string gelince macro çalıştır → `CALL` action
- Yasal olarak çalışır ama tez savunmasında "kendi app'imi yazdım" demek daha güçlü
- Tasker + AutoTools ~1 gece kurulum, Kotlin app ~2 gün. Yaz.
