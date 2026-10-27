import Foundation
import StudioKit
import Testing

/// P0 saw JavaScriptCore memory climb across golden runs in one context and
/// stay high after release. Each project now gets its own virtual machine;
/// this measures that opening and closing projects does not keep growing.
@Suite("Engine memory", .serialized)
struct EngineMemoryTests {
    @Test("Closing a project's engine releases its heap")
    func repeatedProjectsDoNotAccumulate() async throws {
        let golden = try GoldenCases.load()
        let cycles = 5
        var samples: [(loaded: UInt64, ran: UInt64, closed: UInt64)] = []
        let baseline = try #require(ProcessMemory.footprint())

        for _ in 0..<cycles {
            let bridge = EngineBridge()
            try await bridge.start()
            let loaded = try #require(ProcessMemory.footprint())
            for item in golden.cases {
                _ = try await bridge.callRaw(item.operation, input: item.input)
            }
            let ran = try #require(ProcessMemory.footprint())
            await bridge.shutdown()
            let closed = try #require(ProcessMemory.footprint())
            samples.append((loaded, ran, closed))
        }

        let megabytes = { (value: UInt64) in String(format: "%.1f", Double(value) / 1_048_576) }
        let rows = samples.enumerated().map { index, sample in
            "cycle \(index + 1): loaded \(megabytes(sample.loaded)) ran \(megabytes(sample.ran)) closed \(megabytes(sample.closed))"
        }
        let report = "baseline \(megabytes(baseline)); \(rows.joined(separator: "; ")) (MB)"
        print("[engine-memory] \(report)")
        Attachment.record(report, named: "engine-memory.txt")

        // After warm-up, later projects must not keep adding retained memory.
        let settled = samples[1].closed
        let last = try #require(samples.last).closed
        #expect(last <= settled + 48 * 1_048_576, "closed footprint grew from \(megabytes(settled)) to \(megabytes(last)) MB")
    }
}
