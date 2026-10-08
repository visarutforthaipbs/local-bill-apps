import Foundation
import CryptoKit
import Darwin

// Private atomic editor-draft cache. Never touches billing.json, issue documents,
// or financial numbers; drafts are ephemeral, app-private, revision-guarded JSON text.
final class BillNgaiEditorDraftStore {
    private let directory: URL
    private let lock = NSRecursiveLock()
    private let manager = FileManager.default
    private static let emptyRevision = "empty"
    private static let maxTextBytes = 512 * 1024
    private static let maxKeyBytes = 256

    init(directory: URL) throws {
        self.directory = directory
        try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        guard try manager.attributesOfItem(atPath: directory.path)[.type] as? FileAttributeType == .typeDirectory else { throw NSError(domain: "BillNgaiEditorDraftStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "DRAFT_INVALID_DIRECTORY"]) }
        try manager.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directory.path)
    }

    private func error(_ code: String) -> NSError {
        NSError(domain: "BillNgaiEditorDraftStore", code: 1, userInfo: [NSLocalizedDescriptionKey: code])
    }

    private func hash(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    // Keys must start client: or recurring:, fit 256 UTF-8 bytes, and carry no
    // control characters. Only a SHA256 of the validated key becomes a filename.
    private func fileURL(forKey key: String) throws -> URL {
        guard key.hasPrefix("client:") || key.hasPrefix("recurring:") else { throw error("DRAFT_INVALID_KEY") }
        let bytes = Array(key.utf8)
        guard bytes.count <= Self.maxKeyBytes, !key.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) else { throw error("DRAFT_INVALID_KEY") }
        return directory.appendingPathComponent("\(hash(Data(bytes))).json")
    }

    private func validate(_ data: Data) throws {
        guard data.count <= Self.maxTextBytes,
              String(data: data, encoding: .utf8) != nil,
              let json = try? JSONSerialization.jsonObject(with: data),
              json is [String: Any] else { throw error("DRAFT_INVALID_JSON") }
    }

    private func read(_ file: URL) throws -> Data? {
        // attributesOfItem uses lstat: symlinks (even dangling) are seen as symlinks and refused.
        let attrs: [FileAttributeKey: Any]
        do { attrs = try manager.attributesOfItem(atPath: file.path) }
        catch let failure as NSError {
            if failure.domain == NSCocoaErrorDomain && failure.code == NSFileReadNoSuchFileError { return nil }
            throw failure
        }
        guard attrs[.type] as? FileAttributeType == .typeRegular,
              try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey]).isRegularFile == true,
              try file.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink != true else { throw error("DRAFT_INVALID_FILE") }
        guard ((attrs[.size] as? NSNumber)?.intValue ?? Int.max) <= Self.maxTextBytes else { throw error("DRAFT_INVALID_JSON") }
        let data = try Data(contentsOf: file)
        try validate(data)
        return data
    }

    func load(key: String) throws -> (text: String?, revision: String) {
        lock.lock(); defer { lock.unlock() }
        let file = try fileURL(forKey: key)
        guard let data = try read(file), let text = String(data: data, encoding: .utf8) else { return (nil, Self.emptyRevision) }
        return (text, hash(data))
    }

    func save(key: String, text: String, expectedRevision: String) throws -> String {
        lock.lock(); defer { lock.unlock() }
        let file = try fileURL(forKey: key)
        let data = Data(text.utf8)
        try validate(data)
        let previous = try read(file)
        guard expectedRevision == (previous.map(hash) ?? Self.emptyRevision) else { throw error("DRAFT_CHANGED_ON_DISK") }
        if previous == data { return hash(data) }
        try atomic(data, to: file)
        return hash(data)
    }

    func remove(key: String, expectedRevision: String) throws -> String {
        lock.lock(); defer { lock.unlock() }
        let file = try fileURL(forKey: key)
        let previous = try read(file)
        guard expectedRevision == (previous.map(hash) ?? Self.emptyRevision) else { throw error("DRAFT_CHANGED_ON_DISK") }
        if previous != nil {
            try manager.removeItem(at: file)
            try syncDirectory()
        }
        return Self.emptyRevision
    }

    private func atomic(_ data: Data, to destination: URL) throws {
        let temp = directory.appendingPathComponent(".\(UUID().uuidString).tmp")
        defer { try? manager.removeItem(at: temp) }
        guard manager.createFile(atPath: temp.path, contents: nil, attributes: [.posixPermissions: 0o600]) else { throw error("DRAFT_WRITE_FAILED") }
        #if os(iOS)
        try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: temp.path)
        #endif
        let handle = try FileHandle(forWritingTo: temp)
        do { try handle.write(contentsOf: data); try handle.synchronize(); try handle.close() }
        catch { try? handle.close(); throw error }
        guard rename(temp.path, destination.path) == 0 else { throw error("DRAFT_WRITE_FAILED") }
        try syncDirectory()
    }

    private func syncDirectory() throws {
        let fd = open(directory.path, O_RDONLY)
        guard fd >= 0 else { throw error("DRAFT_DIRECTORY_SYNC_FAILED") }
        defer { close(fd) }
        guard fsync(fd) == 0 else { throw error("DRAFT_DIRECTORY_SYNC_FAILED") }
    }
}
