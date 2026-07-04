# Changelog

All notable changes to บิลง่าย / BillNgai (formerly Billiong) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
