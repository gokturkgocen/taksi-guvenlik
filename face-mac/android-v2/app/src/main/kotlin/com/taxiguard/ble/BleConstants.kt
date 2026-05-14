package com.taxiguard.ble

import java.util.UUID

/**
 * BLE UUIDs and connection constants for HM-10 / HM-19 / AT-09 modules.
 *
 * HM-10 exposes a single service 0xFFE0 with a single
 * notify+write characteristic 0xFFE1. UART2 bytes from the STM32 come
 * out of FFE1 as notifications.
 */
object BleConstants {
    val SERVICE_UUID: UUID = UUID.fromString("0000ffe0-0000-1000-8000-00805f9b34fb")
    val CHAR_UUID: UUID    = UUID.fromString("0000ffe1-0000-1000-8000-00805f9b34fb")

    /** Standard Bluetooth GATT descriptor for enabling notifications. */
    val CCCD_UUID: UUID    = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    /** Device name advertised by stock HM-10 firmware. Configurable via
     *  AT command — we keep this only as a discovery hint. */
    const val DEFAULT_DEVICE_NAME = "HMSoft"

    const val SCAN_TIMEOUT_MS = 15_000L
    const val GATT_RECONNECT_DELAY_MS = 5_000L
}
