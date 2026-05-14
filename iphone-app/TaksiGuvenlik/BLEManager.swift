import Foundation
import CoreBluetooth
import UIKit
import Combine

/// Connects to the ESP32-CAM acting as a BLE peripheral (device name
/// "TaxiGuard", service FFE0, characteristic FFE1 with notify). Parses
/// newline-delimited events forwarded from the STM32:
///
///   SCANNING\n               TARA pressed, burst in progress
///   MATCH:<name>;<sim>\n     suspect recognised → auto-dial 155
///   NOMATCH\n                burst completed, no DB hit
///   PANIC\n                  panic button → auto-dial 155
///   NETERR\n                 ESP/server fault, scan aborted
///   HB\n                     periodic heartbeat
///
/// iOS cannot place a fully automatic call from a third-party app; we open
/// `tel://155` which lands on the dialer with the number pre-filled. The user
/// taps the green button to actually dial. This is the same single-tap UX as
/// every other safety app on iOS — defendable on thesis.
@MainActor
final class BLEManager: NSObject, ObservableObject {
    static let serviceUUID  = CBUUID(string: "FFE0")
    static let charUUID     = CBUUID(string: "FFE1")
    static let targetName   = "TaxiGuard"
    static let emergencyNumber = "155"

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var rxBuffer = ""

    weak var appState: AppState?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)
    }

    private func startScan() {
        guard central.state == .poweredOn else { return }
        central.scanForPeripherals(withServices: nil, options: nil)
    }

    private func placeEmergencyCall() {
        guard let url = URL(string: "tel://\(BLEManager.emergencyNumber)") else { return }
        UIApplication.shared.open(url)
    }

    private func handleIncoming(_ raw: Data) {
        guard let chunk = String(data: raw, encoding: .utf8) else { return }
        rxBuffer.append(chunk)
        while let nl = rxBuffer.firstIndex(of: "\n") {
            let line = String(rxBuffer[..<nl]).trimmingCharacters(in: .whitespacesAndNewlines)
            rxBuffer.removeSubrange(...nl)
            if !line.isEmpty { handleLine(line) }
        }
    }

    private func handleLine(_ line: String) {
        guard let state = appState else { return }
        state.append(line)

        if line == "HB" {
            state.lastHeartbeat = Date()
            return
        }
        if line == "SCANNING" {
            state.currentState = "SCANNING"
            state.alertActive = false
            return
        }
        if line.hasPrefix("MATCH:") {
            let body = String(line.dropFirst("MATCH:".count))
            let parts = body.split(separator: ";", maxSplits: 1).map(String.init)
            state.matchName = parts.first ?? "?"
            state.matchSimilarity = (parts.count > 1 ? Double(parts[1]) : nil) ?? 0.0
            state.currentState = "MATCH"
            state.alertActive = true
            placeEmergencyCall()
            return
        }
        if line == "NOMATCH" {
            state.currentState = "NOMATCH"
            state.alertActive = false
            return
        }
        if line == "PANIC" {
            state.currentState = "PANIC"
            state.alertActive = true
            placeEmergencyCall()
            return
        }
        if line == "NETERR" {
            state.currentState = "NETERR"
            state.alertActive = false
            return
        }
        // Unknown line — already appended to log, no further state change.
    }
}

extension BLEManager: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            if central.state == .poweredOn { startScan() }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                    didDiscover peripheral: CBPeripheral,
                                    advertisementData: [String : Any],
                                    rssi RSSI: NSNumber) {
        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? ""
        guard name == BLEManager.targetName else { return }

        Task { @MainActor in
            self.central.stopScan()
            self.peripheral = peripheral
            peripheral.delegate = self
            self.central.connect(peripheral, options: nil)
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                    didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            appState?.bleConnected = true
            peripheral.discoverServices([BLEManager.serviceUUID])
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                    didFailToConnect peripheral: CBPeripheral,
                                    error: Error?) {
        Task { @MainActor in
            appState?.bleConnected = false
            startScan()
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                    didDisconnectPeripheral peripheral: CBPeripheral,
                                    error: Error?) {
        Task { @MainActor in
            appState?.bleConnected = false
            self.peripheral = nil
            self.characteristic = nil
            startScan()
        }
    }
}

extension BLEManager: CBPeripheralDelegate {
    nonisolated func peripheral(_ peripheral: CBPeripheral,
                                didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services where service.uuid == BLEManager.serviceUUID {
            peripheral.discoverCharacteristics([BLEManager.charUUID], for: service)
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral,
                                didDiscoverCharacteristicsFor service: CBService,
                                error: Error?) {
        guard let chars = service.characteristics else { return }
        for ch in chars where ch.uuid == BLEManager.charUUID {
            Task { @MainActor in self.characteristic = ch }
            peripheral.setNotifyValue(true, for: ch)
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral,
                                didUpdateValueFor characteristic: CBCharacteristic,
                                error: Error?) {
        guard let data = characteristic.value else { return }
        Task { @MainActor in handleIncoming(data) }
    }
}
