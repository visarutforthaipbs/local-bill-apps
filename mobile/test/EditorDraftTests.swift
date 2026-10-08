import Foundation
import CryptoKit

@main struct EditorDraftTests {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("BillNgai-editor-draft-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        var passed = 0
        func check(_ condition: Bool, _ label: String) { precondition(condition, label); passed += 1 }
        func rejects(_ label: String, _ work: () throws -> Void) { do { try work(); preconditionFailure(label) } catch { passed += 1 } }
        func fileName(for key: String) -> String {
            SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined() + ".json"
        }

        let store = try BillNgaiEditorDraftStore(directory: root)
        let empty = try store.load(key: "client:1"); check(empty.text == nil && empty.revision == "empty", "empty load")

        // Exact-byte save/load, surviving a fresh instance (restart).
        let text = "{\"note\":\"draft ภาษาไทย\",\"n\":1}"
        let revision = try store.save(key: "client:1", text: text, expectedRevision: "empty")
        check(revision == SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined(), "revision is SHA256 of exact UTF-8 text")
        let reloaded = try BillNgaiEditorDraftStore(directory: root).load(key: "client:1")
        check(reloaded.text == text && reloaded.revision == revision, "exact bytes survive restart")

        // Stale save and stale clear fail without changing the acknowledged draft.
        rejects("stale save") { _ = try store.save(key: "client:1", text: "{\"note\":\"stale\"}", expectedRevision: "stale") }
        rejects("stale clear") { _ = try store.remove(key: "client:1", expectedRevision: "stale") }
        check(try store.load(key: "client:1").text == text, "stale ops preserve draft")

        // Revision-guarded clear removes the draft and returns to "empty".
        check(try store.remove(key: "client:1", expectedRevision: revision) == "empty", "clear returns empty")
        let cleared = try store.load(key: "client:1"); check(cleared.text == nil && cleared.revision == "empty", "clear removes draft")
        check(try store.remove(key: "client:1", expectedRevision: "empty") == "empty", "clear on empty is a guarded no-op")

        // Independent keys, including both allowed prefixes.
        let a = try store.save(key: "client:2", text: "{\"a\":1}", expectedRevision: "empty")
        let b = try store.save(key: "recurring:job-1", text: "{\"b\":2}", expectedRevision: "empty")
        check(a != b, "distinct revisions per key")
        check(try store.load(key: "client:2").text == "{\"a\":1}", "independent client key")
        check(try store.load(key: "recurring:job-1").text == "{\"b\":2}", "independent recurring key")
        _ = try store.remove(key: "client:2", expectedRevision: a)
        check(try store.load(key: "recurring:job-1").text == "{\"b\":2}", "clear one key keeps the other")

        // Invalid keys never reach the filesystem; even traversal-looking keys hash to plain filenames.
        rejects("bad prefix") { _ = try store.load(key: "other:1") }
        rejects("control character key") { _ = try store.load(key: "client:1\u{0000}") }
        rejects("oversize key") { _ = try store.load(key: "client:" + String(repeating: "k", count: 256)) }
        let escapeKey = "client:../../escape"
        let escapeRevision = try store.save(key: escapeKey, text: "{\"e\":1}", expectedRevision: "empty")
        check(FileManager.default.fileExists(atPath: root.appendingPathComponent(fileName(for: escapeKey)).path), "traversal key hashes to plain filename inside directory")
        check(try store.load(key: escapeKey).revision == escapeRevision, "traversal key round-trips safely")

        // Invalid JSON text and oversize text are rejected without touching stored data.
        rejects("non-JSON text") { _ = try store.save(key: "client:3", text: "not json", expectedRevision: "empty") }
        rejects("JSON array root") { _ = try store.save(key: "client:3", text: "[1,2]", expectedRevision: "empty") }
        rejects("oversize text") { _ = try store.save(key: "client:3", text: "{\"pad\":\"\(String(repeating: "x", count: 512 * 1024))\"}", expectedRevision: "empty") }
        check(try store.load(key: "client:3").text == nil, "rejected saves store nothing")

        // Corrupt on-disk data is refused on load and save, never treated as empty.
        let corruptName = fileName(for: "client:corrupt")
        try Data("invalid json".utf8).write(to: root.appendingPathComponent(corruptName))
        rejects("corrupt load") { _ = try store.load(key: "client:corrupt") }
        rejects("corrupt save") { _ = try store.save(key: "client:corrupt", text: "{}", expectedRevision: "empty") }

        // Symlinked draft files are refused, not followed.
        let linkName = fileName(for: "client:link")
        try FileManager.default.createSymbolicLink(atPath: root.appendingPathComponent(linkName).path, withDestinationPath: root.appendingPathComponent(corruptName).path)
        rejects("symlink load") { _ = try store.load(key: "client:link") }
        rejects("symlink save") { _ = try store.save(key: "client:link", text: "{}", expectedRevision: "empty") }

        try FileManager.default.createSymbolicLink(at: root.appendingPathComponent(fileName(for: "client:dangling")), withDestinationURL: root.appendingPathComponent("absent"))
        rejects("dangling link refused") { _ = try store.load(key: "client:dangling") }
        rejects("Unicode control key refused") { _ = try store.load(key: "client:\u{0085}") }
        let linkDirectory = root.appendingPathComponent("link-directory")
        try FileManager.default.createSymbolicLink(at: linkDirectory, withDestinationURL: root)
        rejects("cache directory link refused") { _ = try BillNgaiEditorDraftStore(directory: linkDirectory) }
        // Private permissions: 0700 directory, 0600 files.
        let dirAttrs = try FileManager.default.attributesOfItem(atPath: root.path)
        check((dirAttrs[.posixPermissions] as? NSNumber)?.uint16Value == 0o700, "private directory")
        let draftAttrs = try FileManager.default.attributesOfItem(atPath: root.appendingPathComponent(fileName(for: "recurring:job-1")).path)
        check((draftAttrs[.posixPermissions] as? NSNumber)?.uint16Value == 0o600, "private file")

        print("Passed \(passed) editor draft assertions using synthetic files.")
    }
}
