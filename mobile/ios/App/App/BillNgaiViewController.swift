import Capacitor
import UIKit

final class BillNgaiViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BillNgaiNative())
        overrideUserInterfaceStyle = .light
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--billngai-qa") || ProcessInfo.processInfo.arguments.contains("--billngai-ui-audit") || ProcessInfo.processInfo.arguments.contains("--billngai-recovery-qa") {
            waitForSyntheticRenderer(remaining: 60)
        }
        #endif
    }
    #if DEBUG
    private func waitForSyntheticRenderer(remaining: Int) {
        bridge?.webView?.evaluateJavaScript("typeof DB !== 'undefined' && DB !== null && typeof mobileMore !== 'undefined' && typeof mobileEditorRecovery !== 'undefined' && typeof BillNgaiMobileAccessibility !== 'undefined' && !!window.BillNgaiMobileBoot") { value, _ in
            if value as? Bool == true { self.runSyntheticCheck() }
            else if remaining > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.waitForSyntheticRenderer(remaining: remaining - 1) }
            }
        }
    }
    private func runSyntheticCheck() {
        guard let scriptURL = Bundle.main.url(forResource: "mobile-qa", withExtension: "js", subdirectory: "public"),
              let script = try? String(contentsOf: scriptURL, encoding: .utf8) else { return }
        let args = ProcessInfo.processInfo.arguments
        func option(_ name: String, fallback: String) -> String {
            guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else { return fallback }
            return args[index + 1]
        }
        let recoveryQA = args.contains("--billngai-recovery-qa")
        let uiAudit = args.contains("--billngai-ui-audit")
        let screen = option("--audit-screen", fallback: "client")
        let language = option("--audit-language", fallback: "en")
        let runID = option("--audit-run-id", fallback: UUID().uuidString)
        var source = script
        if uiAudit {
            guard let auditURL = Bundle.main.url(forResource: "mobile-ui-audit", withExtension: "js", subdirectory: "public"),
                  let audit = try? String(contentsOf: auditURL, encoding: .utf8) else { return }
            source = "if (!DB.meta?.mobileSynthetic) { await (async () => {\n" + script + "\n})(); }\n" + audit
        }
        if recoveryQA {
            guard let url = Bundle.main.url(forResource: "mobile-recovery-qa", withExtension: "js", subdirectory: "public"),
                  let recovery = try? String(contentsOf: url, encoding: .utf8) else { return }
            source = "if (!DB.meta?.mobileSynthetic) { await (async () => {\n" + script + "\n})(); }\n" + recovery
        }
        // QA resources and entry points exist only in explicit debug test bundles.
        bridge?.webView?.callAsyncJavaScript("await window.BillNgaiMobileBoot;\n" + source, arguments: ["auditScreen": screen, "auditLanguage": language, "recoveryPhase": option("--recovery-phase", fallback: "write")], in: nil, in: .page) { result in
            let value: [String: Any]
            switch result {
            case .success(let output): value = ["ok": true, "result": output, "runID": runID]
            case .failure(let error): value = ["ok": false, "runID": runID, "error": error.localizedDescription, "reason": (error as NSError).userInfo["WKJavaScriptExceptionMessage"] ?? "unknown"]
            }
            if let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]),
               let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first {
                let name = recoveryQA ? "mobile-recovery-qa-result.json" : uiAudit ? "mobile-ui-audit-result.json" : "mobile-qa-result.json"
                try? data.write(to: dir.appendingPathComponent(name), options: .atomic)
            }
        }
    }
    #endif
}
