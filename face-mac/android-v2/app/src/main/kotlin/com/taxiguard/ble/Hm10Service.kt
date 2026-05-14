package com.taxiguard.ble

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.taxiguard.MainActivity
import com.taxiguard.R
import com.taxiguard.dial.EmergencyDialer
import com.taxiguard.protocol.FrameParser
import com.taxiguard.protocol.MatchEvent
import com.taxiguard.state.ConnectionStatus
import com.taxiguard.state.EventBus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Long-lived BLE central. Hosts the HM-10 connection, parses incoming
 * frames, and fires the emergency dialer on MATCH / PANIC.
 *
 * Foreground service (CONNECTED_DEVICE type) — Android keeps the process
 * alive as long as the notification is visible, which is required for
 * unattended back-seat operation. The user starts/stops it from the home
 * screen.
 *
 * Design notes:
 *   - One persistent GATT connection. Disconnects auto-reconnect after a
 *     short backoff.
 *   - Frame buffer keeps partial UART lines until a `\n` arrives, so a
 *     fragmented MTU does not split "MATCH:..." across two notifications.
 *   - Dialing is delegated to [EmergencyDialer]; this class only decides
 *     *when* to dial, not *how*.
 */
class Hm10Service : Service() {

    companion object {
        private const val TAG = "Hm10Service"
        private const val CHANNEL_ID = "hm10_service"
        private const val NOTIF_ID = 4242

        const val ACTION_START = "com.taxiguard.action.START"
        const val ACTION_STOP = "com.taxiguard.action.STOP"
        const val ACTION_SIMULATE_MATCH = "com.taxiguard.action.SIMULATE_MATCH"

        fun start(ctx: Context) {
            val i = Intent(ctx, Hm10Service::class.java).setAction(ACTION_START)
            ContextCompat.startForegroundService(ctx, i)
        }

        fun stop(ctx: Context) {
            val i = Intent(ctx, Hm10Service::class.java).setAction(ACTION_STOP)
            ctx.startService(i)
        }

        fun simulateMatch(ctx: Context) {
            val i = Intent(ctx, Hm10Service::class.java).setAction(ACTION_SIMULATE_MATCH)
            ctx.startService(i)
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var scanJob: Job? = null
    private var gatt: BluetoothGatt? = null
    private val lineBuffer = StringBuilder()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopForegroundService(); return START_NOT_STICKY }
            ACTION_SIMULATE_MATCH -> {
                // Dev mode: forge a MATCH frame so the full downstream path
                // (dial + UI banner) can be exercised without an HM-10.
                handleLine("MATCH:Test_Subject;0.95")
                return START_STICKY
            }
            else -> {
                startInForeground()
                kickOffScan()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        teardownGatt()
        scope.cancel()
    }

    // -- foreground notification -----------------------------------------

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        if (mgr.getNotificationChannel(CHANNEL_ID) != null) return
        mgr.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.notif_channel_desc)
                setShowBadge(false)
            },
        )
    }

    private fun buildNotification(): android.app.Notification {
        val openApp = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setOngoing(true)
            .setContentIntent(openApp)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun startInForeground() {
        val notif = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_ID, notif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIF_ID, notif)
        }
    }

    private fun stopForegroundService() {
        teardownGatt()
        scanJob?.cancel(); scanJob = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // -- BLE scanning + connecting --------------------------------------

    private fun hasBlePermissions(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val scan = ContextCompat.checkSelfPermission(
            this, Manifest.permission.BLUETOOTH_SCAN,
        ) == PackageManager.PERMISSION_GRANTED
        val connect = ContextCompat.checkSelfPermission(
            this, Manifest.permission.BLUETOOTH_CONNECT,
        ) == PackageManager.PERMISSION_GRANTED
        return scan && connect
    }

    @SuppressLint("MissingPermission")
    private fun kickOffScan() {
        if (!hasBlePermissions()) {
            EventBus.setConnection(ConnectionStatus.PermissionMissing)
            Log.w(TAG, "BLE perms missing; service idle until perms granted")
            return
        }
        val adapter = (getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
        if (adapter == null || !adapter.isEnabled) {
            EventBus.setConnection(ConnectionStatus.Disconnected("bluetooth_off"))
            return
        }
        val scanner = adapter.bluetoothLeScanner ?: return
        EventBus.setConnection(ConnectionStatus.Scanning)

        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
                .build(),
        )
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                scanner.stopScan(this)
                connectToDevice(adapter, result.device)
            }
            override fun onScanFailed(errorCode: Int) {
                Log.e(TAG, "scan failed code=$errorCode")
                EventBus.setConnection(ConnectionStatus.Disconnected("scan_failed_$errorCode"))
            }
        }

        runCatching { scanner.startScan(filters, settings, callback) }
            .onFailure {
                Log.e(TAG, "startScan threw: ${it.message}", it)
                EventBus.setConnection(ConnectionStatus.Disconnected("scan_exception"))
            }

        scanJob = scope.launch {
            delay(BleConstants.SCAN_TIMEOUT_MS)
            runCatching { scanner.stopScan(callback) }
            if (gatt == null) {
                EventBus.setConnection(ConnectionStatus.Disconnected("scan_timeout"))
            }
        }
    }

    @SuppressLint("MissingPermission")
    private fun connectToDevice(adapter: BluetoothAdapter, device: BluetoothDevice) {
        EventBus.setConnection(ConnectionStatus.Connecting(device.address))
        gatt = device.connectGatt(this, /*autoConnect=*/false, gattCallback)
    }

    @SuppressLint("MissingPermission")
    private fun teardownGatt() {
        gatt?.runCatching { disconnect(); close() }
        gatt = null
    }

    private val gattCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    EventBus.setConnection(
                        ConnectionStatus.Connected(g.device.address, g.device.name),
                    )
                    g.discoverServices()
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    EventBus.setConnection(
                        ConnectionStatus.Disconnected("gatt_status_$status"),
                    )
                    teardownGatt()
                    // simple backoff before another scan attempt
                    scope.launch {
                        delay(BleConstants.GATT_RECONNECT_DELAY_MS)
                        kickOffScan()
                    }
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val service = g.getService(BleConstants.SERVICE_UUID) ?: run {
                Log.w(TAG, "FFE0 service not found on ${g.device.address}")
                return
            }
            val ch = service.getCharacteristic(BleConstants.CHAR_UUID) ?: return
            g.setCharacteristicNotification(ch, true)
            val cccd = ch.getDescriptor(BleConstants.CCCD_UUID) ?: return
            cccd.value = BluetoothGattDescriptor_ENABLE_NOTIFICATION_VALUE
            g.writeDescriptor(cccd)
        }

        override fun onCharacteristicChanged(
            g: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
        ) {
            val data = characteristic.value ?: return
            val chunk = String(data, Charsets.US_ASCII)
            absorbChunk(chunk)
        }
    }

    /** Accumulate UART bytes; emit one event per `\n`-terminated line. */
    private fun absorbChunk(chunk: String) {
        lineBuffer.append(chunk)
        while (true) {
            val nl = lineBuffer.indexOf('\n')
            if (nl < 0) return
            val line = lineBuffer.substring(0, nl)
            lineBuffer.delete(0, nl + 1)
            handleLine(line)
        }
    }

    private fun handleLine(line: String) {
        val event = FrameParser.parse(line)
        Log.i(TAG, "rx <- $line  parsed=$event")
        scope.launch { EventBus.emit(event) }
        when (event) {
            is MatchEvent.Match -> EmergencyDialer.call(this@Hm10Service)
            MatchEvent.Panic    -> EmergencyDialer.call(this@Hm10Service)
            else -> Unit
        }
    }
}

/**
 * `BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE` is exposed as a
 * top-level constant to keep the `gattCallback` body short and avoid the
 * import noise of pulling in the descriptor class only for one byte array.
 */
@Suppress("unused")
private val BluetoothGattDescriptor_ENABLE_NOTIFICATION_VALUE: ByteArray =
    android.bluetooth.BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
