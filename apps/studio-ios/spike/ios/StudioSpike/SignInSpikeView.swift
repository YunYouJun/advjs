// SPIKE (P0 feasibility): Yunle SSO v3 through ASWebAuthenticationSession.
//
// Mirrors `@yunlefun/sso` 0.6.x: top-level authorization with PKCE (S256) and
// a 256-bit nonce, an HTTPS redirect whose fragment carries `ylf_sso`, then a
// one-time code exchange at `sso-ticket` for a CloudBase custom ticket and a
// CloudBase session via `/auth/v1/signin/custom` — the same native path the
// Life app (`YunleIdentity`) uses in production.

import AuthenticationServices
import CryptoKit
import SwiftUI

struct SsoClientProfile: Hashable, Identifiable {
    let id: String
    let clientId: String
    let redirectURI: URL
    let note: String

    /// The registered origin the code is bound to; native clients send it explicitly on exchange.
    var origin: String { "https://\(redirectURI.host() ?? "")" }

    static let issuer = URL(string: "https://www.yunle.fun")!
    static let exchangeURL = URL(string: "https://api.yunle.fun/sso-ticket")!
    static let authGateway = URL(string: "https://yunlefun-8g7ybcxc7345c490.api.tcloudbasegateway.com")!
    static let scope = "identity:bootstrap"

    /// Registered today for the Web Studio; reused here only to observe the provider's behaviour.
    static let registeredWeb = SsoClientProfile(
        id: "web",
        clientId: "advjs-studio-web",
        redirectURI: URL(string: "https://studio.advjs.org/")!,
        note: "Registered Web client"
    )

    /// Native client `advjs-studio-ios`; active once the Registry release and studio.advjs.org AASA are live.
    static let proposedNative = SsoClientProfile(
        id: "native",
        clientId: "advjs-studio-ios",
        redirectURI: URL(string: "https://studio.advjs.org/auth/callback")!,
        note: "Native client advjs-studio-ios"
    )
}

struct SsoTransaction {
    let nonce: String
    let codeVerifier: String
    let codeChallenge: String
    let authorizationURL: URL

    init(profile: SsoClientProfile, prompt: String? = nil) {
        nonce = Self.randomBase64URL(byteCount: 32)
        codeVerifier = Self.randomBase64URL(byteCount: 32)
        codeChallenge = Self.base64URL(Data(SHA256.hash(data: Data(codeVerifier.utf8))))
        var components = URLComponents(url: SsoClientProfile.issuer.appendingPathComponent("auth/sso"), resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: profile.clientId),
            URLQueryItem(name: "redirect_uri", value: profile.redirectURI.absoluteString),
            URLQueryItem(name: "scope", value: SsoClientProfile.scope),
            URLQueryItem(name: "nonce", value: nonce),
            URLQueryItem(name: "code_challenge", value: codeChallenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
        ] + (prompt.map { [URLQueryItem(name: "prompt", value: $0)] } ?? [])
        authorizationURL = components.url!
    }

    enum CallbackResult: Equatable {
        case code(String)
        case failure(String)
        case invalid(String)
    }

    /// Parses `#ylf_sso=<base64url(JSON)>` and binds it to this transaction's nonce and issuer.
    func parseCallback(_ url: URL) -> CallbackResult {
        guard let fragment = url.fragment,
              let encoded = fragment.split(separator: "&").first(where: { $0.hasPrefix("ylf_sso=") })?.dropFirst("ylf_sso=".count),
              let data = Self.decodeBase64URL(String(encoded).removingPercentEncoding ?? String(encoded)),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return .invalid("missing or undecodable ylf_sso fragment")
        }
        guard payload["nonce"] as? String == nonce,
              payload["iss"] as? String == SsoClientProfile.issuer.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")) else {
            return .invalid("nonce or issuer mismatch")
        }
        if payload["ok"] as? Bool == true, let code = payload["code"] as? String, code.count == 43 {
            return .code(code)
        }
        return .failure(payload["reason"] as? String ?? "server_error")
    }

    static func randomBase64URL(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        _ = SecRandomCopyBytes(kSecRandomDefault, byteCount, &bytes)
        return base64URL(Data(bytes))
    }

    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decodeBase64URL(_ value: String) -> Data? {
        var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        return Data(base64Encoded: base64)
    }
}

struct SignInSpikeView: View {
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    @State private var profile = SsoClientProfile.registeredWeb
    @State private var ephemeral = false
    /// Control probe: a custom-scheme callback needs no associated domain, isolating HTTPS-callback failures.
    @State private var customSchemeCallback = false
    @State private var log: [String] = []

    var body: some View {
        NavigationStack {
            Form {
                Section("Client") {
                    Picker("Profile", selection: $profile) {
                        Text(SsoClientProfile.registeredWeb.note).tag(SsoClientProfile.registeredWeb)
                        Text(SsoClientProfile.proposedNative.note).tag(SsoClientProfile.proposedNative)
                    }
                    Toggle("Ephemeral session", isOn: $ephemeral)
                    Toggle("Custom-scheme callback (control)", isOn: $customSchemeCallback)
                    LabeledContent("Redirect", value: profile.redirectURI.absoluteString).font(.caption)
                }
                Section {
                    Button("Sign in with Yunle") {
                        Task { await signIn() }
                    }
                    .accessibilityIdentifier("signin.start")
                }
                Section("Log") {
                    ForEach(Array(log.enumerated()), id: \.offset) { _, line in
                        Text(line).font(.caption.monospaced()).textSelection(.enabled)
                    }
                }
            }
            .navigationTitle("Sign-in spike")
        }
        .task {
            if SpikeLaunch.has("-autorunSignInNative") {
                profile = .proposedNative
            }
            if SpikeLaunch.has("-autorunSignInScheme") {
                customSchemeCallback = true
            }
            if SpikeLaunch.has("-autorunSignIn") || SpikeLaunch.has("-autorunSignInNative") || SpikeLaunch.has("-autorunSignInScheme") {
                // Let the window become key before presenting the authentication sheet.
                try? await Task.sleep(for: .seconds(2))
                await signIn()
            }
        }
    }

    private func append(_ line: String) {
        log.append("\(Date().formatted(date: .omitted, time: .standard)) \(line)")
        print("SPIKE-SIGNIN \(line)")
    }

    private func signIn() async {
        let transaction = SsoTransaction(profile: profile)
        append("authorize \(transaction.authorizationURL.host() ?? "")\(transaction.authorizationURL.path()) client=\(profile.clientId) callback=\(customSchemeCallback ? "custom-scheme" : "https")")
        guard let host = profile.redirectURI.host() else { return }
        do {
            let callback = try await webAuthenticationSession.authenticate(
                using: transaction.authorizationURL,
                callback: customSchemeCallback ? .customScheme("advjs-studio-spike") : .https(host: host, path: profile.redirectURI.path()),
                preferredBrowserSession: ephemeral ? .ephemeral : .shared,
                additionalHeaderFields: [:]
            )
            switch transaction.parseCallback(callback) {
            case .code(let code):
                append("callback ok, code length \(code.count); exchanging")
                await exchange(code: code, transaction: transaction)
            case .failure(let reason):
                append("provider returned failure: \(reason)")
            case .invalid(let reason):
                append("callback rejected: \(reason)")
            }
        } catch {
            let nsError = error as NSError
            append("session error \(nsError.domain)#\(nsError.code): \(nsError.localizedDescription)")
        }
    }

    /// Exchanges the one-time code, then establishes and immediately ends a CloudBase
    /// session so the spike proves the whole chain without keeping credentials.
    private func exchange(code: String, transaction: SsoTransaction) async {
        do {
            let (exchangeStatus, exchange) = try await post(SsoClientProfile.exchangeURL, body: [
                "action": "exchangeSsoCode",
                "clientId": profile.clientId,
                "redirectUri": profile.redirectURI.absoluteString,
                "scope": SsoClientProfile.scope,
                "code": code,
                "nonce": transaction.nonce,
                "codeVerifier": transaction.codeVerifier,
            ], origin: profile.origin)
            // Never log the ticket or tokens.
            append("exchange HTTP \(exchangeStatus) ok=\(exchange["ok"] ?? "nil") reason=\(exchange["reason"] ?? "-") ticket=\(exchange["ticket"] == nil ? "absent" : "present")")
            guard let ticket = exchange["ticket"] as? String else { return }

            let deviceID = UUID().uuidString
            let (signInStatus, tokens) = try await post(SsoClientProfile.authGateway.appendingPathComponent("auth/v1/signin/custom"),
                                                        body: ["provider_id": "custom", "ticket": ticket], deviceID: deviceID)
            append("signin/custom HTTP \(signInStatus) access_token=\(tokens["access_token"] == nil ? "absent" : "present") refresh_token=\(tokens["refresh_token"] == nil ? "absent" : "present")")
            guard let accessToken = tokens["access_token"] as? String else { return }

            var me = URLRequest(url: SsoClientProfile.authGateway.appendingPathComponent("auth/v1/user/me"))
            me.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            me.setValue(deviceID, forHTTPHeaderField: "x-device-id")
            let (meData, meResponse) = try await Self.session.data(for: me)
            let profileJSON = (try? JSONSerialization.jsonObject(with: meData) as? [String: Any]) ?? [:]
            append("user/me HTTP \((meResponse as? HTTPURLResponse)?.statusCode ?? 0) sub=\(profileJSON["sub"] == nil ? "absent" : "present")")

            var signOut = URLRequest(url: SsoClientProfile.authGateway.appendingPathComponent("auth/v1/user/signout"))
            signOut.httpMethod = "POST"
            signOut.setValue("application/json", forHTTPHeaderField: "Content-Type")
            signOut.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            signOut.setValue(deviceID, forHTTPHeaderField: "x-device-id")
            signOut.httpBody = Data("{}".utf8)
            let (_, signOutResponse) = try await Self.session.data(for: signOut)
            append("user/signout HTTP \((signOutResponse as? HTTPURLResponse)?.statusCode ?? 0)")
        } catch {
            append("exchange chain failed: \(error.localizedDescription)")
        }
    }

    /// Ephemeral, cookie-free session; tickets and tokens never touch shared storage.
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.httpCookieAcceptPolicy = .never
        configuration.urlCache = nil
        return URLSession(configuration: configuration)
    }()

    private func post(_ url: URL, body: [String: String], origin: String? = nil, deviceID: String? = nil) async throws -> (Int, [String: Any]) {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let origin { request.setValue(origin, forHTTPHeaderField: "Origin") }
        if let deviceID { request.setValue(deviceID, forHTTPHeaderField: "x-device-id") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await Self.session.data(for: request)
        return ((response as? HTTPURLResponse)?.statusCode ?? 0, (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:])
    }
}
