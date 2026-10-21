// SPIKE (P0 feasibility): Node vs JavaScriptCore byte parity on golden cases.

import Testing
@testable import StudioSpike

@Suite("Engine parity (spike)")
struct EngineParityTests {
    @Test("Minified engine matches Node output byte for byte")
    func minifiedParity() async throws {
        let report = try await EngineSpikeRunner.run(script: "engine.min.js")
        #expect(report.caseCount > 100)
        #expect(report.mismatches.isEmpty, "mismatches: \(report.mismatches)")
    }

    @Test("Unminified engine matches Node output byte for byte")
    func unminifiedParity() async throws {
        let report = try await EngineSpikeRunner.run(script: "engine.js")
        #expect(report.mismatches.isEmpty, "mismatches: \(report.mismatches)")
    }
}
