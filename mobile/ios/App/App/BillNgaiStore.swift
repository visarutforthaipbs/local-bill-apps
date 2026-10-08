import Foundation
import CryptoKit
import Darwin
import SQLite3
import JavaScriptCore

// SQLite commits the complete workspace and revision together. JSON remains portable backup evidence.
final class BillNgaiStore {
    private let directory: URL
    private let lock = NSRecursiveLock()
    private let manager = FileManager.default
    private var file: URL { directory.appendingPathComponent("billing.sqlite") }
    private var marker: URL { directory.appendingPathComponent("initialized") }
    private var backupDirectory: URL { directory.appendingPathComponent("backups", isDirectory: true) }
    private var legacy: URL { directory.appendingPathComponent("billing.json") }
    private var recoveryMarker: URL {directory.appendingPathComponent("restore-in-progress")}
    private var sqliteMarker: URL { directory.appendingPathComponent("sqlite-initialized") }
    private var safetyFile: URL {directory.appendingPathComponent("sqlite-safety.json")}
    private let validator: JSContext
    init(directory: URL, validationScript: String? = nil) throws {
        self.directory = directory
        guard let context = JSContext(), let script = validationScript ?? Bundle.main.url(forResource: "billing-data", withExtension: "js", subdirectory: "public/lib").flatMap({ try? String(contentsOf: $0, encoding: .utf8) }) else { throw NSError(domain: "BillNgaiStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "DATA_VALIDATOR_UNAVAILABLE"]) }
        validator = context
        context.evaluateScript(script)
        context.evaluateScript("function validateWorkspace(text){try{BillingData.validate(JSON.parse(text),{strictLiveDocuments:true});return '';}catch(e){return e.message||'DATA_INVALID_SCHEMA';}}")
        guard context.exception == nil, context.objectForKeyedSubscript("validateWorkspace")?.isObject == true else { throw NSError(domain: "BillNgaiStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "DATA_VALIDATOR_UNAVAILABLE"]) }
        try manager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try manager.createDirectory(at: backupDirectory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    }
    private func error(_ code: String) -> NSError { NSError(domain: "BillNgaiStore", code: 1, userInfo: [NSLocalizedDescriptionKey: code]) }
    private func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    private func execute(_ db: OpaquePointer, _ sql: String, _ values: [String?] = []) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw error("DATA_INVALID_DATABASE") }
        defer { sqlite3_finalize(statement) }
        for (index,value) in values.enumerated() {
            if let value { sqlite3_bind_text(statement, Int32(index+1), value, -1, transient) }
            else { sqlite3_bind_null(statement, Int32(index+1)) }
        }
        guard sqlite3_step(statement) == SQLITE_DONE else { throw error("DATA_WRITE_FAILED") }
    }
    private func row(_ db: OpaquePointer, _ sql: String) throws -> [String: String] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw error("DATA_INVALID_DATABASE") }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else { throw error("DATA_MISSING") }
        var result: [String:String] = [:]
        for index in 0..<sqlite3_column_count(statement) {
            if let value = sqlite3_column_text(statement,index) { result[String(cString:sqlite3_column_name(statement,index))] = String(cString:value) }
        }
        guard sqlite3_step(statement) == SQLITE_DONE else { throw error("DATA_INVALID_DATABASE") }
        return result
    }
    private func withDatabase<T>(_ action: (OpaquePointer) throws -> T) throws -> T {
        guard manager.fileExists(atPath:file.path) else { throw error("DATA_MISSING") }
        let info = try file.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey])
        guard info.isRegularFile == true, info.isSymbolicLink != true else { throw error("DATA_INVALID_FILE") }
        var handle: OpaquePointer?
        guard sqlite3_open_v2(file.path,&handle,SQLITE_OPEN_READWRITE|SQLITE_OPEN_FULLMUTEX,nil) == SQLITE_OK, let handle else { if let handle {sqlite3_close(handle)};throw error("DATA_INVALID_DATABASE") }
        defer { sqlite3_close(handle) }
        sqlite3_busy_timeout(handle,5000)
        let version = try row(handle,"PRAGMA user_version")["user_version"]
        if let version, (Int(version) ?? -1) > 1 { throw error("DATA_FUTURE_VERSION") }
        guard version == "1",try row(handle,"PRAGMA integrity_check")["integrity_check"] == "ok" else { throw error("DATA_INVALID_DATABASE") }
        try execute(handle,"PRAGMA synchronous=FULL")
        return try action(handle)
    }
    private func stored(_ db: OpaquePointer) throws -> Data? {
        let result = try row(db,"SELECT * FROM workspace WHERE id=1")
        if let source = result["origin_sha256"] {
            guard manager.fileExists(atPath:legacy.path), hash(try Data(contentsOf:legacy)) == source else { throw error("DATA_LEGACY_FILE_CHANGED") }
        }
        guard let text = result["payload"] else { guard result["revision"] == "empty",result["initialized"] == "0",result["origin_sha256"] == nil else { throw error("DATA_MISSING") };return nil }
        let data = Data(text.utf8)
        guard result["initialized"] == "1",result["revision"] == hash(data) else { throw error("DATA_INVALID_DATABASE") }
        _ = try validate(data);return data
    }
    private func initializeSQLite() throws {
        if manager.fileExists(atPath:sqliteMarker.path) { throw error("DATA_MISSING") }
        let source: Data?
        if manager.fileExists(atPath:legacy.path) {
            let attrs = try legacy.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey])
            guard attrs.isRegularFile == true, attrs.isSymbolicLink != true else { throw error("DATA_INVALID_FILE") }
            source = try Data(contentsOf:legacy);_ = try validate(source!)
            try atomic(source!,to:backupDirectory.appendingPathComponent("before-sqlite-migration-\(UUID().uuidString).json"))
        } else { if manager.fileExists(atPath:marker.path) { throw error("DATA_MISSING") };source = nil }
        let fd = open(file.path,O_WRONLY|O_CREAT|O_EXCL,0o600)
        guard fd >= 0 else { throw error("DATA_CHANGED_ON_DISK") };close(fd)
        #if os(iOS)
        try manager.setAttributes([.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication],ofItemAtPath:file.path)
        #endif
        var handle: OpaquePointer?
        guard sqlite3_open_v2(file.path,&handle,SQLITE_OPEN_READWRITE|SQLITE_OPEN_FULLMUTEX,nil) == SQLITE_OK,let handle else { throw error("DATA_INVALID_DATABASE") }
        defer { sqlite3_close(handle) }
        try execute(handle,"PRAGMA synchronous=FULL");try execute(handle,"BEGIN IMMEDIATE")
        do {
            try execute(handle,"CREATE TABLE workspace(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT,revision TEXT NOT NULL,initialized INTEGER NOT NULL CHECK(initialized IN(0,1)),origin_sha256 TEXT)")
            try execute(handle,"INSERT INTO workspace VALUES(1,?,?,?,?)",[source.flatMap { String(data:$0,encoding:.utf8) },source.map(hash) ?? "empty",source == nil ? "0":"1",source.map(hash)])
            try execute(handle,"PRAGMA user_version=1");try execute(handle,"COMMIT")
        } catch {try? execute(handle,"ROLLBACK");throw error}
        try safety(bound:source.flatMap {try? validate($0)["syncV3"]}.map {$0 is NSNull ? false:true} ?? false,origin:source.map(hash))
        try atomic(Data("1".utf8),to:sqliteMarker)
    }
    private func read() throws -> Data? {
        if manager.fileExists(atPath:recoveryMarker.path) {throw error("DATA_RECOVERY_REQUIRED")}
        if !manager.fileExists(atPath:file.path) {try initializeSQLite()}
        return try withDatabase {try stored($0)}
    }
    func load() throws -> (text: String?, revision: String) {
        lock.lock(); defer { lock.unlock() }
        guard let data = try read(), let text = String(data: data, encoding: .utf8) else { return (nil, "empty") }
        if !manager.fileExists(atPath: marker.path) { try atomic(Data("1".utf8), to: marker) }
        return (text, hash(data))
    }
    func save(text: String, expectedRevision: String, allowSync: Bool = false, adoptWorkspace: Bool = false) throws -> String {
        lock.lock(); defer { lock.unlock() }
        let data = Data(text.utf8), next = try validate(data)
        if let sync = next["syncV3"], !(sync is NSNull) {
            guard allowSync, let state = sync as? [String: Any], state["version"] as? Int == 3,
                  let account = state["account"] as? String, account.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil,
                  let cursor = state["cursor"] as? NSNumber, CFGetTypeID(cursor) != CFBooleanGetTypeID(), cursor.doubleValue >= 0, cursor.doubleValue.rounded() == cursor.doubleValue,
                  ["joining", "initializing", "active"].contains(state["mode"] as? String ?? ""),
                  let root = state["root"] as? String, root.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil,
                  ["records", "heads", "conflicts"].allSatisfy({ state[$0] is [String: Any] }) else { throw error("SYNC_STATE_INVALID") }
        }
        _ = try read() // Initialize only through the checked migration path.
        return try withDatabase { handle in
            try execute(handle,"BEGIN IMMEDIATE")
            do {
                let previous = try stored(handle)
                guard expectedRevision == (previous.map(hash) ?? "empty") else { throw error("DATA_CHANGED_ON_DISK") }
                if let previous {
                    let old = try validate(previous)
                    if adoptWorkspace {
                        // Explicit replacement commits the empty joining state and its
                        // binding together, after backing up all previous issued facts.
                        let state = next["syncV3"] as? [String: Any]
                        guard allowSync, old["syncV3"] == nil || old["syncV3"] is NSNull,
                              state?["mode"] as? String == "joining", state?["cursor"] as? Int == 0,
                              ["records", "heads", "conflicts"].allSatisfy({ (state?[$0] as? [String: Any])?.isEmpty == true }),
                              state?["intents"] == nil || (state?["intents"] as? [String: Any])?.isEmpty == true,
                              state?["pending"] == nil || state?["pending"] is NSNull,
                              ["clients", "documents", "recurring", "reviewEvents"].allSatisfy({ (next[$0] as? [Any])?.isEmpty == true }),
                              (next["counters"] as? [String: Any])?.isEmpty == true,
                              (next["meta"] as? [String: Any])?["protocolUpgradeApproved"] as? Bool == true
                        else { throw error("SYNC_ADOPTION_INVALID") }
                    } else { try validateTransition(old, next) }
                    if previous == data { try execute(handle,"COMMIT");return hash(data) }
                    try atomic(previous,to:backupDirectory.appendingPathComponent("before-save-\(UUID().uuidString).json"))
                } else if adoptWorkspace { throw error("SYNC_ADOPTION_INVALID") }
                let origin=try row(handle,"SELECT origin_sha256 FROM workspace WHERE id=1")["origin_sha256"]
                let bound=next["syncV3"].map {!($0 is NSNull)} ?? false
                if bound {try safety(bound:true,origin:origin)}
                try execute(handle,"UPDATE workspace SET payload=?,revision=?,initialized=1 WHERE id=1",[text,hash(data)])
                try execute(handle,"COMMIT");if !bound {try safety(bound:false,origin:origin)};return hash(data)
            } catch {try? execute(handle,"ROLLBACK");throw error}
        }
    }
    private func safety(bound: Bool,origin: String?) throws {
        var value: [String:Any] = ["syncBound":bound];if let origin {value["origin_sha256"]=origin}
        try atomic(try JSONSerialization.data(withJSONObject:value),to:safetyFile)
    }
    func recover(text: String) throws -> String {
        lock.lock();defer {lock.unlock()}
        let data=Data(text.utf8);var selected=try validate(data)
        selected.removeValue(forKey:"syncV3")
        if var meta=selected["meta"] as? [String:Any] {meta.removeValue(forKey:"protocolUpgradeApproved");selected["meta"]=meta}
        let restored=try JSONSerialization.data(withJSONObject:selected,options:[.sortedKeys]),restoredText=String(data:restored,encoding:.utf8)!
        let suffix=UUID().uuidString
        var originalFiles: [URL:Data] = [:]
        for name in ["billing.sqlite","billing.sqlite-journal","billing.sqlite-wal","billing.sqlite-shm"] {
            let source=directory.appendingPathComponent(name)
            if manager.fileExists(atPath:source.path) {
                let attrs=try source.resourceValues(forKeys:[.isRegularFileKey,.isSymbolicLinkKey])
                guard attrs.isRegularFile == true,attrs.isSymbolicLink != true else {throw error("DATA_INVALID_FILE")}
                let bytes=try Data(contentsOf:source);originalFiles[source]=bytes
                try atomic(bytes,to:backupDirectory.appendingPathComponent("pre-restore-\(suffix)-\(name)"))
            }
        }
        var previous: Data?
        do {previous=manager.fileExists(atPath:file.path) ? try withDatabase {try stored($0)}:try read()} catch let failure as NSError {
            if failure.localizedDescription == "DATA_FUTURE_VERSION" || failure.localizedDescription == "DATA_INVALID_FILE" {throw failure}
        }
        let guardData=(try? Data(contentsOf:safetyFile)).flatMap {try? JSONSerialization.jsonObject(with:$0) as? [String:Any]}
        if let previous {if let sync=try validate(previous)["syncV3"],!(sync is NSNull) {throw error("SYNC_DISCONNECT_REQUIRED")}}
        else {guard guardData?["syncBound"] as? Bool == false else {throw error("SYNC_RECOVERY_BINDING_UNKNOWN")}}
        let before=manager.fileExists(atPath:file.path) ? try Data(contentsOf:file):nil
        let stage=directory.appendingPathComponent("\(suffix).restore")
        defer {try? manager.removeItem(at:stage)}
        if let previous {try atomic(previous,to:backupDirectory.appendingPathComponent("pre-restore-\(suffix).json"))}
        var origin: String?
        if guardData?["origin_sha256"] != nil {
            guard manager.fileExists(atPath:legacy.path) else {throw error("DATA_LEGACY_FILE_CHANGED")}
            let retained=try Data(contentsOf:legacy);origin=hash(retained)
            try atomic(retained,to:backupDirectory.appendingPathComponent("pre-restore-legacy-\(suffix).json"))
        }
        var handle: OpaquePointer?
        guard sqlite3_open_v2(stage.path,&handle,SQLITE_OPEN_READWRITE|SQLITE_OPEN_CREATE,nil) == SQLITE_OK,let handle else {throw error("DATA_WRITE_FAILED")}
        do {
            try manager.setAttributes([.posixPermissions:0o600],ofItemAtPath:stage.path)
            #if os(iOS)
            try manager.setAttributes([.protectionKey:FileProtectionType.completeUntilFirstUserAuthentication],ofItemAtPath:stage.path)
            #endif
            try execute(handle,"PRAGMA synchronous=FULL");try execute(handle,"BEGIN IMMEDIATE")
            try execute(handle,"CREATE TABLE workspace(id INTEGER PRIMARY KEY CHECK(id=1),payload TEXT,revision TEXT NOT NULL,initialized INTEGER NOT NULL CHECK(initialized IN(0,1)),origin_sha256 TEXT)")
            try execute(handle,"INSERT INTO workspace VALUES(1,?,?,1,?)",[restoredText,hash(restored),origin])
            try execute(handle,"PRAGMA user_version=1");try execute(handle,"COMMIT")
            guard try stored(handle) == restored else {throw error("DATA_RECOVERY_VERIFY_FAILED")}
        } catch {sqlite3_close(handle);throw error}
        sqlite3_close(handle)
        let current=manager.fileExists(atPath:file.path) ? try Data(contentsOf:file):nil
        guard current == before else {throw error("DATA_CHANGED_ON_DISK")}
        var swapped=false
        do {
            try atomic(Data(suffix.utf8),to:recoveryMarker)
            for name in ["billing.sqlite-journal","billing.sqlite-wal","billing.sqlite-shm"] {
                let source=directory.appendingPathComponent(name)
                if manager.fileExists(atPath:source.path) {try manager.moveItem(at:source,to:directory.appendingPathComponent("\(name).quarantine-\(suffix)"))}
            }
            guard rename(stage.path,file.path)==0 else {throw error("DATA_WRITE_FAILED")};swapped=true
            try safety(bound:false,origin:origin);try atomic(Data("1".utf8),to:sqliteMarker)
            try manager.removeItem(at:recoveryMarker)
        } catch {
            if !swapped {
                for (source,bytes) in originalFiles {try atomic(bytes,to:source)}
                if manager.fileExists(atPath:recoveryMarker.path) {try manager.removeItem(at:recoveryMarker)}
            }
            throw error
        }
        return hash(restored)
    }
    private func validate(_ data: Data) throws -> [String: Any] {
        guard data.count <= 64*1024*1024,let text = String(data:data,encoding:.utf8),let db = try JSONSerialization.jsonObject(with:data) as? [String:Any] else {throw error("DATA_INVALID_SCHEMA")}
        validator.exception = nil
        let result = validator.objectForKeyedSubscript("validateWorkspace")?.call(withArguments:[text])?.toString()
        guard validator.exception == nil,let result else {throw error("DATA_VALIDATOR_UNAVAILABLE")}
        if !result.isEmpty {throw error(result)}
        return db
    }
    private func equal(_ a: [String: Any], _ b: [String: Any]) -> Bool { NSDictionary(dictionary: a).isEqual(to: b) }
    private func validateTransition(_ old: [String: Any], _ next: [String: Any]) throws {
        let frozen = ["id", "type", "number", "clientId", "issueDate", "dueDate", "currency", "fxRate", "vatRate", "whtRate", "items", "notes", "project", "docLang", "parentId", "reissueOf", "reissueOfNumber", "reissueOfDate", "issuedSnapshot"]
        for field in ["documents", "clients", "recurring", "reviewEvents"] {
            let oldRows = old[field] as? [[String: Any]] ?? [], newRows = next[field] as? [[String: Any]] ?? []
            let byID = Dictionary(uniqueKeysWithValues: newRows.map { ($0["id"] as! String, $0) })
            for row in oldRows {
                guard let updated = byID[row["id"] as! String] else { throw error("DATA_USE_TOMBSTONE") }
                if field == "reviewEvents", !equal(row, updated) { throw error("DATA_REVIEW_EVENT_IMMUTABLE") }
                if field == "documents", row["type"] != nil, row["status"] as? String != "draft" {
                    let a = row.filter { frozen.contains($0.key) }, b = updated.filter { frozen.contains($0.key) }
                    guard updated["status"] as? String != "draft", equal(a, b) else { throw error("DATA_ISSUED_FACTS_IMMUTABLE") }
                    for key in ["paymentId", "paidDate"] {
                        if let value = row[key], !(value is NSNull), !equal([key: value], updated.filter { $0.key == key }) { throw error("DATA_PAYMENT_FACTS_IMMUTABLE") }
                    }
                }
            }
        }
    }
    func deviceID() throws -> String {
        lock.lock(); defer { lock.unlock() }
        let url = directory.appendingPathComponent("device-id")
        if manager.fileExists(atPath: url.path) {
            let id = try String(contentsOf: url, encoding: .utf8)
            guard id.range(of: "^[a-f0-9]{8}$", options: .regularExpression) != nil else { throw error("DATA_INVALID_DEVICE") }
            return id
        }
        let id = String(UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased().prefix(8))
        try atomic(Data(id.utf8), to: url)
        return id
    }
    func snapshot(label: String) throws -> String? {
        lock.lock(); defer { lock.unlock() }
        guard label.range(of: "^[A-Za-z0-9_-]{1,64}$", options: .regularExpression) != nil else { throw error("DATA_INVALID_BACKUP_LABEL") }
        guard let data = try read() else { return nil }
        let name = "\(Int(Date().timeIntervalSince1970 * 1000))-\(label)-\(UUID().uuidString).json"
        try atomic(data, to: backupDirectory.appendingPathComponent(name))
        return name
    }
    func backups() throws -> [[String: Any]] {
        lock.lock(); defer { lock.unlock() }
        return try manager.contentsOfDirectory(at: backupDirectory, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey, .isSymbolicLinkKey])
            .filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent > $1.lastPathComponent }.compactMap { url in
                let attrs = try url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey, .isSymbolicLinkKey])
                guard attrs.isRegularFile == true, attrs.isSymbolicLink != true else { return nil }
                return ["name": url.lastPathComponent, "bytes": attrs.fileSize ?? 0, "at": ISO8601DateFormatter().string(from: attrs.contentModificationDate ?? Date.distantPast)]
            }
    }
    func backupText(name: String) throws -> String {
        lock.lock(); defer { lock.unlock() }
        guard !name.contains("/"), !name.contains("\\"), try backups().contains(where: { $0["name"] as? String == name }) else { throw error("DATA_INVALID_BACKUP_NAME") }
        let data = try Data(contentsOf: backupDirectory.appendingPathComponent(name)); _ = try validate(data)
        return String(data: data, encoding: .utf8)!
    }
    private func atomic(_ data: Data, to destination: URL) throws {
        let temp = destination.deletingLastPathComponent().appendingPathComponent(".\(UUID().uuidString).tmp")
        defer { try? manager.removeItem(at: temp) }
        guard manager.createFile(atPath: temp.path, contents: nil, attributes: [.posixPermissions: 0o600]) else { throw error("DATA_WRITE_FAILED") }
        #if os(iOS)
        try manager.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: temp.path)
        #endif
        let handle = try FileHandle(forWritingTo: temp)
        do { try handle.write(contentsOf: data); try handle.synchronize(); try handle.close() }
        catch { try? handle.close(); throw error }
        guard rename(temp.path, destination.path) == 0 else { throw error("DATA_WRITE_FAILED") }
        let fd = open(destination.deletingLastPathComponent().path, O_RDONLY)
        guard fd >= 0 else { throw error("DATA_DIRECTORY_SYNC_FAILED") }
        defer { close(fd) }
        guard fsync(fd) == 0 else { throw error("DATA_DIRECTORY_SYNC_FAILED") }
    }
}
