# Changelog

All notable changes to บิลง่าย / BillNgai (formerly Billiong) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [2.0.4] — 2026-09-24 (Mac Direct)

### Fixed
- Replace unsupported native void/payment prompts with validated in-app dialogs; retain evidence and roll back failed saves.
- Keep draft markings in printed output; block every legacy tax-invoice output path, including drafts.
- Drain renderer transactions and native disk writes on quit and window close; reject malformed imports and unsafe inline-handler interpolation.
- Preserve referenced customer tombstones and a permanent, verified pre-2.0.4 source backup.
- Await settings, client and recurring saves; fix quotation decline, void/overdue state, month-end recurrence and planned-versus-issued split totals.
- Freeze reporting identity, retain unknown currency/date/ambiguous-payment exclusions, and avoid collapsing supported distinct payments or asserting uncertain historical totals.

### Added
- Read-only historical facts, separate reversible archive visibility, append-only review notes and locally hash-verified original evidence.
- Separate evidence bundle backup/restore; database JSON does not contain attachment bytes.
- Evidence-based full-payment review for supported non-VAT THB legacy invoices without rewriting originals, with separate idempotent new ordinary-receipt issuance.
- Focused regression suites and `PRD-2.0.4.md`, `VERIFICATION-2.0.4.md`, `SESSION-HANDOFF-2.0.4.md`.

### Restrictions
- No automated tax-invoice correction, invented historical snapshot, VAT/FX/partial-payment recovery, cloud sync, e-Tax export or tax-payable calculation. This is not professional tax/legal certification.
- Signed/notarized Mac Direct installer released; 165 automated tests and both exact packaged native suites pass. See `RELEASE-2.0.4.md` for artifact/publication evidence. Installed customer apps are not automatically replaced; Windows/MAS and broader manual/practitioner review remain separate.

## [2.0.3] — 2026-09-24 (Mac Direct)

### Safety scope
- Default to non-VAT, require explicit status/payment/withholding confirmation for ordinary THB full-payment receipts, and block new tax invoices pending validation of the complete registered-seller workflow.
- Preserve issued document snapshots, retain voided/deleted financial records, and flag uncertain legacy documents rather than reconstructing historical facts.
- Make receipt creation idempotent, duplicates drafts, and reports payment-aware; replace unsupported PIT payable/refund estimates with limited bookkeeping summaries.
- Make income classification available without Pro and stop inferring withholding from currency or income category.
- Pause cloud sync/restore and custom e-Tax XML export in both UI and relevant IPC boundaries. Local backup/export remains available. This is temporary containment, not a completed sync/e-Tax implementation.
- Add synthetic regression tests. Released for Direct macOS only; Windows and MAS remain pending. Owner-directed AI-assisted review replaces the proposed external-practitioner prerequisite for this release (see `PRD-2.0.3.md`); it is not professional approval or legal certification. Source 81/81, exact signed/notarized package and public-download checks passed; see `RELEASE-2.0.3.md`.

### Fixed
- Preserve recorded 50-tawi certificate receipt status, number and date when creating a receipt from a paid invoice, so payment-deduplicated tracking and CSV do not lose that evidence. Add an invoice-to-receipt regression test.

## [2.0.2] — 2026-09-22

### Changed
- Upgrade the direct-download runtime from Electron 31 to pinned Electron 43.7.3 and the packager to electron-builder 26.15.3. This update requires macOS 12 Monterey or later (Intel and Apple Silicon).
- Replace the development runtime blocked by macOS; do not disable Gatekeeper or remove quarantine to run it. The warning's underlying cause has not been established.

### Fixed
- Correct the packaged Google OAuth configuration and stop packaging if the source or embedded Desktop client JSON is missing or malformed.
- เวลาในประวัติสำรองข้อมูลแสดงตามเขตเวลาของเครื่อง รวมไฟล์สำรองเก่า และระบุว่าเป็นเวลาเครื่อง
- หากไฟล์ที่เลือกใน Drive/Dropbox ยังไม่พร้อม อ่านไม่ได้ ว่าง หรือผิดรูปแบบ แอปหยุดบันทึกและซิงก์แทนการเริ่มฐานข้อมูลว่าง
- ป้องกันการเขียนทับเมื่อไฟล์หรือตำแหน่งข้อมูลเปลี่ยนหลังเปิดแอป; เก็บข้อมูลเดิมก่อนบันทึก/กู้คืน/ย้ายที่เก็บ
- เรียงคิวการบันทึก ใช้ไฟล์ชั่วคราวแยกกัน และป้องกันการเปิดแอปซ้ำหลายโปรเซส; ไฟล์ตั้งค่าเสียไม่ถูกเขียนทับด้วยค่าเริ่มต้น
- รักษาช่วงสำรองอัตโนมัติ 30 นาทีข้ามการเปิดแอปใหม่ และไม่แจ้งว่าบันทึกสำเร็จเมื่อบันทึกล้มเหลว

## [2.0.1] — 2026-07-10

### Fixed
- **เลขที่เอกสารไม่รีเซ็ตเมื่อสลับ พ.ศ./ค.ศ.**: counter เคยใช้ปีตาม `yearMode` เป็น key
  (เช่น `invoice-2568` ↔ `invoice-2025`) — สลับโหมดปีกลางปีแล้วเลขเริ่มนับ 1 ใหม่
  ทำให้เลขเอกสารซ้ำได้ ตอนนี้ key เป็นปี ค.ศ. ตามปฏิทินเสมอ พร้อม migration
  ย้าย counter เดิมที่เป็นปี พ.ศ. ให้อัตโนมัติ (max-merge กันเลขถอยหลัง)
- **CSV เอกสารทั้งหมด**: คอลัมน์สกุลเงินแสดงสกุลเงินของเอกสารแต่ละใบ
  (เดิมพิมพ์สกุลเงินหลักของธุรกิจทับทุกแถว — เอกสาร USD ถูกป้ายเป็น THB)
- **เอกสารที่ลูกค้าถูกลบถาวรไปแล้วเปิดดูได้**: เดิม tombstone ลูกค้าที่ถูกล้างหลัง 180 วัน
  (หรือ hard delete จากเครื่องอื่น) ทำให้หน้าเอกสาร/บันทึกใบกำกับภาษี/ออกใบเสร็จ crash
- **macOS: เมนู ไฟล์ ไม่ crash หลังปิดหน้าต่าง**: กด Export/Import/Print จากเมนู
  ตอนไม่มีหน้าต่างแล้วเกิด "Object has been destroyed" — ตอนนี้เช็ค `isDestroyed()` ก่อน
- **ลากไฟล์ TOR มาวางใช้ `webUtils.getPathForFile`**: `File.path` ถูกถอดใน Electron 32+
  — กันฟีเจอร์เงียบหายตอนอัปเกรด Electron ในอนาคต
- **รูปแบบเลขที่เอกสารที่ไม่มี `#`**: เดิมทุกใบได้เลขเดียวกัน — ตอนนี้ต่อเลขลำดับให้เสมอ
- ปีภาษีคิดจากวันที่แบบ local time เสมอ (เดิมบางจุด parse เป็น UTC), `tax-summary` CSV
  ใช้ CRLF เหมือนไฟล์อื่น, เลขที่เอกสาร escape HTML ก่อนแสดงในตาราง/หัวโมดัล

## [2.0.0] — 2026-07-08

BillNgai 2.0 แบ่งเป็นสองแพ็กเกจ: **Local** (ซื้อครั้งเดียว ข้อมูลอยู่ในเครื่องคุณ) และ
**Pro** (จ่ายครั้งเดียว — AI, ซิงก์หลายเครื่อง, เตรียมภาษี) ตาม `PRD-2.0-LOCAL-PRO.md`
BillNgai ไม่เก็บเอกสารลูกค้าบนเซิร์ฟเวอร์ใด ๆ — ทุกอย่างอยู่ในเครื่อง/Google Drive ของผู้ใช้เอง

### Added — ทุกแพ็กเกจ (Local)
- **สคีมาข้อมูล v2 (sync-ready)**: ทุก record มี `updatedAt`/`deletedAt`, id มี device
  prefix, การลบเป็น tombstone (กันข้อมูลฟื้นคืนตอนซิงก์), change journal แบบ NDJSON
  รายเดือนใน `journal/` — ไฟล์ v1 อัปเกรดอัตโนมัติ พร้อมสำเนา `billing-pre-v2-*.json`
  ก่อนเขียนทับเสมอ
- **สำรองและกู้คืนในแอป**: การ์ดใหม่ในตั้งค่า — ประวัติไฟล์สำรอง (วันที่/ที่มา/จำนวน
  เอกสาร/ขนาด), สำรองตอนนี้, กู้คืนคลิกเดียว (สำรองข้อมูลปัจจุบันให้ก่อนกู้เสมอ);
  เก็บสแนปช็อตอัตโนมัติเพิ่มเป็น 30 ชุด; ไฟล์มีป้ายกำกับไม่ถูกลบวน
- **PDF พอดีหน้าเดียว (shrink-to-fit)**: เอกสารที่ยาวเกิน A4 นิดเดียวถูกย่อทั้งใบให้พอดี
  หน้า (ต่ำสุด 70% — ยาวจริงยังขึ้นหน้า 2 ปกติ) ครอบทั้งพิมพ์/Cmd+P/บันทึก PDF;
  คอลัมน์จำนวนไม่ตัดบรรทัดแล้ว
- **ตั้งค่าแบ่ง 4 แท็บ**: ธุรกิจของฉัน · เอกสารและภาษี · ข้อมูลและสำรอง · พื้นที่ทำงาน —
  สลับแท็บบันทึกค่าให้อัตโนมัติ; หน้า 50 ทวิ ปรับตามแบรนด์ (ปุ่มบันทึกรับใบเด่นขึ้น
  ในแถวที่ยังรอใบ)

### Added — BillNgai Pro (จ่ายครั้งเดียว ฿1,990 ราคาเปิดตัว)
- **Google Drive Workspace Sync**: ทำงานต่อได้ทุกเครื่องผ่าน Drive ของผู้ใช้เอง —
  OAuth แบบ PKCE (สิทธิ์ `drive.file` เห็นเฉพาะไฟล์ที่แอปสร้าง), token เก็บใน Keychain,
  ซิงก์อัตโนมัติ (หลังบันทึก/โฟกัสหน้าต่าง/ทุก 5 นาที/ตอนเปิด-ปิดแอป) พร้อม flush
  ก่อนปิดแอป, สแนปช็อตเต็มทุก 7 วัน, กู้คืนทั้ง workspace บนเครื่องใหม่
- **ปกป้องข้อมูลการเงินตอนซิงก์ชนกัน**: เลขเอกสาร/ยอด/สถานะ/วันที่/ภาษี ไม่ถูกทับเงียบ ๆ —
  มีหน้าต่างให้เลือกเวอร์ชัน; เลขเอกสารชนข้ามเครื่อง ใบร่างถูกตั้งเลขใหม่อัตโนมัติ;
  โปรไฟล์ธุรกิจเปล่าห้ามทับโปรไฟล์จริง
- **ประเภทเงินได้ (มาตรา 40)**: ติดป้ายเอกสาร/ค่าเริ่มต้นรายลูกค้า พร้อมแนะนำอัตรา
  หัก ณ ที่จ่าย, สรุปรายรับตามประเภทในหน้าสรุปภาษี, ภ.ง.ด.94 นับเฉพาะ 40(5)–(8),
  คอลัมน์ใหม่ในชุดส่งออกให้บัญชี
- **TOR → Invoice ย้ายมาอยู่ใน Pro** (1.5.0 ยังไม่เคยเผยแพร่ — ไม่มีผู้ใช้เดิมเสียฟีเจอร์)
  โมดูล AI ยังติดตั้งจากตัวติดตั้งแยกเหมือนเดิม ฟรีสำหรับผู้ใช้ Pro
- **รหัส Pro ตรวจออฟไลน์** (Ed25519) — เปิดใช้ครั้งเดียว ไม่มี activation ออนไลน์
  ไม่มีเซิร์ฟเวอร์ license; หน้าจอเปรียบเทียบแพ็กเกจ + ช่องวางรหัสในแอป

### Notes
- เอกสารกลยุทธ์/การส่งมอบ: `PRD-2.0-LOCAL-PRO.md`, `DELIVERY.md`
- Sync ต้องใช้ build ที่ฝัง Google OAuth client (`secrets/gdrive-oauth.json` — git-ignored,
  แพ็กเข้า DMG ตอน build) และ OAuth consent screen ต้อง Publish ก่อนขายจริง
- สร้างรหัส Pro: `npm run pro:license -- --email <อีเมลลูกค้า>`

## [1.5.0] — 2026-07-05

### Added
- **TOR → Invoice (AI Add-on, macOS)** — โมดูลเสริมแบบออฟไลน์ 100%:
  นำเข้า TOR (PDF/DOCX/TXT หรือวางข้อความ) แล้ว AI ในเครื่องร่างใบเสนอราคาให้
  เป็นขั้นตอน 1-2-3 (นำเข้า → AI ร่าง → ตรวจทานและสร้าง) พร้อมตาราง
  รายการ+ราคา งวดตาม TOR และคำถามที่ควรถามลูกค้าเพิ่ม — กดเดียวเปิด
  ตัวแก้ไขเอกสารที่กรอกให้แล้ว (ลูกค้า/รายการ/หมายเหตุ) โดยไม่บันทึกจนกว่า
  ผู้ใช้จะกดบันทึกเอง
- โมดูล AI ติดตั้งจากตัวติดตั้งแยก (.pkg) — แอปตรวจลายเซ็น Ed25519 และ
  แฮชทุกไฟล์ก่อนเปิดใช้ ไม่มีการดาวน์โหลดในแอป ไม่มี activation ออนไลน์
  ข้อมูล TOR และบิลไม่ออกจากเครื่อง (ติดตั้งก่อนหรือหลังแอปก็ได้)

### Notes
- โมเดลในโมดูล: **Typhoon2-3B-Instruct** (SCB 10X, พัฒนาบน Llama 3.2 — Built with
  Llama) — โมเดลสัญชาติไทยที่เชี่ยวชาญภาษาไทยและอนุญาตใช้เชิงพาณิชย์
  (เปลี่ยนจาก Qwen2.5-3B ระหว่างพัฒนา ซึ่งมีสัญญาอนุญาตแบบวิจัยเท่านั้น)
- โมดูล AI รองรับเฉพาะ macOS ในเวอร์ชันนี้ — ผู้ใช้ Windows ใช้แอปหลักได้ปกติ
- คีย์เซ็นโมดูลเปลี่ยนเป็นคีย์ production ใหม่ — โมดูลที่เซ็นด้วยคีย์ dev เดิม
  จะขึ้นว่าตรวจสอบไม่ผ่าน ให้ติดตั้งแพ็กเกจที่ build ใหม่

## [1.4.0] — 2026-07-04

### Added
- **BillNgai brand identity across the app** — orange primary (default `#FF6B00`,
  still user-overridable per business), warm cream background, charcoal text, new
  circular logo (`logo.svg`) and regenerated app icon. Users still on the old default
  green are migrated to the new orange automatically; custom brand colors are kept.
- **Brand fonts bundled offline**: Inter (Latin/numerals) + LINE Seed Sans TH (Thai),
  weights 400/600/700, replacing IBM Plex Sans Thai + Fraunces.
- **Brand guardian docs**: `BRAND.md` (single source of truth for tokens, color rules,
  typography, voice) and `AGENTS.md` (AI/dev rules) — UI work must follow them.
- App-ready BillNgai brand asset library under `assets/brand`, generated from the master
  guideline package with reproducible logo, UI icon, object, character, pattern, and sheet
  exports (dev library; only the images the app uses ship in the DMG).

### Changed
- Refreshed the full app UI around the master brand system: warm paper background,
  flatter white panels, thin peach borders, restrained shadows, tighter radii, and
  orange-only primary emphasis.
- Redesigned `ยื่นภาษี (ภ.ง.ด. 90/94)` into guided filing cards with clearer period
  summaries, branded empty states, and a quieter assumptions note.
- Cleaned up dashboard and empty-state styling so illustration panels feel consistent
  with the new BillNgai visual language.

### Fixed
- Adjusted brand asset crops for laptop, folder, envelope, and empty-state illustrations.
- Removed empty-state text overlap and the recurring visual stripe/eyebrow treatment that
  conflicted with the master brand style.
- Replaced the old green success toast and connected-file indicator with the BillNgai
  orange/charcoal feedback treatment.
- Restyled status badges into compact one-line token-based chips that fit the BillNgai UI.
- Brand-orange text on light backgrounds now uses a darker `--accent-ink` tone
  (#FF6B00 on white is only 2.9:1 contrast and fades on B/W printing) — document titles,
  totals, tax stamp, links and amounts stay legible; the document header keeps its
  2px brand accent rule. Fills (buttons, table heads) stay full brand orange.
- Packaging safety: `npm run dist` no longer regenerates brand assets implicitly
  (`npm run assets` is a manual dev step that now refuses to run — deleting nothing —
  when the master asset package or ImageMagick is missing), and the DMG ships only
  the brand images the app actually uses instead of the full 15 MB library.

## [1.3.0] — 2026-07-04

### Added
- **แบ่งงวด (milestone billing)** — split an accepted quotation into N installment
  invoices per the TOR payment schedule: per-งวด label, % or amount (last งวด
  auto-balances so the total always matches), optional due dates, preset splits
  (50/50, 30/40/30, equal parts). All งวด are created upfront as drafts with
  sequential numbers, linked to the quotation.
- **Installment progress on the quotation** — billed/paid/remaining bar and totals,
  derived live from the linked invoices and their receipts.
- งวด invoices are tagged "งวดที่ i/N" in the documents list and document trail;
  line-item text follows the document language (ไทย / bilingual / English).

### Fixed
- A quotation could be converted to an invoice repeatedly; the convert (and split)
  buttons now hide once invoice children exist and return if they are deleted.

## [1.2.0] — 2026-07-04

### Added
- **ผู้ช่วยยื่นภาษี ภ.ง.ด. 90/94** — new ยื่นภาษี view splits the year's realized income into
  the two official filing periods (ภ.ง.ด.94: ม.ค.–มิ.ย., due 30 ก.ย. · ภ.ง.ด.90: full year,
  due 31 มี.ค. of the next year) and shows the numbers a freelancer needs when filing:
  assessable income (with THB equivalents for foreign-currency docs), withholding-tax credit,
  and an estimated tax owed from the progressive brackets (standard 50%/100k expense
  deduction + personal allowance, with assumptions and a clear "not tax advice" disclaimer).
- **Deadline reminders** — dashboard banner when a filing deadline is within 60 days
  ("อีก 45 วันถึงกำหนดยื่น ภ.ง.ด.94"), shown only when the period actually has income.
- **Export for accountant (ส่งออกชุดให้บัญชี)** — one button (สรุปภาษี and ยื่นภาษี views)
  bundles the selected tax year into a single ZIP: year summary with total VAT collected,
  the per-document tax-summary CSV, the 50 ทวิ withholding-certificate list, and the client
  list with tax IDs. Built-in ZIP writer — still zero runtime dependencies.

### Changed
- **Rebrand: Billiong → บิลง่าย / BillNgai.** New name is pronounceable in both languages and
  says what the app does — easy billing. The billing and tax app built for Thai freelancers —
  not a global SaaS translated into Thai; your data stays on your machine.
- App data moves to the new `BillNgai` folder automatically on first launch (one-time copy —
  the old `Billiong` folder is left untouched, so downgrading is always safe). External
  data files (Drive/Dropbox) keep working unchanged.

## [1.1.0] — 2026-07-02

### Added
- **App UI language (ภาษาแอป)** — switch the entire app interface between ไทย and English
  (ตั้งค่า → รูปแบบการแสดงผล). Fully independent from document language.
- **Per-client document language** — each client can be set to ไทย / ไทย+อังกฤษ / English;
  their quotations, invoices and receipts render in that language automatically.
- **English-only documents** — English labels, English month names with Christian-era year,
  English business name/address, and amount-in-words in English
  ("Forty-eight thousand one hundred fifty baht only").
- **Per-document language override** — one-off language choice in the document editor,
  carried through the quotation → invoice → receipt chain.
- **International payment details** — Bank name (English), SWIFT/BIC, Account name (English)
  and Bank address fields; shown as a wire-transfer block on English or foreign-currency
  invoices (replacing the PromptPay/Thai bank block).
- **English payment terms and English business address** fields, with Thai fallbacks.
- **FX rate per foreign-currency document** — tax summary now shows foreign income as a
  THB equivalent, flags documents missing a rate, and the year-end CSV gains
  FX-rate / THB-equivalent columns.
- Copy-to-chat summary text now follows the client's language.

### Notes
- ใบกำกับภาษี (tax invoices) never render English-only — they fall back to ไทย+อังกฤษ,
  as they are Revenue Department documents.
- Data files from 1.0.0 load unchanged; all new fields default to previous behaviour.

## [1.0.0] — 2026-07-02

Initial release.

- Quotation / invoice / receipt / tax-invoice lifecycle with document numbering (พ.ศ./ค.ศ.)
- Thai tax handling: VAT, withholding tax (หัก ณ ที่จ่าย) with 50 ทวิ certificate tracking
- Clients, recurring invoice templates, dashboard, year-end tax summary
- PromptPay QR on invoices, print/PDF export, CSV exports, e-Tax Invoice XML draft
- Local-first storage (in-app or external billing.json) with automatic snapshots
- Brand color theming, logo/signature/stamp, first-run setup wizard
