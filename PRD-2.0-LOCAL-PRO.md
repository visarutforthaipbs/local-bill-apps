# Product Requirements Document (Revised)

# BillNgai 2.0 — Local-First Storage Upgrade + Pro Workspace Sync

Version: 2.0 Revised Draft (fits current codebase)
Status: Proposed — awaiting owner review
Priority: High
Target: Post–BillNgai 1.5.0
Supersedes: "BillNgai Local-First Storage Upgrade + Pro Workspace Sync" v2.0 Draft

---

## 0. What changed from the original draft (read this first)

The original draft's product strategy is kept **unchanged**: Local = ownership,
Pro = peace of mind, Studio = future. What changed is the technical core:

| Original draft | This revision | Why |
|---|---|---|
| Migrate `billing.json` → SQLite as source of truth | **Keep the JSON `DB` object; upgrade it to a sync-ready v2 schema** | The whole renderer (~2,600 lines) reads a synchronous in-memory `DB` object in hundreds of places. SQLite-as-truth means a full rewrite or a pointless "load-all-into-memory" wrapper. None of the actual deliverables (sync, conflicts, restore) require SQLite. |
| Normalized relational schema (projects, payments, document_items tables) | **Keep the current document model** (frozen item copies, computed totals via `compute()`, `parentId` lineage) | Documents are legal snapshots — freezing items on the doc is a feature, not a flaw. `projects` and `payments` tables are new *features*, deferred (see §7 Non-Goals). |
| Assets become files on disk (`assets/logo.png`) | **Keep logo/signature/stamp as dataURLs inside `DB.business`** | They already sync perfectly as part of the profile, work in browser mode, and print offline. Only new attachment types (TOR files) need a files-on-disk story — deferred. |
| Sync works everywhere | **Sync is Electron-only.** The browser build stays the free/test surface | Drive OAuth + background sync belong in the main process. Browser mode keeps FSA/localStorage as-is. |
| No document-number allocation design | **Explicit numbering strategy across devices** (§18) | This is the hardest real conflict for Thai official documents and the original draft skipped it. |
| SQLite listed as Phase 1 | **SQLite deferred indefinitely** (§27) | Revisit only when attachments, full-text search, or multi-profile actually demand it. If ever done, it is a persistence-layer swap inside `main.js` only. |

Everything else — packaging, pricing, copy, entitlement, security posture —
carries over from the original draft with light edits.

**Owner decisions (2026-07-08), applied throughout this document:**

1. **Pro is a one-time purchase (฿1,990 launch price), not a subscription.**
   Subscriptions are reserved for a possible future Studio tier. Licenses are
   offline-verifiable signed keys (`plan: pro-lifetime`) — no license server.
2. **TOR → Invoice AI moves into Pro** and is no longer a separate add-on
   purchase. The AI module (model files) still installs from its own signed
   installer, but the feature UI is Pro-gated. No grandfathering needed:
   1.5.0 was never published to the selling page, so no user has the add-on.

---

## 1. Product Context

BillNgai is a local-first Electron desktop app for quotations, invoices,
receipts, and Thai tax workflows (VAT, หัก ณ ที่จ่าย / 50 ทวิ, ภ.ง.ด. 90/94
estimates, e-Tax XML draft, PromptPay QR). Current release: **1.5.0 — TOR →
Invoice AI Add-on** (offline, signed add-on, macOS).

Current storage (all working, all kept):

* One in-memory `DB` object, persisted as `billing.json` (atomic tmp+rename write)
* `config.json` remembers an optional external file path (Drive/Dropbox folder)
* Rolling local snapshots every 30 min, 14 kept
* Manual export/import JSON
* `loadFailed` guard: if the data file exists but can't be parsed, saving is
  blocked so the app never overwrites good data with a blank DB
* Same `billing.html` also runs in a plain browser (File System Access API)

---

## 2. Core Product Decision (unchanged)

BillNgai does **not** become a cloud accounting SaaS.

> **Local First. Cloud Optional. User-Owned Storage.**

* The app works fully offline.
* Business data lives locally first.
* BillNgai servers never store invoices, clients, receipts, TORs, or tax records.
* Sync is optional and goes through the **user's own Google Drive**.

---

## 3. Product Positioning (unchanged)

> **Local is ownership. Pro is peace of mind.**

* **BillNgai Local** = ownership: buy once, data stays on your machine.
* **BillNgai Pro** = peace of mind + productivity: work everywhere, automatic
  backup, restore confidence, tax readiness.
* **BillNgai Studio** = future team workflow. Not built now.

---

## 4. Why This Matters (unchanged)

User feedback asks for two things:

1. Categorize income by Thai tax income category (มาตรา 40).
2. Work across devices without manually copying files.

This PRD delivers both without BillNgai hosting anyone's business database.

---

## 5. Real Problems With Current Storage (corrected)

The original draft listed problems that are not real at our scale (file size,
search speed, whole-file rewrite). The **actual** gaps that block sync:

* **No per-record `updatedAt`** — only `createdAt` on documents. Field-level
  merge is impossible today.
* **Deletes are destructive** (`DB.documents = DB.documents.filter(...)`).
  A deleted invoice would resurrect on sync.
* **No device identity.**
* **No change journal** — we can't tell another device *what changed*.
* **Document numbering is a shared mutable counter** (`DB.counters`,
  per-type-per-year). Two offline devices will both mint `INV-69-005`.
* **No restore UI** — snapshots exist on disk but users can't browse or
  restore them from inside the app.

External-file mode (`config.json → externalPath`) stays what it is: manual
shared-file storage, not sync. It remains supported for Local users.

---

## 6. Goals

* Upgrade the local data model to be **sync-ready** (v2 schema) with zero data
  loss and automatic migration of every existing `billing.json`.
* Keep the app fully offline; keep the browser test mode working.
* Add backup history + one-click restore UI (Local, free).
* Add income category (มาตรา 40) tagging + tax summary grouping.
* Ship optional **Google Drive Workspace Sync** for Pro (Electron only).
* Never store customer business documents on BillNgai servers.
* Package Local vs Pro clearly; existing users lose nothing.

## 7. Non-Goals

* SQLite migration (deferred — see §27)
* Payments ledger / partial payments (`payments` table) — separate future PRD
* Projects as first-class records — `doc.project` stays a string for now
* TOR/contract attachment storage & sync — future
* BillNgai cloud document storage, web app, client portal, team workspace,
  accountant portal, real-time collaboration — future/Studio only

---

## 8. Product Packaging

### 8.1 BillNgai Local

**Promise**

> ซื้อครั้งเดียว ใช้ทำเอกสารได้ตลอด ข้อมูลอยู่ในเครื่องคุณ

**Includes** (everything that exists today, plus new free items marked ★):

* Quotation / Invoice / Receipt / Tax invoice, แบ่งงวด, recurring
* Client records, business profile, logo/signature/stamp
* PDF export, print, copy-to-LINE summary
* Thai tax handling: VAT, WHT/50 ทวิ tracking, tax summary, ภ.ง.ด.90/94
  estimates, accountant CSV/ZIP, e-Tax XML draft
* PromptPay QR
* Local storage (app folder or external file in Drive/Dropbox — manual)
* Rolling automatic local snapshots
* ★ Backup history + one-click restore UI
* ★ Sync-ready v2 data model (invisible to the user)
* Manual import/export

**Does not include:** TOR → Invoice AI (moved to Pro — 1.5.0 was never
published, so no existing user loses it), multi-device sync, automatic cloud
backup, restore on a new computer via cloud, version history across devices,
conflict protection across devices, income-category tax dashboard, device
management.

**Pricing direction**

```text
Early Bird users: BillNgai Local Lifetime (already granted)
Future regular:   BillNgai Local Lifetime ฿299–499 one-time
```

Rule: Local Lifetime = lifetime access to the local app, **not** unlimited
access to every future Pro service.

### 8.2 BillNgai Pro — Work Everywhere

**Promise**

> ทำงานได้ทุกเครื่อง สำรองข้อมูลอัตโนมัติ และเตรียมภาษีง่ายขึ้น
> โดยข้อมูลยังอยู่ใน Google Drive ของคุณเอง

Users are not paying for "Google Drive sync." They are paying for: work
everywhere · automatic backup · restore confidence · tax readiness · less
document admin.

**Includes** — everything in Local, plus:

* **TOR → Invoice AI** (offline, on-device — the headline Pro feature;
  module installs from its own signed installer, free to Pro users)
* Google Drive Workspace Sync (user's own Drive; automatic background sync)
* Restore workspace on a new computer
* Connected-devices list
* Version history (snapshots browsable from the app)
* Conflict detection + protected financial fields (§17)
* Income category (มาตรา 40) tagging on documents
* Annual income summary grouped by category
* Tax preparation summary / upgraded accountant export
* Advanced AI document workflow improvements (future add-on synergy)
* Priority support during Pro beta

**Pricing direction** (one-time — no subscription; subscriptions reserved for
a future Studio tier)

```text
BillNgai Pro: ฿1,990 one-time (launch price; may rise to ฿2,490–2,990 later)
```

### 8.3 BillNgai Studio — future only (unchanged from original draft)

Multiple business profiles, team access, approval workflow, client portal.
May require BillNgai-owned infrastructure → not built until demand justifies
the operational risk.

---

## 9. User Stories (unchanged)

1. **Continue work on another device** — start an invoice on the desktop,
   finish on the laptop, no manual file copying.
2. **Own my data** — synced through my own Google Drive; BillNgai never holds
   my client database.
3. **Recover from computer loss** — install BillNgai on a new machine,
   connect Drive, restore the whole workspace.
4. **Prepare tax easier** — tag documents with an income category and get a
   year-end summary per category.
5. **Avoid dangerous overwrites** — BillNgai warns before overwriting amounts,
   payment status, VAT, or document numbers.

---

## 10. Storage Architecture

### 10.1 Current (kept)

```text
~/Library/Application Support/BillNgai/
  billing.json      ← DB object, v1
  config.json       ← externalPath
  backups/          ← rolling snapshots
  ai/               ← offline AI add-on (unchanged)
```

### 10.2 Target

```text
~/Library/Application Support/BillNgai/
  billing.json      ← DB object, v2 (sync-ready)
  config.json       ← externalPath + deviceId + sync settings
  journal/          ← local change journal (NDJSON, append-only)
  backups/          ← rolling snapshots (daily cadence, 30 kept)
  ai/               ← unchanged
```

`billing.json` stays the local source of truth. The renderer keeps its
synchronous `DB` object — **no async repository layer, no UI rewrite.**

---

## 11. Data Model v2 (replaces original §11–12 SQLite schema)

All changes go through the existing `blankDB()` + `migrate()` pattern:
new fields get safe defaults, old files upgrade automatically on load.

### 11.1 Schema additions

```text
DB.version                 1 → 2

DB.meta.deviceId           stable random id, minted once per install
DB.meta.deviceName         e.g. "MacBook Air ของวิศรุต" (editable in Settings)

clients[i]                 + updatedAt (ISO), + deletedAt (ISO | null)
documents[i]               + updatedAt, + deletedAt, + incomeCategory ('' | '40(2)' | '40(6)' | '40(8)' | …)
recurring[i]               + updatedAt, + deletedAt
DB.business                + updatedAt (profile syncs as one record)
```

### 11.2 Rules

* **Soft delete**: delete actions set `deletedAt` instead of removing the
  record. Two accessors — `activeDocs()` / `activeClients()` — replace direct
  `DB.documents` / `DB.clients` reads in list/report code so tombstones never
  render. Tombstones are purged locally after 180 days (configurable).
* **`updatedAt` stamped centrally**: mutations go through small helpers
  (`touchDoc(d)`, `touchClient(c)`), not hand-stamped at 50 call sites.
* **`uid()` gains a device prefix** (`deviceId.slice(0,4) + '-' + …`) so ids
  never collide across devices.
* Migration v1→v2 backfills `updatedAt = createdAt || now` and
  `deletedAt = null`. **No destructive transform. `billing.json` is snapshotted
  to `backups/` before the first v2 write.** If migration throws, the existing
  `loadFailed` guard blocks all saves — same behavior as today.

### 11.3 Change journal (local)

Every successful `persist()` appends events for the records that changed:

```json
{"eventId":"a1b2-000123","deviceId":"a1b2","at":"2026-07-08T14:02:11+07:00",
 "type":"document","recordId":"a1b2-lx9…","op":"upsert","record":{…full record…}}
```

* NDJSON, append-only, one file per month in `journal/` (managed by `main.js`
  via IPC — the journal is not part of `billing.json`).
* `op` ∈ `upsert | delete`. Whole-record payloads, not diffs — records are
  small, and whole-record events make replay/merge trivial and debuggable.
* Journal exists for **all** users (it costs nothing and powers restore
  tooling); only Pro uploads it.
* Change detection: compare `updatedAt` against the last journaled value per
  record id (kept in a small in-memory map), so `persist()` stays cheap.

### 11.4 Tax category metadata (replaces `tax_categories` table)

A constant in `billing.html` (like `TYPE_LABEL` / `STATUS_LABEL`), not user
data:

```text
INCOME_CATEGORIES = [
  { code:'40(1)', th:'เงินเดือน ค่าจ้าง',            defaultWht:0 },
  { code:'40(2)', th:'รับจ้างทั่วไป ฟรีแลนซ์ ค่านายหน้า', defaultWht:3 },
  { code:'40(3)', th:'ค่าลิขสิทธิ์ ค่า goodwill',       defaultWht:3 },
  { code:'40(5)', th:'ค่าเช่าทรัพย์สิน',               defaultWht:5 },
  { code:'40(6)', th:'วิชาชีพอิสระ',                  defaultWht:3 },
  { code:'40(7)', th:'รับเหมาที่ลงทุนจัดหาสัมภาระ',      defaultWht:3 },
  { code:'40(8)', th:'ธุรกิจ พาณิชย์ อื่น ๆ',           defaultWht:3 }
]
```

Every label goes through `tr()` with an `I18N_EN` entry, per the i18n
convention. The ภ.ง.ด.94 card already notes it applies to 40(5)–(8) only —
with real category data the filing page can finally show this accurately
instead of assuming everything is 40(2).

---

## 12. Backup & Restore (Local, free)

Upgrades the existing snapshot system; no format change (snapshots stay full
JSON copies — human-readable, restorable by hand in the worst case).

* Cadence: on every save, at most one snapshot per day (plus the existing
  30-minute throttle for same-day safety) · keep latest 30.
* New IPC: `backups:list` (name, date, size, doc count), `backups:restore`
  (writes a pre-restore safety snapshot first, then swaps the file and
  reloads), `backups:reveal` (exists today).
* New Settings card **"สำรองและกู้คืน"**: backup history table, กู้คืน button
  per row with a confirm dialog, สำรองตอนนี้ button.
* Restore never deletes anything: the replaced `billing.json` becomes a
  safety snapshot itself.

---

## 13. Google Drive Workspace Sync (Pro, Electron-only)

### 13.1 Cloud folder structure (user's own Drive)

```text
Google Drive/
  BillNgai/
    workspace.json            ← workspace id, schema version, device registry
    snapshots/
      snapshot-2026-07-08T14-00-00+0700.json   ← full DB (same format as local backups)
    events/
      <deviceId>/
        2026-07.ndjson        ← that device's journal, mirrored
```

No `.db` file, no proprietary format — a technical user can read every byte.

### 13.2 Auth

* OAuth 2.0 **PKCE + loopback redirect** flow in `main.js` (opens the system
  browser, catches the redirect on `127.0.0.1:<random port>`). No client
  secret ships in the app.
* Scope: `drive.file` only (BillNgai can touch only the folder it creates —
  strongest privacy story, matches our copy).
* Tokens stored via Electron `safeStorage` (Keychain-backed), never in
  `billing.json`.

### 13.3 Sync algorithm

**Push** (after `persist()`, debounced ~30 s; also manual "Sync now"):

1. Append new local journal events to `events/<deviceId>/<month>.ndjson`
   on Drive (download-merge-upload of the current month file; single-writer
   per device folder, so no contention).

**Pull** (on app start, on window focus, every ~5 min while running):

1. List `events/*/` for files newer than the last pull cursor.
2. Download new events from **other** devices, sort by `at`.
3. Apply per record: if the incoming `updatedAt` is newer and the local record
   was not modified since the last sync → apply silently. Otherwise → merge
   (§17).
4. Bump cursors, refresh UI (`render()` — re-render is already cheap).

**Snapshot**: upload a full-DB snapshot every 7 days or every 500 events,
keep the latest 10 (matches the original draft's numbers).

**New-device restore**: connect Drive → find `workspace.json` → download the
latest snapshot → write `billing.json` → replay events newer than the
snapshot → register the device in `workspace.json`.

### 13.4 Sync status UI

Sidebar file-status line (already dynamic) gains a sync state:
`ซิงก์ล่าสุด 14:02 ✓` / `กำลังซิงก์…` / `ออฟไลน์ — จะซิงก์เมื่อต่อเน็ต` /
`มีข้อขัดแย้ง 1 รายการ — กดเพื่อตรวจ`.

---

## 14–16. (merged into §13 above)

---

## 17. Conflict Resolution

### Auto-merge (last edit wins, silent)

Notes, phone, email, address, contact name, project string, client memo,
UI/display preferences.

### Protected fields (never silently overwritten)

Document number · items/amounts (anything `compute()` reads: qty, price,
vatRate, whtRate) · status/paidDate · issueDate/dueDate · currency/fxRate ·
incomeCategory · WHT-cert fields (whtCertReceived/No/Date).

If both devices changed a protected field of the same record between syncs →
conflict record, surfaced in a modal:

```text
ใบแจ้งหนี้ INV-69-012 ถูกแก้ไขบนอีกเครื่องหนึ่ง

MacBook (เครื่องนี้)         Office PC
ยอดรวม: 12,000              ยอดรวม: 10,000
สถานะ: ยังไม่ชำระ            สถานะ: ชำระแล้ว

[ใช้ของ MacBook]  [ใช้ของ Office PC]  [ดูรายละเอียด]
```

The losing version is journaled as an event too — nothing is ever
unrecoverable.

Deletes: a tombstone always wins over an edit **except** when the edit touched
a protected field after the delete — then it's a conflict.

### 17.1 Design guardrail that prevents most conflicts

Documents in this app are near-append-only by workflow (issue → send → paid →
receipt). The main realistic conflict is *status/paidDate*, which the conflict
modal handles. We deliberately do not build field-level three-way merge.

---

## 18. Document Numbering Across Devices (new — missing from original draft)

Problem: `nextNumber()` uses a shared per-type-per-year counter. Two offline
devices will both mint `INV-69-005`.

**Strategy: mint optimistically, reconcile on pull.**

1. Devices mint numbers from their local counter as today (no per-device
   prefixes — Thai official documents should keep clean sequential numbers).
2. Counters sync as max-merge: local counter = `max(local, remote)` per key.
3. On pull, if two different records claim the same number:
   * If one of them is still `draft` (never printed/sent) → it is silently
     renumbered to the next free number, with a toast:
     `เลขเอกสาร INV-69-005 ชนกับอีกเครื่อง — เปลี่ยนเป็น INV-69-006 ให้แล้ว`.
   * If **both** are sent/issued → protected-field conflict modal; the user
     decides (this is also a real-world bookkeeping problem the user must see).
4. Documents record `numberMintedBy: deviceId` for the audit trail.

---

## 19. Local Backup (superseded by §12)

Pro addition: the Drive snapshot (§13.3) doubles as an off-site backup.
Payload encryption before upload is a **future enhancement** (needs a key/
recovery-phrase UX decision); at launch, privacy relies on the user's own
Drive account — stated honestly in the UI.

---

## 20. Security Requirements

**BillNgai servers must never store:** client records, invoices, receipts,
TORs, business profiles, tax records, sync snapshots, sync events.

**App:**

* OAuth tokens in OS keychain (`safeStorage`); `drive.file` scope only.
* Nothing uploads without explicit opt-in (connecting Drive **is** the opt-in,
  stated plainly on the connect screen).
* Clear sync status at all times; one-click disconnect; instructions to delete
  the Drive folder (it's the user's own Drive — they can also just delete it).
* Journal and snapshots contain business data → they live only on the user's
  disk and the user's Drive.

---

## 21. Pro License Server (unchanged scope, minimal)

Stores only: account email, license status, payment status, device count,
subscription period. Never any business data. Simplest viable form: signed
license key + periodic re-validation with a long offline grace period —
**Pro must keep working offline**; only *activation* needs the network.

---

## 22. UI / UX Requirements

New Settings card **"พื้นที่ทำงาน (Workspace)"**:

```text
ที่เก็บข้อมูล:
● เครื่องนี้เท่านั้น                    ← default (Local)
○ ซิงก์ผ่าน Google Drive ของคุณ (Pro)   ← shows upgrade screen if not Pro
```

Local users see: สำรองตอนนี้ · ประวัติสำรอง/กู้คืน · ส่งออก/นำเข้า ·
เปิดโฟลเดอร์ข้อมูล (mostly existing buttons, regrouped).

Pro users additionally see: เชื่อมต่อ Google Drive · ซิงก์เดี๋ยวนี้ ·
ซิงก์ล่าสุด · เครื่องที่เชื่อมต่อ (rename/remove) · กู้คืนจากคลาวด์ ·
ดูข้อขัดแย้ง · ยกเลิกการเชื่อมต่อ.

Document editor gains one field (Pro): **ประเภทเงินได้ (มาตรา 40)** — a
select, defaulting from the client or business setting; picking a category
suggests its default WHT rate.

All new strings: Thai first, wrapped in `tr()`, added to `I18N_EN`
(existing i18n convention; never name a helper `t`).

---

## 23. User-Facing Copy (unchanged)

Never say: SQLite, sync events, journal, change-log replication, BYOC.

Say:

```text
ทำงานต่อได้ทุกเครื่อง
สำรองข้อมูลอัตโนมัติ
กู้คืนเมื่อเปลี่ยนคอม
ข้อมูลอยู่ใน Google Drive ของคุณ
BillNgai ไม่เก็บเอกสารลูกค้าบนเซิร์ฟเวอร์เรา
```

## 24. Landing Page Copy (unchanged from original draft)

```text
BillNgai Local
ออกใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จได้ในเครื่องคุณ
ซื้อครั้งเดียว ใช้ได้ตลอด · ข้อมูลไม่ออกจากเครื่อง

BillNgai Pro — Work Everywhere
เริ่มทำใบเสนอราคาที่คอมออฟฟิศ กลับบ้านมาเปิดต่อที่โน้ตบุ๊ก
ข้อมูลตรงกันอัตโนมัติผ่าน Google Drive ของคุณเอง
BillNgai ไม่เก็บเอกสารลูกค้าบนเซิร์ฟเวอร์เรา
```

---

## 25. Feature Entitlement Matrix

| Feature | Local | Pro |
|---|---|---|
| All document types, แบ่งงวด, recurring, PromptPay QR | ✓ | ✓ |
| Thai tax handling, 50 ทวิ, ภ.ง.ด.90/94 estimates | ✓ | ✓ |
| Accountant CSV/ZIP, e-Tax XML draft | ✓ | ✓ |
| PDF export / print / LINE summary | ✓ | ✓ |
| Local + external-file storage (manual) | ✓ | ✓ |
| Automatic local snapshots | ✓ | ✓ |
| **Backup history + restore UI** | ✓ ★new | ✓ |
| **TOR → Invoice AI (offline)** | — | ✓ |
| Google Drive Workspace Sync | — | ✓ |
| Restore on new computer (cloud) | — | ✓ |
| Version history / connected devices | — | ✓ |
| Conflict protection (financial fields) | — | ✓ |
| Income category (มาตรา 40) + annual summary by category | — | ✓ |
| Tax preparation summary / upgraded accountant export | — | ✓ |
| Priority support (beta) | — | ✓ |

Gate placement note: the v2 data model, journal, and soft deletes ship to
**everyone** (they're invisible infrastructure). Only the Drive connection,
device management, category field, and category reports are gated.

---

## 26. Current User / Early Bird Policy (unchanged)

* Existing *published* features never move behind the Pro gate.
  (TOR → Invoice AI is the one exception by owner decision — 1.5.0 was never
  published to the selling page, so no user ever had it.)
* Existing data migrates automatically and keeps opening.
* Early Bird = Local Lifetime, included.
* Suggested offer: Early Bird users get a Pro one-time discount (e.g. 50% off ฿1,990).

---

## 27. Implementation Phases (revised)

### Phase A — Sync-ready data model v2 *(replaces "Phase 1 SQLite")*

* `DB.version 2`, `deviceId`, `updatedAt`/`deletedAt`, central touch helpers
* Soft-delete accessors (`activeDocs()`/`activeClients()`) across all reads
* Device-prefixed `uid()`
* Local change journal via `main.js` IPC (NDJSON, monthly files)
* Migration v1→v2 + pre-migration safety snapshot + rollback behavior
* Verify in both Electron and browser modes (journal is no-op in browser)

**Exit criteria:** existing `billing.json` files load, upgrade, and round-trip
with zero data loss; deletes are tombstones; every mutation lands in the journal.

### Phase B — Backup history & restore UI *(ships free, builds trust before sync)*

* `backups:list` / `backups:restore` IPC, daily cadence, keep 30
* Settings card with history table + restore confirm + pre-restore snapshot

### Phase C — Income category (มาตรา 40) *(moved up from original Phase 5 — cheapest, most-requested)*

* `incomeCategory` on documents (+ per-client default), editor select,
  WHT-rate suggestion
* Tax summary + filing page grouping by category; ภ.ง.ด.94 shows only
  40(5)–(8) income; accountant CSV gains a category column
* Built behind the Pro flag but implemented offline-first

### Phase D — Google Drive Workspace Sync (Pro beta)

* OAuth PKCE loopback in `main.js`, `drive.file` scope, `safeStorage` tokens
* Workspace folder creation, event push/pull, cursors, snapshot cycle
* New-device restore flow
* Conflict detection + modal; numbering reconciliation (§18)
* Sync status in sidebar; Workspace settings card (Pro side)

### Phase E — Pro packaging

* License check (offline-tolerant), feature gates, upgrade screen,
  Early Bird discount handling, Pro onboarding

### Phase F *(explicitly deferred)* — SQLite, payments ledger, projects,
attachments, payload encryption, Studio.

---

## 28. Acceptance Criteria

* Every existing `billing.json` (v1) migrates automatically with zero loss;
  a pre-migration backup exists; a failed migration leaves the original file
  untouched and blocks saves (existing `loadFailed` behavior).
* App works fully offline in every tier, including Pro after activation.
* Browser test mode still works end-to-end.
* Local users can browse backup history and restore in ≤ 3 clicks.
* Pro: two devices converge after concurrent edits; protected fields never
  merge silently; duplicate document numbers are impossible after sync
  completes (§18).
* A new device restores a full workspace from Drive (snapshot + events).
* No BillNgai server ever receives business data (verifiable: the only
  endpoints the app talks to are Google's and the license server).
* Existing users lose nothing; the Pro gate only wraps new capabilities.

---

## 29. Risks (revised)

| Risk | Mitigation |
|---|---|
| Migration failure | Pre-migration snapshot; never delete `billing.json`; `loadFailed` save-block already exists; v1 reader kept forever |
| Soft-delete misses a read site | Single accessor pair + a grep checklist for `DB.documents`/`DB.clients` direct reads during review; browser-mode test script asserts tombstones never render |
| Drive API/OAuth complexity confuses users | Plain-language UI, one "connect" button, visible sync status, restore guide; `drive.file` scope keeps the consent screen small |
| Users think Pro = BillNgai stores their data | Repeat "ข้อมูลอยู่ใน Google Drive ของคุณ / เราไม่เก็บเอกสารลูกค้า" on connect screen, landing page, and receipts |
| Sync conflicts corrupt financial data | Whole-record events, protected-field list, conflict modal, losing versions journaled, numbering reconciliation |
| Duplicate official document numbers | §18 strategy; issued-vs-issued collisions always surface to the user |
| Pro feels like paying for Drive | Package as Work Everywhere / Backup / Restore / Tax readiness — never as "Drive integration" |
| Journal grows unbounded | Monthly files, snapshot supersedes old events, local purge after snapshot retention window |
| Native-module / build risk | None introduced: no SQLite, no new runtime dependencies; the universal DMG + notarization work is unaffected |

---

## 30. Final Product Strategy (unchanged)

```text
BillNgai Local   = Ownership
BillNgai Pro     = Peace of mind + productivity
BillNgai Studio  = Future team workflow
```

BillNgai does not compete with cloud accounting platforms by becoming one.
It wins by being **the local-first business document app for Thai
freelancers** — making local-first feel as convenient as cloud software while
the user keeps control of their data.

---

## Appendix A — Open decisions for the owner

1. **Numbering (§18)** — approve "mint optimistically, reconcile on pull,
   drafts auto-renumber, issued-vs-issued asks the user"? (Recommended.)
2. **Pull cadence** — start/focus/5-min polling is proposed; Drive push
   notifications are not available to desktop apps without a server, so
   polling is the honest option.
3. **Income category gating** — PRD gates it as Pro. Alternative: the *field*
   is free, the *category reports* are Pro. (Softer, maybe better goodwill.)
4. ~~Pro Lifetime — offer at all?~~ **Decided: Pro IS one-time (฿1,990 launch).
   No subscription; subscriptions reserved for future Studio.**
5. **Encryption of Drive payloads** — launch without (stated honestly) and add
   a recovery-key version later, or block Pro launch on it?
