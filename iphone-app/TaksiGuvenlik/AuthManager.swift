import Foundation
import SwiftUI

/// Auth state + REST calls against the EC2 Flask backend (face-mac/server/auth.py).
/// Persists token/username/plate in the Keychain so the app survives relaunches
/// without forcing the user back through the login screen.
@MainActor
@Observable
final class AuthManager {
    enum Status: Equatable {
        case checking
        case loggedOut
        case loggedIn(username: String, plate: String)
    }

    var status: Status = .checking
    var inFlight: Bool = false
    var errorMessage: String? = nil

    private let session: URLSession
    private let baseURL: URL

    init(baseURL: URL = Constants.serverBaseURL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    private var token: String? { KeychainStore.get("token") }

    /// Called once at launch. If we have a cached token, optimistically restore
    /// the session and ping /auth/me; on a confirmed 401 we kick back to login.
    func bootstrap() async {
        guard let _ = token,
              let username = KeychainStore.get("username"),
              let plate = KeychainStore.get("plate") else {
            status = .loggedOut
            return
        }
        status = .loggedIn(username: username, plate: plate)
        // Quietly verify in the background; ignore network errors.
        let ok = await verifyToken()
        if !ok {
            clearLocal()
            status = .loggedOut
        }
    }

    func login(username: String, password: String) async {
        await postAuth(path: "auth/login",
                       body: ["username": username, "password": password])
    }

    func register(username: String, password: String, plate: String) async {
        await postAuth(path: "auth/register",
                       body: ["username": username, "password": password, "plate": plate])
    }

    func logout() async {
        if let token = token {
            var req = URLRequest(url: baseURL.appendingPathComponent("auth/logout"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await session.data(for: req)
        }
        clearLocal()
        errorMessage = nil
        status = .loggedOut
    }

    private func verifyToken() async -> Bool {
        guard let token = token else { return false }
        var req = URLRequest(url: baseURL.appendingPathComponent("auth/me"))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 5
        do {
            let (_, resp) = try await session.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if code == 401 { return false }
            return true
        } catch {
            // Network error: don't punish the user, keep them logged in offline.
            return true
        }
    }

    private func clearLocal() {
        KeychainStore.delete("token")
        KeychainStore.delete("username")
        KeychainStore.delete("plate")
    }

    private func postAuth(path: String, body: [String: String]) async {
        inFlight = true
        errorMessage = nil
        defer { inFlight = false }

        var req = URLRequest(url: baseURL.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 10
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, resp) = try await session.data(for: req)
            let http = resp as? HTTPURLResponse
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]

            if let http, (200..<300).contains(http.statusCode),
               let token = json?["token"] as? String,
               let username = json?["username"] as? String,
               let plate = json?["plate"] as? String {
                KeychainStore.set(token, for: "token")
                KeychainStore.set(username, for: "username")
                KeychainStore.set(plate, for: "plate")
                status = .loggedIn(username: username, plate: plate)
            } else {
                let msg = (json?["message"] as? String)
                    ?? "Sunucu hatası (\(http?.statusCode ?? -1))"
                errorMessage = msg
            }
        } catch {
            errorMessage = "Bağlantı hatası: \(error.localizedDescription)"
        }
    }
}
