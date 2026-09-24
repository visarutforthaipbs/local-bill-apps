# Bulk historical document review — local candidate

**Superseding installation work:** owner subsequently authorized replacing the
private installed app. The source is committed as
`8da524f7a33d17d3bff516adb27cc245ac91154b`, with provisional dashboard and explicit
payment-pair review added (182 tests pass). See `INSTALL-2.0.6.md` for actual
packaging/installation evidence: private signed/notarized 2.0.6 is now installed
and verified on lighthouse-control (2026-09-25), old app and current profile
preserved. Earlier implementation-only notes below are
historical; no public publication or live payment/document confirmation is implied.

Owner request (2026-09-24): build a bulk review-and-correct screen; owner confirms
they were not VAT-registered when the historical documents were issued. Owner
subsequently answered that they are unsure whether the documents were sent;
keep delivery unknown. This is implementation authority, not
permission to rewrite live records, issue replacements, or publish a release.

## Boundaries

The Revenue Code section 86/13 addresses entitlement to issue tax invoices:
https://www.rd.go.th/5208.html . Zero VAT is not proof of entitlement.
The RD replacement guidance https://www.rd.go.th/fileadmin/user_upload/vat/VAT19.pdf
addresses registered issuers. Do not apply it as automatic approval to replace a
non-registered issuer's historical documents or choose replacement dates/numbers.

## Deliverable

- Dedicated Thai/English screen from Documents and historical document views.
- Select multiple retained tax-invoice records; inspect each original and latest
  review. Record delivery as unknown / not sent / sent, with an explicit historical
  non-VAT confirmation and review note. No defaults claiming that documents were
  unsent or independently verified. No owner-specific facts hardcoded into app.
- Preview an ordinary-receipt **correction proposal**, not an issued receipt.
  Preserve source fields and references; do not reconstruct historical buyer or
  issuer from today's profile. No assigned new legal number/date, no automatic
  cancellation, printing, sending, payment IDs, or income changes.
- Deleted/voided, nonzero or unknown VAT, invalid amounts/currency, conflicts and
  unsupported split payments cannot generate a bulk proposal. They remain visible
  for notes and individual professional review.
- Sent/unknown delivery stays prominently flagged for practitioner/recipient review.
  Even not-sent app records may already be marked issued; never rewrite them.
- Append-only review events with full retained source and proposal metadata;
  backup before one atomic batch save, rollback on failure, repeated preparation
  does not generate duplicate proposals; revalidate source at confirmation time.
- Export the correction review packet locally as JSON (not a receipt or tax filing).
  No external transmission. Original inspection and all output restrictions remain.

## Acceptance

Synthetic regression tests for eligibility, malformed imports, stale previews,
double submission, failed backup/save rollback, original preservation, escaping,
language coverage and reporting invariance. Isolated Electron UI test for selection,
preview, confirm, reload and packet export contract. Never use the customer profile
for test mutations. Implementation does not settle historical legal validity.

## Pending beyond this screen

Practitioner-approved issuance/correction procedure for documents already delivered;
payment reconciliation and dashboard provisional-versus-confirmed presentation;
signed candidate packaging and any authorized installation/public release.

## Implementation and verification — 2026-09-24

Implemented as the **unreleased 2.0.6 source candidate**, on the existing local
`codex/local-recovery-2.0.5` branch (directory name still BillNgai-publish-2.0.3).
Changes are intentionally uncommitted pending owner-directed release work.
Installed app remains the verified private 2.0.5, public download remains 2.0.4.

Entry: Documents → `ตรวจและเตรียมแก้เอกสารเดิม`, also from historical tax-document
views. Choose records, historical non-VAT confirmation, delivery and note; preview
then confirm. Proposal records are stored only in reviewEvents, not documents.
Review-only JSON export contains the retained source and later assertions, without
invented historical parties or a new legal number/date. No official receipt PDF,
issue/send action, automatic cancellation or payment reconciliation is introduced.
Not-sent is an explicit user assertion, not inferred from the old app's issued flag.
Current issuer VAT settings are not silently changed by historical confirmation.

Source checks: **178/178 tests passed**, main/inline syntax valid, whitespace clean,
625 literal translation keys checked with none missing. New tests cover eligibility,
unknown delivery, backup failures, false/rejected saves, stale sources before/during
backup, repeated/concurrent actions, post-save render failure, native/renderer schema
parity, malformed imported proposals, escaped content and unchanged reporting.

Isolated Electron bulk smoke passed selection/exclusion, preview/cancel, backed-up
save, original preservation, non-issued proposal, TH/EN, reload and export packet.
Synthetic artifacts: temporary `billngai-bulk-review-eoJPUz`; earlier Thai screenshot
in `billngai-bulk-review-0SJRAm` visually inspected for readability/layout.
Existing native stabilization smoke also passed, `billngai-204-native-isZUFj`.
No tests use the actual working profile as a write destination.

Read-only final check: live billing.json still SHA256
`7ebcdb5fe1ce8d62709853be212c33af85301051cacb158c931b0dc12f498f66`, matching the
completed September 23 restore. No customer corrections, app replacement, Git push,
tag, R2 upload, website deployment or release performed in this implementation.
