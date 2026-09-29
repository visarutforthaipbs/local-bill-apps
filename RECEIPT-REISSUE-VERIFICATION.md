# Corrected historical receipts — 2026-09-29

Implemented in the current unreleased 2.0.8 source. The installed application and public release were not rebuilt or changed.

The owner requested ordinary receipts for all retained historical tax invoices, then approved the ten draft party/payment snapshots. The source app issued ten corrections in the live local profile after its mandatory `before-receipt-reissue` backup. Six deleted records were excluded. No documents were sent to customers.

## Model and safeguards

- Corrections are frozen `receipt_reissue` review events, not new ledger documents or payments. Original records and previous review events remain unchanged.
- Each correction references its original number/date, retains recorded payment date, items and withholding, and receives a unique number from the ordinary receipt sequence. Current party details were explicitly reviewed and approved.
- Deleted, voided, conflicting, VAT-bearing and incomplete records cannot be issued through this workflow. Archived installment receipts remain eligible.
- Exact source/party checks run before and after backup; failed saves restore in-memory events/counters. Duplicate/retry issuance is rejected. Both schema validators verify frozen facts; ordinary saves cannot remove or edit issued correction events.
- Original historical tax-invoice output remains blocked. Corrected ordinary receipt views support printing/PDF and reference the original record.
- Screen-only responsive padding no longer affects printed A4 pages.

## Validation

- 203 unit tests pass, including eight correction tests covering preservation, eligibility, confirmations, backup/save failures, concurrent drift, number collisions, forged events and immutable storage.
- Native synthetic Electron smoke passes preview/confirmation/cancel, issuance, backup, persistence/reload, original/income preservation, duplicate prevention and PDF export.
- Disposable real-data copy passes all ten corrections and exact report/CSV preservation before live approval.
- Authorized live issuance: ten frozen events appended; original 79 document entries and 17 review events preserved. All report and CSV results compare exactly before/after; reload validates all ten events.
- Final PDFs: RC-69-005 through RC-69-014; each has the ordinary receipt title, no draft marker or tax stamp, and its original reference. All ten are one A4 page.
- Release configuration, JS syntax and whitespace checks pass. No release, signing, installation or publication performed.

## Private evidence

Customer data and output remain outside Git and MiMo packets:
`~/.local/state/billngai-private-reissues/2026-09-29-nktpdba6/`
contains capture hashes, approved draft batch, live issued event copies, checks, export hashes and rendered verification.
Final receipts and index are in `~/Documents/BillNgai-Corrected-Receipts-2026-09-29/`.

MiMo completed the design review; its code-review attempt exceeded the turn limit and the retry timed out. Codex reviewed and implemented locally, with manager dispositions recorded in the private worker task folders.

Use the current source app for corrected-receipt access until a separately authorized build/install updates the installed 2.0.8 application.
