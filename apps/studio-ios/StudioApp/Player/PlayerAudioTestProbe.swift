#if DEBUG
import Foundation
import WebKit

/// Opt-in XCUITest measurement of the final Web Audio graph output. The
/// analyser is a side branch and leaves the connection to the speaker intact.
enum PlayerAudioTestProbe {
    static var enabled: Bool {
        let arguments = ProcessInfo.processInfo.arguments
        return arguments.contains("-studioUITesting") && arguments.contains("-studioMeasureAudio")
    }

    static let script = WKUserScript(source: """
        (() => {
            const connect = AudioNode.prototype.connect;
            AudioNode.prototype.connect = function (destination, ...ports) {
                const result = connect.call(this, destination, ...ports);
                if (destination === this.context.destination && !globalThis.studioAudioLevel) {
                    const analyser = this.context.createAnalyser();
                    connect.call(this, analyser);
                    const samples = new Float32Array(analyser.fftSize);
                    globalThis.studioAudioLevel = () => {
                        analyser.getFloatTimeDomainData(samples);
                        return Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
                    };
                }
                return result;
            };
        })();
        """, injectionTime: .atDocumentStart, forMainFrameOnly: true)

    static func measure(in webView: WKWebView) async {
        let target = FileManager.default.temporaryDirectory.appending(path: "ui-tests/player-audio-rms.txt")
        for _ in 0..<60 {
            guard !Task.isCancelled else { return }
            if let value = try? await webView.evaluateJavaScript("globalThis.studioAudioLevel?.() ?? 0") as? Double,
               value.isFinite, value > 0.0001 {
                try? Data(String(value).utf8).write(to: target, options: .atomic)
                return
            }
            try? await Task.sleep(for: .milliseconds(250))
        }
    }
}
#endif
