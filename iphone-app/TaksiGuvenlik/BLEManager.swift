import Foundation
import CoreBluetooth
import UIKit
import Combine

/// HM-10 BLE modülüne bağlanıp `MATCH:<name>;<sim>\n`, `PANIC\n`, `HB\n`
/// satırlarını dinler. Geldiğinde AppState.activeAlert'i set eder ve
/// otomatik olarak telefon dialer'ını açar (kullanıcı tek tık ile arar).
///
/// HM-10 servis ve karakteristikleri:
///   service:        0000FFE0-0000-1000-8000-00805F9B34FB
///   characteristic: 0000FFE1-0000-1000-8000-00805F9B34FB  (notify + write)
///
/// Üretimde test öncesi:
///   1. STM32 firmware HM-10'u "TaksiGuvenlik" adıyla advertise ediyor
///   2. iPhone Settings → Bluetooth'tan eşleştir (eşleşme şifresi 000000)
///   3. App'i aç, BLE manager otomatik scan + connect yapacak
@MainActor
final class BLEManager: NSObject, ObservableObject {
    // MARK: - HM-10 UUID'leri
    static let serviceUUID  = CBUUID(string: "FFE0")
    static let charUUID     = CBUUID(string: "FFE1")
    static let targetName   = "TaksiGuvenlik"

    // MARK: - Public state
    @Published private(set) var status: Status = .idle
    @Published private(set) var lastHeartbeat: Date?
    @Published private(set) var lastEvent: AlertEvent?

    enum Status: Equatable {
        case idle
        case scanning
        case connecting
        case connected
        case disconnected
        case unauthorized
        case unsupported

        var label: String {
            switch self {
            case .idle: return "Bekleme"
            case .scanning: return "Aranıyor…"
            case .connecting: return "Bağlanıyor…"
            case .connected: return "Bağlı"
            case .disconnected: return "Bağlantı koptu"
            case .unauthorized: return "Bluetooth izni yok"
            case .unsupported: return "BLE desteklenmiyor"
            }
        }
    }

    /// Test numarası — config'ten okuması daha doğru ama prototip için sabit.
    /// 112 KULLANMA. Üretimde 112 yapılacak, demoda kendi ikinci hat veya aile büyüğü.
    var emergencyNumber: String = "05000000000"

    // MARK: - Private
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var characteristic: CBCharacteristic?
    private var rxBuffer = ""

    /// AppState'i güncellemek için weak ref. Init sırasında set edilir.
    weak var appState: AppState?

    override init() {
        super.init()
        // Background delivery için queue'yu nil bırakıp main'de tutalım.
        central = CBCentralManager(delegate: self, queue: nil)
    }

    // MARK: - Public API

    func startScan() {
        guard central.state == .poweredOn else {
            print("[BLE] state not poweredOn: \(central.state.rawValue)")
            return
        }
        status = .scanning
        // Hem servis filtreli hem ad filtreli — bazı HM-10 klonları advert'te
        // service UUID yayınlamıyor, bu yüzden servis filtresi koymuyoruz.
        central.scanForPeripherals(withServices: nil, options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
    }

    func stopScan() {
        central.stopScan()
        if status == .scanning { status = .idle }
    }

    /// Manuel disconnect (settings'ten "BLE'yi kes" gibi).
    func disconnect() {
        guard let p = peripheral else { return }
        central.cancelPeripheralConnection(p)
    }

    /// Aktif çağrıyı başlat: dialer'ı aç (iOS programatik tam-arama izin vermez,
    /// kullanıcı tek tık ile aramayı onaylar).
    func placeEmergencyCall() {
        let cleaned = emergencyNumber.filter { $0.isNumber || $0 == "+" }
        guard !cleaned.isEmpty,
              let url = URL(string: "tel://\(cleaned)") else {
            print("[BLE] geçersiz acil numara: \(emergencyNumber)")
            return
        }
        UIApplication.shared.open(url)
    }

    // MARK: - Hat parser

    private func handleIncoming(_ raw: Data) {
        guard let chunk = String(data: raw, encoding: .utf8) else { return }
        rxBuffer.append(chunk)

        while let nl = rxBuffer.firstIndex(of: "\n") {
            let line = String(rxBuffer[..<nl]).trimmingCharacters(in: .whitespacesAndNewlines)
            rxBuffer.removeSubrange(...nl)
            if !line.isEmpty {
                handleLine(line)
            }
        }
    }

    private func handleLine(_ line: String) {
        print("[BLE] <- \(line)")

        if line.hasPrefix("MATCH:") {
            // MATCH:Name;0.85
            let body = String(line.dropFirst("MATCH:".count))
            let parts = body.split(separator: ";", maxSplits: 1).map(String.init)
            let name = parts.first ?? "?"
            let sim = (parts.count > 1 ? Double(parts[1]) : nil) ?? 0.0

            let evt = AlertEvent(kind: .match(name: name, similarity: sim),
                                  timestamp: Date())
            lastEvent = evt
            appState?.activeAlert = evt
            placeEmergencyCall()
        }
        else if line == "PANIC" {
            let evt = AlertEvent(kind: .panic, timestamp: Date())
            lastEvent = evt
            appState?.activeAlert = evt
            placeEmergencyCall()
        }
        else if line == "HB" {
            lastHeartbeat = Date()
            appState?.lastHeartbeat = Date()
        }
        else if line == "READY" {
            print("[BLE] STM32 ready")
        }
        // Bilinmeyen satırlar sessizce atılır.
    }
}

// MARK: - CBCentralManagerDelegate

extension BLEManager: CBCentralManagerDelegate {
    nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        Task { @MainActor in
            switch central.state {
            case .poweredOn:
                status = .idle
                startScan()
            case .poweredOff, .resetting:
                status = .disconnected
            case .unauthorized:
                status = .unauthorized
            case .unsupported:
                status = .unsupported
            case .unknown:
                status = .idle
            @unknown default:
                status = .idle
            }
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                     didDiscover peripheral: CBPeripheral,
                                     advertisementData: [String : Any],
                                     rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? ""
        guard name == BLEManager.targetName else { return }

        Task { @MainActor in
            self.central.stopScan()
            self.peripheral = peripheral
            peripheral.delegate = self
            self.status = .connecting
            self.central.connect(peripheral, options: nil)
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                     didConnect peripheral: CBPeripheral) {
        Task { @MainActor in
            status = .connected
            appState?.bleConnected = true
            peripheral.discoverServices([BLEManager.serviceUUID])
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                     didFailToConnect peripheral: CBPeripheral,
                                     error: Error?) {
        Task { @MainActor in
            print("[BLE] connect failed: \(error?.localizedDescription ?? "?")")
            status = .disconnected
            appState?.bleConnected = false
            startScan()  // tekrar dene
        }
    }

    nonisolated func centralManager(_ central: CBCentralManager,
                                     didDisconnectPeripheral peripheral: CBPeripheral,
                                     error: Error?) {
        Task { @MainActor in
            print("[BLE] disconnected: \(error?.localizedDescription ?? "manuel")")
            status = .disconnected
            appState?.bleConnected = false
            self.peripheral = nil
            self.characteristic = nil
            // Otomatik yeniden bağlanma
            startScan()
        }
    }
}

// MARK: - CBPeripheralDelegate

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
            Task { @MainActor in
                self.characteristic = ch
            }
            peripheral.setNotifyValue(true, for: ch)
        }
    }

    nonisolated func peripheral(_ peripheral: CBPeripheral,
                                 didUpdateValueFor characteristic: CBCharacteristic,
                                 error: Error?) {
        guard let data = characteristic.value else { return }
        Task { @MainActor in
            handleIncoming(data)
        }
    }
}
