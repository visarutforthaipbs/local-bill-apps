import Foundation
import SQLite3

@main struct StoreTests {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("BillNgai-store-test-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        var passed = 0
        func check(_ condition: Bool, _ label: String) { precondition(condition, label); passed += 1 }
        func rejects(_ label: String, _ work: () throws -> Void) { do { try work(); preconditionFailure(label) } catch { passed += 1 } }
        func encoded(_ db: [String: Any]) throws -> String { String(data: try JSONSerialization.data(withJSONObject: db, options: [.sortedKeys]), encoding: .utf8)! }
        let document: [String: Any] = ["id": "doc1", "type": "invoice", "status": "draft", "items": [["description": "Synthetic service", "qty": 1, "price": 1000]], "vatRate": 0, "whtRate": 3]
        var db: [String: Any] = ["version": 2, "business": ["businessName": "Synthetic issuer"], "clients": [["id": "client1", "name": "Synthetic client"]], "documents": [document], "recurring": [], "reviewEvents": [], "counters": [:], "meta": ["setupDone": true], "syncV3": NSNull(), "futureField": ["keep": "ภาษาไทย"]]
        let validation = try String(contentsOfFile:CommandLine.arguments[1],encoding:.utf8)
        let store = try BillNgaiStore(directory: root,validationScript:validation)
        let empty = try store.load(); check(empty.text == nil && empty.revision == "empty", "empty")
        let initial = try encoded(db), revision = try store.save(text: initial, expectedRevision: "empty")
        let reload = try BillNgaiStore(directory: root,validationScript:validation).load(); check(reload.text == initial && reload.revision == revision, "exact bytes and unknown fields")
        rejects("stale") { _ = try store.save(text: initial, expectedRevision: "stale") }
        rejects("invalid JSON") { _ = try store.save(text: "{}", expectedRevision: revision) }
        for unsupported in [2.5, 999, -2] {
            var invalid = db; invalid["version"] = unsupported
            rejects("unsupported schema version") { _ = try store.save(text: encoded(invalid), expectedRevision: revision) }
        }
        var booleanVersion = db; booleanVersion["version"] = true
        rejects("boolean schema version") { _ = try store.save(text: encoded(booleanVersion), expectedRevision: revision) }
        check(try store.load().text == initial, "invalid preserves data")
        let id = try store.deviceID(), restoredID = try BillNgaiStore(directory: root,validationScript:validation).deviceID(); check(id.count == 8 && id == restoredID, "device identity")
        var final = document; final["status"] = "sent"; final["number"] = "INV-69-001"; final["issuedSnapshot"] = ["original": true]
        db["documents"] = [final]
        let finalText = try encoded(db), issuedRevision = try store.save(text: finalText, expectedRevision: revision)
        let backups = try store.backups(), oldBackup = try store.backupText(name: backups[0]["name"] as! String); check(backups.count == 1 && oldBackup == initial, "backup before replacing")
        rejects("traversal") { _ = try store.backupText(name: "../billing.json") }
        rejects("unsafe label") { _ = try store.snapshot(label: "../escape") }
        var edited = db; var altered = final; altered["items"] = [["description": "Changed", "qty": 1, "price": 2000]]; edited["documents"] = [altered]
        rejects("issued contents") { _ = try store.save(text: encoded(edited), expectedRevision: issuedRevision) }
        altered = final; altered["status"] = "draft"; edited["documents"] = [altered]
        rejects("issued to draft") { _ = try store.save(text: encoded(edited), expectedRevision: issuedRevision) }
        edited = db; edited["documents"] = []
        rejects("hard delete") { _ = try store.save(text: encoded(edited), expectedRevision: issuedRevision) }
        var paid = final; paid["status"] = "paid"; paid["paymentId"] = "payment1"; paid["paidDate"] = "2026-10-03"
        db["documents"] = [paid]; db["reviewEvents"] = [["id": "event1", "type": "synthetic_event", "documentId":"doc1", "recordedAt":"2026-10-03T00:00:00.000Z", "note": "Retained"]]
        let paidText = try encoded(db), paidRevision = try store.save(text: paidText, expectedRevision: issuedRevision)
        altered = paid; altered.removeValue(forKey: "paidDate"); edited = db; edited["documents"] = [altered]
        rejects("payment clearing") { _ = try store.save(text: encoded(edited), expectedRevision: paidRevision) }
        edited = db; edited["reviewEvents"] = [["id": "event1", "type": "synthetic_event", "documentId":"doc1", "recordedAt":"2026-10-03T00:00:00.000Z", "note": "Changed"]]
        rejects("event edit") { _ = try store.save(text: encoded(edited), expectedRevision: paidRevision) }
        edited = db; edited["reviewEvents"] = []
        rejects("event removal") { _ = try store.save(text: encoded(edited), expectedRevision: paidRevision) }
        edited = db; edited["syncV3"] = ["version": 3, "account": "synthetic"]
        rejects("cloud binding") { _ = try store.save(text: encoded(edited), expectedRevision: paidRevision) }
        db["clients"] = [["id": "client1", "name": "Synthetic client", "deletedAt": "2026-10-03T00:00:00.000Z"]]
        let tombstoneRevision = try store.save(text: encoded(db), expectedRevision: paidRevision)
        check(tombstoneRevision != paidRevision, "explicit tombstone")
        let file = root.appendingPathComponent("billing.sqlite")
        try Data(paidText.utf8).write(to: file)
        rejects("external writer") { _ = try store.save(text: encoded(db), expectedRevision: tombstoneRevision) }
        try Data("invalid json".utf8).write(to: file)
        rejects("corrupt load") { _ = try store.load() }
        rejects("corrupt save") { _ = try store.save(text: initial, expectedRevision: "empty") }
        try FileManager.default.removeItem(at: file)
        rejects("missing initialized load") { _ = try store.load() }
        rejects("missing initialized save") { _ = try store.save(text: initial, expectedRevision: "empty") }
        _ = try store.recover(text:initial)
        check(try store.load().text != nil,"explicit recovery after missing database")
        let migrationRoot=root.appendingPathComponent("migration")
        try FileManager.default.createDirectory(at:migrationRoot,withIntermediateDirectories:true)
        let legacy=migrationRoot.appendingPathComponent("billing.json")
        try Data(initial.utf8).write(to:legacy)
        let migration=try BillNgaiStore(directory:migrationRoot,validationScript:validation)
        check(try migration.load().text == initial,"exact legacy migration")
        check(try Data(contentsOf:legacy) == Data(initial.utf8),"retained JSON unchanged")
        check(try migration.backups().contains(where:{($0["name"] as? String)?.contains("before-sqlite-migration") == true}),"migration backup")
        try Data(paidText.utf8).write(to:legacy)
        rejects("legacy writer changed") {_ = try migration.save(text:initial,expectedRevision:revision)}
        let sqlite=migrationRoot.appendingPathComponent("billing.sqlite")
        try FileManager.default.removeItem(at:sqlite)
        _ = try migration.recover(text:initial)
        check(try migration.load().text != nil,"missing recovery establishes reviewed origin")
        try Data(initial.utf8).write(to:legacy)
        rejects("legacy writer after recovery") {_ = try migration.load()}
        try Data(paidText.utf8).write(to:legacy)
        try Data("Synthetic damage".utf8).write(to:sqlite)
        _ = try migration.recover(text:initial)
        check(try migration.load().text != nil,"corrupt recovery")
        let backupItems=try FileManager.default.contentsOfDirectory(atPath:migrationRoot.appendingPathComponent("backups").path)
        check(backupItems.contains(where:{$0.hasSuffix("billing.sqlite")}),"damaged bytes preserved")
        var bad=db;bad["version"]=999
        let originalSQLite=try Data(contentsOf:sqlite)
        rejects("future recovery") {_ = try migration.recover(text:encoded(bad))}
        check(try Data(contentsOf:sqlite)==originalSQLite,"failed restore unchanged")
        var nullDeleted=document;nullDeleted["deletedAt"]=NSNull();nullDeleted["items"]=[["description":"Invalid","qty":"bad","price":1000]]
        bad=db;bad["documents"]=[nullDeleted]
        rejects("null deletedAt cannot bypass validation") {_ = try migration.recover(text:encoded(bad))}
        var handle: OpaquePointer?
        precondition(sqlite3_open(sqlite.path,&handle)==SQLITE_OK)
        precondition(sqlite3_exec(handle,"PRAGMA user_version=99",nil,nil,nil)==SQLITE_OK);sqlite3_close(handle)
        let futureBytes=try Data(contentsOf:sqlite)
        rejects("future SQL recovery") {_ = try migration.recover(text:initial)}
        check(try Data(contentsOf:sqlite)==futureBytes,"future SQL unchanged")
        precondition(sqlite3_open(sqlite.path,&handle)==SQLITE_OK)
        precondition(sqlite3_exec(handle,"PRAGMA user_version=1",nil,nil,nil)==SQLITE_OK);sqlite3_close(handle)
        let backupsPath=migrationRoot.appendingPathComponent("backups")
        try FileManager.default.moveItem(at:backupsPath,to:migrationRoot.appendingPathComponent("held-backups"))
        try Data("Blocked backup directory".utf8).write(to:backupsPath)
        let beforeFailure=try Data(contentsOf:sqlite)
        rejects("backup failure aborts restore") {_ = try migration.recover(text:initial)}
        check(try Data(contentsOf:sqlite)==beforeFailure,"failed backup unchanged")
        for deletion in [nil,NSNull()] as [Any?] {
            for changes in [["status":"not-a-status"],["items":[["description":"Invalid","qty":1,"price":-1]]],["items":NSNull()],["items":[["description":"Invalid","qty":NSNull(),"price":1]]]] as [[String:Any]] {
                var invalid=document;invalid["deletedAt"]=deletion;for (key,value) in changes {invalid[key]=value};bad=db;bad["documents"]=[invalid]
                rejects("strict absent/null deletion validation") {_ = try migration.recover(text:encoded(bad))}
            }
        }
        let adoptionRoot=root.appendingPathComponent("adoption")
        let adoption=try BillNgaiStore(directory:adoptionRoot,validationScript:validation)
        let oldRevision=try adoption.save(text:paidText,expectedRevision:"empty")
        var join=db;join["clients"]=[];join["documents"]=[];join["recurring"]=[];join["reviewEvents"]=[];join["counters"]=[String:Any]()
        join["meta"]=["setupDone":true,"protocolUpgradeApproved":true]
        join["syncV3"]=["version":3,"account":"synthetic","root":"rootFolder","mode":"joining","cursor":0,"records":[String:Any](),"heads":[String:Any](),"conflicts":[String:Any](),"pending":NSNull()]
        let joiningText=try encoded(join)
        rejects("ordinary save cannot delete issued facts") {_ = try adoption.save(text:joiningText,expectedRevision:oldRevision,allowSync:true)}
        rejects("stale adoption does not replace local data") {_ = try adoption.save(text:joiningText,expectedRevision:"stale",allowSync:true,adoptWorkspace:true)}
        check(try adoption.load().text==paidText,"failed adoption original intact")
        let joinedRevision=try adoption.save(text:joiningText,expectedRevision:oldRevision,allowSync:true,adoptWorkspace:true)
        check(try adoption.load().text==joiningText,"replacement and joining binding committed together")
        let preserved=try adoption.backups().first!
        check(try adoption.backupText(name:preserved["name"] as! String)==paidText,"all original issued facts backed up")
        rejects("bound adoption refuses another replacement") {_ = try adoption.save(text:joiningText,expectedRevision:joinedRevision,allowSync:true,adoptWorkspace:true)}
        let interrupted=root.appendingPathComponent("restore-in-progress")
        try Data("Synthetic interrupted restore".utf8).write(to:interrupted)
        rejects("interrupted recovery blocks normal load") {_ = try store.load()}
        _ = try store.recover(text:initial)
        check(!FileManager.default.fileExists(atPath:interrupted.path),"explicit recovery clears barrier")
        print("Passed \(passed) native store assertions using synthetic files.")
    }
}
