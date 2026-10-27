import Foundation
import StudioKit
import Testing

private struct ContentParseInput: Encodable, Sendable {
    let type: String
    let content: String
}

private struct ParsedScene: Decodable, Sendable {
    let id: String
    let name: String
    let type: String
}

private struct UnknownInput: Encodable, Sendable {
    let unexpected = true
}

@Suite("Engine bridge")
struct EngineBridgeTests {
    @Test("Starts once and reports the supported wire version")
    func startsAndHandshakes() async throws {
        let bridge = EngineBridge()
        let first = try await bridge.start()
        let second = try await bridge.start()
        #expect(first == second)
        let info = try #require(await bridge.info)
        #expect(info.apiVersion == EngineBridge.supportedAPIVersion)
        #expect(info.operations.contains("project.compile"))
        #expect(info.plugins == ["star-map": "1.0.0", "civilization": "1.0.0"])
        #expect(first.scriptBytes > 100_000)
    }

    @Test("Decodes typed results")
    func typedCall() async throws {
        let bridge = EngineBridge()
        try await bridge.start()
        let scene = try await bridge.call(
            "content.parse",
            input: ContentParseInput(type: "scene", content: "---\nid: room\n---\n房间。\n"),
            as: ParsedScene.self
        )
        #expect(scene.id == "room")
        #expect(scene.name == "room")
        #expect(scene.type == "image")
    }

    @Test("Maps engine failures to stable codes")
    func engineFailures() async throws {
        let bridge = EngineBridge()
        try await bridge.start()
        await #expect(throws: EngineError.engine(EngineFailure(code: "ENGINE_UNKNOWN_OPERATION", message: "Unknown operation: project.nope"))) {
            _ = try await bridge.call("project.nope", input: EmptyEngineInput(), as: EngineInfo.self)
        }
        do {
            _ = try await bridge.call("project.compile", input: UnknownInput(), as: EngineInfo.self)
            Issue.record("project.compile accepted input without files")
        } catch let EngineError.engine(failure) {
            #expect(failure.code == "ENGINE_INVALID_INPUT")
            #expect(failure.field == "files")
        }
    }

    @Test("Refuses calls after shutdown and restarts cleanly")
    func lifecycle() async throws {
        let bridge = EngineBridge()
        try await bridge.start()
        await bridge.shutdown()
        #expect(await bridge.isRunning == false)
        await #expect(throws: EngineError.notRunning) {
            _ = try await bridge.callRaw("engine.info", input: "{}")
        }
        try await bridge.start()
        #expect(await bridge.isRunning)
    }

    @Test("Reports a missing script")
    func missingScript() async {
        let bridge = EngineBridge(scriptURL: nil)
        await #expect(throws: EngineError.scriptMissing) {
            try await bridge.start()
        }
    }
}
