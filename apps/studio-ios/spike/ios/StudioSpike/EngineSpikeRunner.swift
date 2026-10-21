// SPIKE (P0 feasibility): runs the golden engine cases produced by
// `apps/studio-ios/spike/engine/golden.ts` and compares every response with the
// Node output byte for byte.

import Darwin
import Foundation
import JavaScriptCore

enum MemoryProbe {
    /// Physical footprint as reported to Jetsam (the number Xcode's memory gauge shows).
    static func physicalFootprint() -> UInt64 {
        var info = task_vm_info_data_t()
        var count = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size / MemoryLayout<integer_t>.size)
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                task_info(mach_task_self_, task_flavor_t(TASK_VM_INFO), $0, &count)
            }
        }
        return result == KERN_SUCCESS ? info.phys_footprint : 0
    }

    static func megabytes(_ bytes: UInt64) -> Double {
        (Double(bytes) / 1_048_576 * 10).rounded() / 10
    }
}

struct EngineSpikeReport: Codable, Sendable {
    struct CaseTiming: Codable, Sendable {
        let name: String
        let coldMilliseconds: Double
        let warmMilliseconds: Double
        let outputBytes: Int
    }

    let script: String
    let device: String
    let system: String
    let isSimulator: Bool
    let caseCount: Int
    let mismatches: [String]
    let load: EngineHost.LoadMetrics
    let footprintBaselineMB: Double
    let footprintAfterLoadMB: Double
    let footprintAfterColdRunMB: Double
    let footprintAfterWarmRunMB: Double
    let footprintAfterUnloadMB: Double
    let coldRunMilliseconds: Double
    let warmRunMilliseconds: Double
    let compileTimings: [CaseTiming]
}

enum EngineSpikeRunner {
    struct GoldenCase: Decodable {
        let name: String
        let operation: String
        let input: String
    }

    static func resourceURL(_ name: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "out")
            ?? Bundle(for: BundleToken.self).url(forResource: name, withExtension: nil, subdirectory: "out")
    }

    static func run(script: String = "engine.min.js") async throws -> EngineSpikeReport {
        guard let scriptURL = resourceURL(script),
              let casesURL = resourceURL("golden/cases.json"),
              let expectedURL = resourceURL("golden/expected.json") else {
            throw EngineHostError.scriptUnreadable("Spike resources (spike/out) missing; run the engine build and golden scripts first")
        }
        let cases = try JSONDecoder().decode([GoldenCase].self, from: Data(contentsOf: casesURL))
        let expected = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: expectedURL))

        let baseline = MemoryProbe.physicalFootprint()
        let engine = try await EngineHost.load(scriptURL: scriptURL)
        let afterLoad = MemoryProbe.physicalFootprint()

        var mismatches: [String] = []
        var cold: [String: (Double, Int)] = [:]
        let coldStarted = Date()
        for item in cases {
            let started = Date()
            let output = try await engine.call(item.operation, input: item.input)
            cold[item.name] = (Date().timeIntervalSince(started) * 1000, output.utf8.count)
            // Compare UTF-8 bytes, not Swift String equality, which normalizes Unicode.
            if Data(output.utf8) != Data((expected[item.name] ?? "").utf8) {
                mismatches.append(item.name)
            }
        }
        let coldRun = Date().timeIntervalSince(coldStarted) * 1000
        let afterCold = MemoryProbe.physicalFootprint()

        var warm: [String: Double] = [:]
        let warmStarted = Date()
        for item in cases {
            let started = Date()
            _ = try await engine.call(item.operation, input: item.input)
            warm[item.name] = Date().timeIntervalSince(started) * 1000
        }
        let warmRun = Date().timeIntervalSince(warmStarted) * 1000
        let afterWarm = MemoryProbe.physicalFootprint()
        let load = engine.loadMetrics!
        await engine.unload()
        try await Task.sleep(for: .milliseconds(300))
        let afterUnload = MemoryProbe.physicalFootprint()

        let timings = cases.filter { $0.name.hasPrefix("compile:") }.map {
            EngineSpikeReport.CaseTiming(
                name: $0.name,
                coldMilliseconds: round1(cold[$0.name]?.0 ?? 0),
                warmMilliseconds: round1(warm[$0.name] ?? 0),
                outputBytes: cold[$0.name]?.1 ?? 0
            )
        }
        let report = EngineSpikeReport(
            script: script,
            device: deviceModel(),
            system: "\(ProcessInfo.processInfo.operatingSystemVersionString)",
            isSimulator: isSimulator,
            caseCount: cases.count,
            mismatches: mismatches,
            load: load,
            footprintBaselineMB: MemoryProbe.megabytes(baseline),
            footprintAfterLoadMB: MemoryProbe.megabytes(afterLoad),
            footprintAfterColdRunMB: MemoryProbe.megabytes(afterCold),
            footprintAfterWarmRunMB: MemoryProbe.megabytes(afterWarm),
            footprintAfterUnloadMB: MemoryProbe.megabytes(afterUnload),
            coldRunMilliseconds: round1(coldRun),
            warmRunMilliseconds: round1(warmRun),
            compileTimings: timings
        )
        try persist(report)
        return report
    }

    static func persist(_ report: EngineSpikeReport) throws {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(report)
        let directory = try FileManager.default.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        try data.write(to: directory.appendingPathComponent("engine-spike-\(report.script).json"), options: .atomic)
        print("SPIKE-ENGINE-REPORT \(String(decoding: data, as: UTF8.self))")
    }

    private static func round1(_ value: Double) -> Double {
        (value * 10).rounded() / 10
    }

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    static func deviceModel() -> String {
        if let simulated = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] {
            return "\(simulated) (simulator)"
        }
        var system = utsname()
        uname(&system)
        return withUnsafeBytes(of: &system.machine) { buffer in
            String(decoding: buffer.prefix { $0 != 0 }, as: UTF8.self)
        }
    }
}

private final class BundleToken {}
