import Foundation
import AuthenticationServices
import CryptoKit
import Security
import UIKit

// Credentials stay in the native Keychain. Bundled JS receives data, never tokens.
@MainActor final class BillNgaiSyncNative: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var auth: ASWebAuthenticationSession?
    private var refreshTask: Task<[String: Any], Error>?
    private weak var controller: UIViewController?
    private let bundle = Bundle.main.bundleIdentifier ?? "com.visarut.billngai"
    private var client: String { Bundle.main.object(forInfoDictionaryKey: "BillNgaiGoogleClientID") as? String ?? "" }
    private var origin: String { Bundle.main.object(forInfoDictionaryKey: "BillNgaiSyncOrigin") as? String ?? "" }
    private var callbackScheme: String { client.components(separatedBy: ".").reversed().joined(separator: ".") }
    var configured: Bool {
        guard client.hasSuffix(".apps.googleusercontent.com"), let url = URL(string: origin), url.scheme == "https", url.host != nil, url.path.isEmpty || url.path == "/", url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else { return false }
        return true
    }
    private func fail(_ code: String) -> NSError { NSError(domain: "BillNgaiSync", code: 1, userInfo: [NSLocalizedDescriptionKey: code]) }
    private var query: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: bundle + ".google-sync", kSecAttrAccount as String: "credentials"] }
    private func credentials() throws -> [String: Any] {
        var q = query; q[kSecReturnData as String] = true
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { throw fail("SYNC_RECONNECT_REQUIRED") }
        guard status == errSecSuccess, let data = result as? Data, let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw fail("SYNC_KEYCHAIN_REQUIRED") }
        return value
    }
    private func persist(_ value: [String: Any]) throws {
        let attrs: [String: Any] = [kSecValueData as String: try JSONSerialization.data(withJSONObject: value), kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let result = SecItemUpdate(query as CFDictionary, attrs as CFDictionary)
        let status = result == errSecItemNotFound ? SecItemAdd(query.merging(attrs) { _, b in b } as CFDictionary, nil) : result
        guard status == errSecSuccess else { throw fail("SYNC_KEYCHAIN_REQUIRED") }
    }
    func disconnect() throws {
        // Local disconnect only: do not revoke the Google grant for other devices.
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw fail("SYNC_KEYCHAIN_REQUIRED") }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { controller?.view.window ?? ASPresentationAnchor() }
    private func random() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw fail("SYNC_RANDOM_UNAVAILABLE") }
        return Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
    private func tokenIdentity(_ token: String, nonce: String? = nil) throws -> String {
        // Only a precheck. The coordinator cryptographically verifies this ID token.
        let parts = token.split(separator: "."); guard parts.count == 3 else { throw fail("SYNC_IDENTITY_INVALID") }
        var payload = String(parts[1]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload), let p = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let sub = p["sub"] as? String, sub.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil,
              p["aud"] as? String == client, (p["azp"] == nil || p["azp"] as? String == client),
              ["https://accounts.google.com", "accounts.google.com"].contains(p["iss"] as? String ?? ""),
              let exp = p["exp"] as? Double, exp > Date().timeIntervalSince1970,
              nonce == nil || p["nonce"] as? String == nonce else { throw fail("SYNC_IDENTITY_INVALID") }
        return sub
    }
    func authorize(from controller: UIViewController) async throws {
        guard configured else { throw fail("SYNC_V3_NOT_CONFIGURED") }
        guard auth == nil else { throw fail("SYNC_AUTH_BUSY") }
        self.controller = controller
        let verifier = try random(), state = try random(), nonce = try random()
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        let redirect = callbackScheme + ":/oauth2redirect"
        var url = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        url.queryItems = ["client_id": client, "redirect_uri": redirect, "response_type": "code", "scope": "openid email https://www.googleapis.com/auth/drive.file", "code_challenge": challenge, "code_challenge_method": "S256", "state": state, "nonce": nonce, "access_type": "offline", "prompt": "consent select_account"].map { URLQueryItem(name: $0.key, value: $0.value) }
        let callback: URL = try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url.url!, callbackURLScheme: callbackScheme) { callback, error in
                Task { @MainActor in
                    self.auth = nil
                    if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin { continuation.resume(throwing: self.fail("SYNC_AUTH_CANCELED")); return }
                    guard error == nil, let callback = callback else { continuation.resume(throwing: self.fail("SYNC_AUTH_FAILED")); return }
                    continuation.resume(returning: callback)
                }
            }
            auth = session; session.presentationContextProvider = self
            if !session.start() { auth = nil; continuation.resume(throwing: fail("SYNC_AUTH_FAILED")) }
        }
        guard let u = URLComponents(url: callback, resolvingAgainstBaseURL: false), u.scheme == callbackScheme, u.host == nil, u.path == "/oauth2redirect" else { throw fail("SYNC_AUTH_CALLBACK_INVALID") }
        let items = u.queryItems ?? []
        guard items.filter({ $0.name == "state" }).count == 1, items.first(where: { $0.name == "state" })?.value == state else { throw fail("SYNC_AUTH_STATE_INVALID") }
        if items.contains(where: { $0.name == "error" }) { throw fail("SYNC_AUTH_DENIED") }
        guard items.filter({ $0.name == "code" }).count == 1, let code = items.first(where: { $0.name == "code" })?.value, !code.isEmpty else { throw fail("SYNC_AUTH_FAILED") }
        var token = try await exchange(["grant_type": "authorization_code", "code": code, "client_id": client, "redirect_uri": redirect, "code_verifier": verifier])
        guard let id = token["id_token"] as? String, let refresh = token["refresh_token"] as? String, !refresh.isEmpty else { throw fail("SYNC_AUTH_TOKEN_INVALID") }
        token["account"] = try tokenIdentity(id, nonce: nonce)
        try persist(token)
    }
    private func exchange(_ fields: [String: String]) async throws -> [String: Any] {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
        let form = fields.sorted(by: { $0.key < $1.key }).map { $0.key.addingPercentEncoding(withAllowedCharacters: allowed)! + "=" + $0.value.addingPercentEncoding(withAllowedCharacters: allowed)! }.joined(separator: "&")
        var req = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!); req.httpMethod = "POST"
        req.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type"); req.httpBody = Data(form.utf8)
        var result = try await json(req, limit: 65536)
        guard let access = result["access_token"] as? String, !access.isEmpty, let expires = result["expires_in"] as? Double, expires > 0 else { throw fail("SYNC_AUTH_TOKEN_INVALID") }
        result["expiry"] = Date().timeIntervalSince1970 + expires
        return result
    }
    private func tokens() async throws -> [String: Any] {
        let old = try credentials()
        if let expiry = old["expiry"] as? Double, expiry > Date().timeIntervalSince1970 + 60 { return old }
        if let task = refreshTask { return try await task.value }
        let task = Task { @MainActor () throws -> [String: Any] in
            guard let refresh = old["refresh_token"] as? String else { throw fail("SYNC_RECONNECT_REQUIRED") }
            var next = try await exchange(["grant_type": "refresh_token", "refresh_token": refresh, "client_id": client])
            guard let id = next["id_token"] as? String, try tokenIdentity(id) == old["account"] as? String else { throw fail("SYNC_ACCOUNT_MISMATCH") }
            next["refresh_token"] = next["refresh_token"] ?? refresh; next["account"] = old["account"]
            try persist(next); return next
        }
        refreshTask = task; defer { refreshTask = nil }; return try await task.value
    }
    // One connection pool for every sync request, so parallel transfers reuse connections
    // instead of opening one each. Nothing is cached, stored or given cookies.
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil; config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false
        return URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }()
    private func json(_ request: URLRequest, limit: Int = 16 * 1024 * 1024) async throws -> [String: Any] {
        var req = request; req.timeoutInterval = 30
        let (bytes, response) = try await session.bytes(for: req)
        var data = Data()
        for try await byte in bytes { data.append(byte); if data.count > limit { throw fail("SYNC_RESPONSE_TOO_LARGE") } }
        guard let response = response as? HTTPURLResponse else { throw fail("SYNC_RESPONSE_INVALID") }
        guard let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw fail("SYNC_RESPONSE_INVALID") }
        guard (200..<300).contains(response.statusCode) else {
            let code = result["error"] as? String ?? "SYNC_HTTP_\(response.statusCode)"
            throw fail(code.range(of: "^[A-Z0-9_]{1,80}$", options: .regularExpression) != nil ? code : "SYNC_SERVICE_ERROR")
        }
        return result
    }
    private final class NoRedirects: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    }
    func request(action: String, body: [String: Any] = [:], account: String? = nil) async throws -> [String: Any] {
        guard configured else { throw fail("SYNC_V3_NOT_CONFIGURED") }
        let token = try await tokens()
        if let account = account, account != token["account"] as? String { throw fail("SYNC_ACCOUNT_MISMATCH") }
        let identifier: (String) -> Bool = { $0.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil }
        var req: URLRequest
        switch action {
        case "status", "pull", "initialize", "reserve", "commit", "protocol/upgrade", "appstore-entitlement":
            let suffix: String
            if action == "pull" {
                guard let cursor = body["cursor"] as? NSNumber, CFGetTypeID(cursor) != CFBooleanGetTypeID(), cursor.doubleValue >= 0, cursor.doubleValue <= 9007199254740991, cursor.doubleValue.rounded() == cursor.doubleValue else { throw fail("INVALID_CURSOR") }
                suffix = "pull?after=\(cursor.stringValue)"
            } else { suffix = action }
            req = URLRequest(url: URL(string: origin.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/v3/" + suffix)!)
            req.setValue("Bearer " + (token["id_token"] as? String ?? ""), forHTTPHeaderField: "Authorization")
            req.setValue(token["account"] as? String, forHTTPHeaderField: "X-BillNgai-Account")
            req.setValue("4", forHTTPHeaderField: "X-BillNgai-Protocol")
            if !["status", "pull"].contains(action) { req.httpMethod = "POST"; req.httpBody = try JSONSerialization.data(withJSONObject: body); req.setValue("application/json", forHTTPHeaderField: "Content-Type"); guard req.httpBody!.count <= (action == "initialize" ? 819200 : 524288) else { throw fail("REQUEST_TOO_LARGE") } }
        case "download", "inspect":
            guard let file = body["file"] as? String, identifier(file) else { throw fail("SYNC_INVALID_FILE_ID") }
            req = URLRequest(url: URL(string: "https://www.googleapis.com/drive/v3/files/\(file)?\(action == "inspect" ? "fields=id,mimeType" : "alt=media")")!)
            req.setValue("Bearer " + (token["access_token"] as? String ?? ""), forHTTPHeaderField: "Authorization")
        case "root", "upload":
            req = URLRequest(url: URL(string: action == "root" ? "https://www.googleapis.com/drive/v3/files?fields=id" : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id")!); req.httpMethod = "POST"
            if action == "root" { req.httpBody = try JSONSerialization.data(withJSONObject: ["name": "BillNgai Workspace v3", "mimeType": "application/vnd.google-apps.folder", "appProperties": ["billngaiProtocol": "3"]]); req.setValue("application/json", forHTTPHeaderField: "Content-Type") }
            else {
                guard let root = body["root"] as? String, identifier(root), let hash = body["hash"] as? String, hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil, let text = body["text"] as? String, text.utf8.count <= 8 * 1024 * 1024 else { throw fail("SYNC_INVALID_UPLOAD") }
                let boundary = "billngai" + UUID().uuidString.replacingOccurrences(of: "-", with: "")
                let metadata: [String: Any] = ["name": hash + ".json", "parents": [root], "mimeType": "application/json", "appProperties": ["billngaiProtocol": "3"]]
                let meta = String(data: try JSONSerialization.data(withJSONObject: metadata), encoding: .utf8)!
                req.httpBody = Data("--\(boundary)\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n\(meta)\r\n--\(boundary)\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n\(text)\r\n--\(boundary)--\r\n".utf8)
                req.setValue("multipart/related; boundary=" + boundary, forHTTPHeaderField: "Content-Type")
            }
            req.setValue("Bearer " + (token["access_token"] as? String ?? ""), forHTTPHeaderField: "Authorization")
        default: throw fail("SYNC_ACTION_INVALID")
        }
        let result = try await json(req)
        if action == "status" { guard result["account"] as? String == token["account"] as? String else { throw fail("SYNC_ACCOUNT_MISMATCH") } }
        return result
    }
}
