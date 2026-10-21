import Foundation
import StudioKit
import Testing

/// Node and JavaScriptCore must return byte-identical responses for every
/// golden case. Runs on the Mac (`swift test`) and on iOS simulators
/// (`xcodebuild test`), each with that platform's JavaScriptCore.
@Suite("Engine parity with Node")
struct EngineParityTests {
    @Test("Bundled engine is the one the golden files were generated from")
    func bundledEngineMatchesGolden() throws {
        let golden = try GoldenCases.load()
        let script = try #require(EngineBridge.bundledScriptURL)
        #expect(try GoldenCases.sha256(of: script) == golden.summary.engineSha256)
    }

    @Test("Every golden case matches Node byte for byte")
    func goldenCasesMatchNode() async throws {
        let golden = try GoldenCases.load()
        let bridge = EngineBridge()
        try await bridge.start()
        var mismatches: [String] = []
        for item in golden.cases {
            let response = try await bridge.callRaw(item.operation, input: item.input)
            if response != golden.expected[item.name] {
                mismatches.append(item.name)
            }
        }
        await bridge.shutdown()
        #expect(golden.cases.count > 300)
        #expect(mismatches.isEmpty, "mismatched cases: \(mismatches)")
    }
}
