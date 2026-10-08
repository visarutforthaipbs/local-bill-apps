import Capacitor
import Foundation
import UIKit
import WebKit
import StoreKit
import Security
import PDFKit

@objc(BillNgaiNative)
public final class BillNgaiNative: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BillNgaiNative"
    public let jsName = "BillNgaiNative"
    public var pluginMethods: [CAPPluginMethod] {
        var names = ["load", "save", "recover", "restoreBackup", "deviceID", "snapshot", "backups", "exportPDF", "exportData", "exportFile", "licenseStatus", "purchasePro", "restorePro", "accessibilityStatus", "preparePrintPreview", "showPrintPreview", "editorDraftLoad", "editorDraftSave", "editorDraftRemove", "syncConfiguration", "syncAuthorize", "syncRequest", "syncSave", "syncAdopt", "syncDisconnectCredentials", "syncVerifyPro"]
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--billngai-qa") { names.append(contentsOf: ["qaPDF", "qaPrintPreviewStatus"]) }
        #endif
        return names.map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    }
    private let queue = DispatchQueue(label: "com.visarut.billngai.storage")
    // A physical draft-recovery run must never reset the live synthetic sync profile.
    private var storageDirectoryName: String {
        #if DEBUG
        if Bundle.main.bundleIdentifier == "com.visarut.billngai.qa",
           (ProcessInfo.processInfo.arguments.contains("--billngai-recovery-qa") || ProcessInfo.processInfo.arguments.contains("--billngai-ui-audit")),
           ProcessInfo.processInfo.arguments.contains("--isolated-recovery-profile") { return "BillNgaiRecoveryQA" }
        #endif
        return "BillNgai"
    }
    private var store: BillNgaiStore?
    private var editorDrafts: BillNgaiEditorDraftStore?
    private var accessibilityObservers: [NSObjectProtocol] = []
    @MainActor private lazy var syncNative = BillNgaiSyncNative()
    private let productID = "com.visarut.billngai.pro"
    private var presentingShare = false
    private var presentingPreview = false
    private var generatingPreview = false
    private var printPreview: (id: String, token: String, data: Data)?
    private var transactionUpdatesTask: Task<Void, Never>?

    override public func load() {
        super.load()
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            for name in [UIContentSizeCategory.didChangeNotification, UIAccessibility.reduceMotionStatusDidChangeNotification, UIAccessibility.voiceOverStatusDidChangeNotification, UIApplication.didBecomeActiveNotification] {
                self.accessibilityObservers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                    guard let self = self else { return }
                    self.notifyListeners("accessibilityChanged", data: self.accessibilityPreferences())
                })
            }
        }
        // Pending approval and interrupted delivery may finish after purchase() returns.
        transactionUpdatesTask = Task { @MainActor [weak self] in
            // Apple delivers unfinished transactions to updates at launch too.
            // Start the live listener immediately, without a preceding scan.
            for await result in Transaction.updates { await self?.receive(result) }
        }
    }
    deinit {
        transactionUpdatesTask?.cancel()
        accessibilityObservers.forEach(NotificationCenter.default.removeObserver)
    }
    private func accessibilityPreferences() -> [String: Any] {
        let traits = bridge?.webView?.traitCollection
        return ["textScale": UIFontMetrics(forTextStyle: .body).scaledValue(for: 16, compatibleWith: traits) / 16,
                "reduceMotion": UIAccessibility.isReduceMotionEnabled,
                "voiceOver": UIAccessibility.isVoiceOverRunning,
                "contentSizeCategory": (traits?.preferredContentSizeCategory ?? .large).rawValue,
                "applicationContentSizeCategory": UIApplication.shared.preferredContentSizeCategory.rawValue,
                "viewContentSizeCategory": (bridge?.viewController?.traitCollection.preferredContentSizeCategory ?? .unspecified).rawValue]
    }
    @objc func accessibilityStatus(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.accessibilityPreferences()) }
    }
    private func withEditorDrafts(_ call: CAPPluginCall, _ action: @escaping (BillNgaiEditorDraftStore) throws -> [String: Any]) {
        queue.async { [weak self] in
            guard let self = self else { call.reject("HOST_UNAVAILABLE"); return }
            do {
                if self.editorDrafts == nil {
                    let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                    self.editorDrafts = try BillNgaiEditorDraftStore(directory: base.appendingPathComponent(self.storageDirectoryName + "/EditorDrafts", isDirectory: true))
                }
                call.resolve(try action(self.editorDrafts!))
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func editorDraftLoad(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("DRAFT_INVALID_ARGUMENT"); return }
        withEditorDrafts(call) { store in
            let result = try store.load(key: key)
            return ["text": result.text as Any? ?? NSNull(), "revision": result.revision]
        }
    }
    @objc func editorDraftSave(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let text = call.getString("text"), let revision = call.getString("expectedRevision") else { call.reject("DRAFT_INVALID_ARGUMENT"); return }
        withEditorDrafts(call) { ["revision": try $0.save(key: key, text: text, expectedRevision: revision)] }
    }
    @objc func editorDraftRemove(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let revision = call.getString("expectedRevision") else { call.reject("DRAFT_INVALID_ARGUMENT"); return }
        withEditorDrafts(call) { ["revision": try $0.remove(key: key, expectedRevision: revision)] }
    }
    @MainActor private func receive(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = result, transaction.productID == productID else { return }
        do {
            try persistProof(result.jwsRepresentation)
            await transaction.finish()
            notifyListeners("proStatusChanged", data: try await ownership())
        } catch {
            // Leave delivery unfinished when secure persistence fails; retry next launch.
        }
    }

    private func withStore(_ call: CAPPluginCall, _ action: @escaping (BillNgaiStore) throws -> [String: Any]) {
        queue.async { [weak self] in
            guard let self = self else { call.reject("HOST_UNAVAILABLE"); return }
            do {
                if self.store == nil {
                    let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                    self.store = try BillNgaiStore(directory: base.appendingPathComponent(self.storageDirectoryName, isDirectory: true))
                }
                call.resolve(try action(self.store!))
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func load(_ call: CAPPluginCall) {
        withStore(call) { store in
            let result = try store.load()
            return ["text": result.text as Any? ?? NSNull(), "revision": result.revision]
        }
    }
    @objc func save(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), let revision = call.getString("expectedRevision") else { call.reject("DATA_INVALID_ARGUMENT"); return }
        withStore(call) { ["revision": try $0.save(text: text, expectedRevision: revision)] }
    }
    @objc func recover(_ call: CAPPluginCall) {
        guard let text=call.getString("text") else {call.reject("DATA_INVALID_ARGUMENT");return}
        withStore(call) {["revision":try $0.recover(text:text)]}
    }
    @objc func restoreBackup(_ call: CAPPluginCall) {
        guard let name=call.getString("name") else {call.reject("DATA_INVALID_ARGUMENT");return}
        withStore(call) {store in ["revision":try store.recover(text:store.backupText(name:name))]}
    }
    @objc func deviceID(_ call: CAPPluginCall) { withStore(call) { ["id": try $0.deviceID()] } }
    @objc func snapshot(_ call: CAPPluginCall) {
        guard let label = call.getString("label") else { call.reject("DATA_INVALID_ARGUMENT"); return }
        withStore(call) { ["name": try $0.snapshot(label: label) as Any? ?? NSNull()] }
    }
    @objc func backups(_ call: CAPPluginCall) { withStore(call) { ["items": try $0.backups()] } }

    @objc func syncConfiguration(_ call: CAPPluginCall) {
        Task { @MainActor in call.resolve(["configured": syncNative.configured]) }
    }
    @objc func syncAuthorize(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let controller = bridge?.viewController else { call.reject("HOST_UNAVAILABLE"); return }
            do { try await syncNative.authorize(from: controller); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func syncRequest(_ call: CAPPluginCall) {
        guard let action = call.getString("action"), action != "appstore-entitlement" else { call.reject("SYNC_ACTION_INVALID"); return }
        Task { @MainActor in
            do { call.resolve(try await syncNative.request(action: action, body: call.getObject("body") ?? [:], account: call.getString("account"))) }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func syncVerifyPro(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                var proof: String?
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result, transaction.productID == productID, transaction.revocationDate == nil, !transaction.isUpgraded { proof = result.jwsRepresentation; break }
                }
                guard let proof = proof else { call.reject("APPSTORE_PRO_REQUIRED"); return }
                call.resolve(try await syncNative.request(action: "appstore-entitlement", body: ["signedTransaction": proof]))
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func syncSave(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), let revision = call.getString("expectedRevision") else { call.reject("DATA_INVALID_ARGUMENT"); return }
        withStore(call) { ["revision": try $0.save(text: text, expectedRevision: revision, allowSync: true)] }
    }
    @objc func syncAdopt(_ call: CAPPluginCall) {
        guard call.getBool("replaceLocal") == true, let text = call.getString("text"), let revision = call.getString("expectedRevision") else { call.reject("SYNC_ADOPTION_INVALID"); return }
        withStore(call) { ["revision": try $0.save(text: text, expectedRevision: revision, allowSync: true, adoptWorkspace: true)] }
    }
    @objc func syncDisconnectCredentials(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { try syncNative.disconnect(); call.resolve() } catch { call.reject(error.localizedDescription) }
        }
    }

    // Only bundled top-level UI may keep the native bridge. External navigation is blocked.
    @objc override public func shouldOverrideLoad(_ action: WKNavigationAction) -> NSNumber? {
        guard let url = action.request.url else { return true }
        return NSNumber(value: !(url.scheme == "capacitor" && url.host == "localhost"))
    }
    @objc func exportData(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), text.utf8.count <= 32 * 1024 * 1024,
              let data = text.data(using: .utf8), let object = try? JSONSerialization.jsonObject(with: data), object is [String: Any] else { call.reject("DATA_INVALID_EXPORT"); return }
        DispatchQueue.main.async { self.share(data: data, name: "BillNgai-backup.json", call: call) }
    }
    @objc func exportFile(_ call: CAPPluginCall) {
        guard let text = call.getString("text"), text.utf8.count <= 32 * 1024 * 1024,
              let name = call.getString("name"), name.count <= 160,
              !name.contains("/"), !name.contains("\\"),
              ["csv", "json", "txt"].contains(URL(fileURLWithPath: name).pathExtension.lowercased()) else { call.reject("DATA_INVALID_EXPORT"); return }
        DispatchQueue.main.async { self.share(data: Data(text.utf8), name: name, call: call) }
    }
    @objc func exportPDF(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), name.hasSuffix(".pdf"), name.count <= 160,
              !name.contains("/"), !name.contains("\\"),
              let documentID = call.getString("documentId"), !documentID.isEmpty, documentID.count <= 128 else { call.reject("PDF_INVALID_ARGUMENT"); return }
        DispatchQueue.main.async {
            if let token = call.getString("previewToken") {
                guard let cached = self.printPreview, cached.id == documentID, cached.token == token else { call.reject("PDF_PREVIEW_EXPIRED"); return }
                self.validatePDFSelection(documentID) { valid in
                    guard valid else { call.reject("PDF_OUTPUT_BLOCKED"); return }
                    self.share(data: cached.data, name: name, call: call)
                }
                return
            }
            self.makePDF(expectedID: documentID) { result in
                switch result {
                case .success(let data): self.share(data: data, name: name, call: call)
                case .failure(let error): call.reject(error.localizedDescription)
                }
            }
        }
    }
    @objc func preparePrintPreview(_ call: CAPPluginCall) {
        guard let documentID = call.getString("documentId"), !documentID.isEmpty, documentID.count <= 128 else { call.reject("PDF_INVALID_ARGUMENT"); return }
        DispatchQueue.main.async {
            guard !self.generatingPreview, !self.presentingShare, !self.presentingPreview else { call.reject("PDF_PREVIEW_BUSY"); return }
            self.generatingPreview = true
            self.makePDF(expectedID: documentID) { result in
                switch result {
                case .failure(let error): self.generatingPreview = false; call.reject(error.localizedDescription)
                case .success(let data):
                    guard data.count <= 32 * 1024 * 1024 else { self.generatingPreview = false; call.reject("PDF_PREVIEW_SIZE_LIMIT"); return }
                    let token = UUID().uuidString
                    self.printPreview = (documentID, token, data)
                    self.generatingPreview = false
                    call.resolve(["token": token, "documentId": documentID, "pageCount": PDFDocument(data: data)?.pageCount ?? 0])
                }
            }
        }
    }
    @objc func showPrintPreview(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let id = call.getString("documentId"),
              let name = call.getString("name"), name.hasSuffix(".pdf"), name.count <= 160, !name.contains("/"), !name.contains("\\") else { call.reject("PDF_INVALID_ARGUMENT"); return }
        DispatchQueue.main.async {
            guard !self.presentingPreview, !self.presentingShare, !self.generatingPreview, let controller = self.bridge?.viewController, controller.presentedViewController == nil else { call.reject("PDF_PREVIEW_BUSY"); return }
            guard let cached = self.printPreview, cached.token == token, cached.id == id else { call.reject("PDF_PREVIEW_EXPIRED"); return }
            self.presentingPreview = true
            self.validatePDFSelection(id) { valid in
            guard valid, controller.presentedViewController == nil else { self.presentingPreview = false; call.reject("PDF_OUTPUT_BLOCKED"); return }
            let preview = BillNgaiPrintPreviewViewController(data: cached.data, fileName: name,
                closeLabel: call.getString("closeLabel") ?? "Close", shareLabel: call.getString("shareLabel") ?? "Share PDF", fitLabel: call.getString("fitLabel") ?? "Fit page", shareFailedLabel: call.getString("shareFailedLabel") ?? "Could not share the PDF. Try again.") { [weak self] in self?.presentingPreview = false }
            let navigation = UINavigationController(rootViewController: preview)
            navigation.overrideUserInterfaceStyle = .light
            navigation.view.backgroundColor = UIColor(named: "BillNgaiCanvas")
            navigation.modalPresentationStyle = .fullScreen
            controller.present(navigation, animated: !UIAccessibility.isReduceMotionEnabled) { call.resolve(["presented": true]) }
            }
        }
    }
    private func validatePDFSelection(_ id: String, completion: @escaping (Bool) -> Void) {
        guard let web = bridge?.webView,
              let encoded = try? JSONSerialization.data(withJSONObject: [id]),
              let literal = String(data: encoded, encoding: .utf8) else { completion(false); return }
        web.evaluateJavaScript("(()=>{const d=getViewingDocument();return currentView==='docview'&&!!d&&!documentOutputBlocked(d)&&d.id===\(literal)[0];})()") { value, error in
            completion(error == nil && value as? Bool == true)
        }
    }
    private func makePDF(expectedID: String? = nil, _ completion: @escaping (Result<Data, Error>) -> Void) {
        func fail(_ code: String) { completion(.failure(NSError(domain: "BillNgai", code: 1, userInfo: [NSLocalizedDescriptionKey: code]))) }
        guard let web = bridge?.webView else { fail("PDF_VIEW_UNAVAILABLE"); return }
        let selection: String
        if let expectedID = expectedID {
            guard let encoded = try? JSONSerialization.data(withJSONObject: [expectedID]),
                  let literal = String(data: encoded, encoding: .utf8) else { fail("PDF_INVALID_ARGUMENT"); return }
            selection = "d.id===\(literal)[0]"
        } else { selection = "true" }
        web.evaluateJavaScript("(()=>{const d=getViewingDocument();return !!d&&!documentOutputBlocked(d)&&(\(selection));})()") { value, error in
                guard error == nil, value as? Bool == true else { fail("PDF_OUTPUT_BLOCKED"); return }
                // UIKit's print formatter applies the same print stylesheet as desktop output.
                let renderer = UIPrintPageRenderer()
                renderer.setValue(NSValue(cgRect: CGRect(x: 0, y: 0, width: 595.28, height: 841.89)), forKey: "paperRect")
                renderer.setValue(NSValue(cgRect: CGRect(x: 24, y: 24, width: 547.28, height: 793.89)), forKey: "printableRect")
                renderer.addPrintFormatter(web.viewPrintFormatter(), startingAtPageAt: 0)
                renderer.prepare(forDrawingPages: NSRange(location: 0, length: 1))
                guard renderer.numberOfPages > 0, renderer.numberOfPages <= 40 else { fail("PDF_PAGE_LIMIT"); return }
                let data = UIGraphicsPDFRenderer(bounds: renderer.paperRect).pdfData { context in
                    for page in 0..<renderer.numberOfPages {
                        context.beginPage()
                        renderer.drawPage(at: page, in: renderer.paperRect)
                    }
                }
                completion(.success(data))
        }
    }
    #if DEBUG
    @objc func qaPrintPreviewStatus(_ call: CAPPluginCall) {
        guard ProcessInfo.processInfo.arguments.contains("--billngai-qa") else { call.reject("QA_DISABLED"); return }
        DispatchQueue.main.async {
            let navigation = self.bridge?.viewController?.presentedViewController as? UINavigationController
            let viewer = navigation?.viewControllers.first as? BillNgaiPrintPreviewViewController
            call.resolve(["presented": self.presentingPreview, "nativeViewer": viewer != nil, "viewer": viewer?.qaState ?? [:]])
        }
    }
    @objc func qaPDF(_ call: CAPPluginCall) {
        guard ProcessInfo.processInfo.arguments.contains("--billngai-qa") else { call.reject("QA_DISABLED"); return }
        DispatchQueue.main.async {
            self.makePDF(expectedID: call.getString("documentId")) { result in
                do {
                    let data = try result.get()
                    let target = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("mobile-qa.pdf")
                    try data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                    let pdf = PDFDocument(data: data), text = pdf?.string ?? ""
                    call.resolve(["pages": pdf?.pageCount ?? 0, "bytes": data.count, "receipt": text.contains("Receipt"), "netAmount": text.contains("970.00")])
                } catch { call.reject(error.localizedDescription) }
            }
        }
    }
    #endif
    private func share(data: Data, name: String, call: CAPPluginCall) {
        guard !presentingShare, !presentingPreview, !generatingPreview, let controller = bridge?.viewController, controller.presentedViewController == nil else { call.reject("SHARE_BUSY"); return }
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let file = directory.appendingPathComponent(name)
            try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = controller.view
            sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
            presentingShare = true
            sheet.completionWithItemsHandler = { _, completed, _, error in
                self.presentingShare = false
                if let error = error { call.reject(error.localizedDescription) }
                else { call.resolve(["path": completed ? name as Any : NSNull()]) }
                try? FileManager.default.removeItem(at: directory)
            }
            controller.present(sheet, animated: true)
        } catch { call.reject(error.localizedDescription) }
    }

    @MainActor private func ownership(includePrice: Bool = false) async throws -> [String: Any] {
        var valid = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == productID,
               transaction.revocationDate == nil, !transaction.isUpgraded {
                // StoreKit's verified current entitlement is the source of truth;
                // a failed optional cache must not erase ownership on restore.
                try? persistProof(result.jwsRepresentation)
                valid = true
            }
        }
        var result: [String: Any] = ["valid": valid, "source": "apple", "cloudReady": false]
        if includePrice {
            if let product = try? await Product.products(for: [productID]).first { result["price"] = product.displayPrice }
            else { result["pricingUnavailable"] = true }
        }
        return result
    }
    @objc func licenseStatus(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try await ownership(includePrice: call.getBool("includePrice") ?? false)) } catch { call.reject("APPLE_VERIFICATION_UNAVAILABLE") }
        }
    }
    @objc func purchasePro(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [productID]).first else { call.reject("APPLE_PRODUCT_UNAVAILABLE"); return }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification, transaction.productID == productID,
                          transaction.revocationDate == nil else { call.reject("APPLE_UNVERIFIED_PURCHASE"); return }
                    try persistProof(verification.jwsRepresentation)
                    await transaction.finish()
                    call.resolve(try await ownership())
                case .pending: call.resolve(["valid": false, "pending": true])
                case .userCancelled: call.resolve(["valid": false, "canceled": true])
                @unknown default: call.reject("APPLE_PURCHASE_UNAVAILABLE")
                }
            } catch {
                call.reject(error.localizedDescription == "APPLE_KEYCHAIN_REQUIRED" ? "APPLE_KEYCHAIN_REQUIRED" : "APPLE_PURCHASE_FAILED")
            }
        }
    }
    @objc func restorePro(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { try await AppStore.sync(); call.resolve(try await ownership()) }
            catch { call.reject("APPLE_RESTORE_FAILED") }
        }
    }
    private func persistProof(_ proof: String) throws {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.visarut.billngai.apple-proof", kSecAttrAccount as String: productID]
        let attributes: [String: Any] = [kSecValueData as String: Data(proof.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let updated = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        let status = updated == errSecItemNotFound ? SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) : updated
        guard status == errSecSuccess else { throw NSError(domain: "BillNgai", code: Int(status), userInfo: [NSLocalizedDescriptionKey: "APPLE_KEYCHAIN_REQUIRED"]) }
    }
}
