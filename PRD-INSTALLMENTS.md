# PRD — Installment payments: one quotation, many payments (owner-approved 2026-10-10)

Target: 2.1.0, the first store release (decided 2026-10-10; 2.0.15 stays TestFlight-only; the Mac
App Store build number 2.0.16 is already used). Branch `codex/installment-receipts` from
`codex/simplify-2.0.15` @ bbf6a38. Companion: `PRD-SIMPLIFY-2026-10.md` (unchanged), `BRAND.md`,
`.claude/skills/apple-platform-design/`.

## Practice we follow (milestone billing)

One quotation is the contract. Each installment is its own invoice, sent when due. Each payment received
gets its own receipt for exactly the installment amount, dated the day the money arrived (cash basis).
Withholding is per payment. A deposit is installment 1. Issued documents are never edited; mistakes are
voided and reissued. Receivables are per unpaid invoice. Progress is per quotation.

Not in scope, deliberately: partial payments against one invoice, running balances, netting a deposit
against a final invoice, credit notes.

## Changes

| # | Change | Where | Acceptance |
|---|---|---|---|
| 1 | A paid installment invoice can get its receipt. Replace the two guards that refuse `setStatus(…,'paid')` and `createReceipt` for `d.milestone` with "this invoice is paid in full" (the existing payment dialog's date + full-payment confirmation). The receipt amount is the installment amount. | `billing.html` `setStatus` (toast "ออกใบเสร็จได้เฉพาะยอดที่รับชำระเต็มจำนวน…"), `createReceipt`; `issuanceError` unchanged | A 3-installment project (25,000 / 15,000 / 10,000) walks to three receipts; each receipt net equals its invoice net; `paymentReview()` and WHT list show three entries. |
| 2 | Ordinary receipts print the invoice they settle. Under the title block, the way corrected receipts print `reissue-reference`: "ชำระตามใบแจ้งหนี้ INV-69-021 · งวดที่ 3/3 ของ QT-69-015" (English/bilingual via `L(th,en)`), omitting the parts that do not exist (no installment, no quotation). Frozen into `issuedSnapshot.renderedHtml` at issue time; already-issued receipts are not touched. | `renderPaper()` receipt branch | pdf-output smoke extended: the receipt PDF text contains the invoice number; `.paper` assertions in fintech-ui still pass; corrected receipts unchanged byte-for-byte (receipt-reissue smoke). |
| 3 | Unpaid installment invoices count as receivable. Dashboard "ยอดค้างรับ" and the overdue count include issued, unpaid invoices with a `milestone`, same as plain invoices. Voided/deleted excluded as today. | dashboard receivable computation (`renderDashboard` / helper) | Fixture with one unpaid installment invoice shows its net in ยอดค้างรับ; design-fixes smoke updated if it asserts the old number. |
| 4 | Quotation shows installment progress. On the quotation view, one line in the lineage area: "ตกลง ฿50,000 · รับแล้ว ฿40,000 (2/3) · ค้าง ฿10,000"; counts receipts linked to the installment invoices (`parentId` chain, voided excluded). English via `tr()`. | `renderDocView` quotation branch | Fixture above renders the line with the right figures; HIG `hig/lists-and-tables.md` (succinct), no new colours. |
| 5 | Numbers are reserved only when the save succeeds. A blocked attempt (toast + return) must not advance `DB.counters`. If the current flow reserves before validation (`assignSyncNumber` then persist), move the reservation after the validation that can fail, or roll back the counter on failure as `applyReceiptReissues` does. | number assignment in `saveDoc` / `setStatus` / `createReceipt` | Unit test: a `createReceipt` attempt that fails validation leaves `DB.counters` unchanged; sync number reservations (`syncV3`) untouched. |

Guardrails: no change to `tax_invoice` handling, review events, corrections (`receipt_reissue`), legacy review,
numbering formats, `lib/`, sync. `test/containment.test.cjs` and friends may assert the old guard — update
the assertion deliberately and say so in the report; never weaken a test that guards tax facts.
Natural Thai copy; every new string in `I18N_EN`. Follow `CLAUDE.md` verification.

## Owner check before release
Accountant confirms: a receipt per installment is the correct document for a non-VAT freelancer
receiving staged payments, and the "ชำระตามใบแจ้งหนี้ …" line on receipts is acceptable.
