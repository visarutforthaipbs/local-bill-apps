# Changelog

All notable changes to Billiong are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
