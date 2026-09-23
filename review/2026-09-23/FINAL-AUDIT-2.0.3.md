# 2.0.3 final release audit — 2026-09-23

## Authority and conclusion

The owner explicitly requested completion and release, then instructed Codex to
perform the audit after being told an external practitioner had not reviewed it.
This is an owner-directed AI-assisted engineering/source review, not professional
tax advice, legal certification, or Revenue Department approval. No practitioner
sign-off is claimed. The earlier proposed practitioner prerequisite is replaced
for this bounded Direct macOS release by this disclosed review; independent
professional review remains recommended. Artifact/publication gates still apply.

Assessment: the reviewed ordinary non-VAT/THB/full-payment containment candidate
can proceed to artifact verification. Unsupported tax and sync workflows remain
blocked. No evidence establishes actual customer violations or fixes old documents.

## Primary sources rechecked

- [Revenue Code 86/13](https://www.rd.go.th/5208.html): issuing tax invoices depends
  on legal entitlement, not the occupation label "freelancer". New tax invoices
  are blocked in this release, including alternate creation paths.
- [RD registration guidance](https://www.rd.go.th/21166.html) expressly includes
  natural persons. Its old turnover figures are not used as current thresholds;
  [current registration-duty guidance](https://www.rd.go.th/7061.html) separately
  describes the THB 1.8 million threshold and timing, subject to activity/exemptions.
- [Sections 105 and 105 bis](https://www.rd.go.th/5203.html): receipt timing,
  prescribed particulars, Thai text and retained copies matter for covered cases.
  Product controls require explicit payment facts, issuer ID/name, series/number,
  dates, positive amounts and Thai/bilingual receipt output. Record retention and
  backups preserve evidence; technical controls alone do not certify every duty.
- [Sections 50 and 50 bis](https://www.rd.go.th/5937.html): withholding depends on
  applicable rules; the payer issues the certificate. The app no longer prescribes
  a generic 3% from income category/currency, and certificate tracking is not a
  verified tax-credit calculation.

Engineering inferences: immutable issued snapshots, explicit draft/final states,
payment identity/deduplication, durable retained voids and fail-closed unsupported
flows reduce the demonstrated risks. These implementation choices are not claimed
to be statutory prescriptions. Users must enter truthful particulars and keep
appropriate records; the app does not verify registration or actual settlement.

## Independent reviews and fixed finding

- Native independent code reviewer inspected issuance/history/reporting and ran
  synthetic scenarios. It found one concrete P2: deriving a receipt hid previously
  recorded withholding-certificate details because reports prefer the receipt.
- Manager fixed `createReceipt()` to retain `whtCertReceived`, `whtCertNo` and
  `whtCertDate` from the paid invoice. Regression checks single-payment tracking,
  pending count and CSV certificate identity before/after derivation.
- agy supplied a text-only design critique. It did not inspect source. Its archive
  concern was checked against existing raw JSON archive export/retained evidence;
  authoritative reprint quarantine does not mean total data-output lockdown.
  Unsubstantiated claims about mandatory physical VOID rendering/retention extensions
  were not adopted as law. Packaged testing and reconciliation concerns informed QA.

## Verification completed before packaging

- Final source on field clean checkout: **81/81 tests passed**.
- Native Electron 43.7.3 synthetic-profile smoke passed: storage/recovery, ordinary
  receipt, frozen paper, PDF and failed-write protection. Fixture:
  `/var/folders/4_/yy75nyfs02544ssmwvlgvz980000gn/T/billngai-electron-smoke-ydrjeF`.
- Existing release-config and syntax checks passed. Exact packaged executable,
  signing/notarization/public hashes require separate release evidence; do not
  infer those results from this pre-packaging record.

## Residual limits and public disclosure

- New VAT/registered-seller receipts, FX receipts, partial/deposit/refund workflows,
  PIT payable/refund estimates, cloud connect/sync/restore and custom e-Tax XML are
  not validated and remain unavailable, including affected Pro features.
- Legacy no-snapshot originals cannot be reconstructed faithfully. Keep existing
  PDFs, export backups before upgrading, use retained raw archive for review, and
  obtain case-specific advice before any correction/reissue.
- Local uniqueness is not multi-device allocation. Do not concurrently edit one
  workspace via Drive/Dropbox or treat rollback/import as an audit-history merge.
- Local clock, user-entered identity/withholding and external payment evidence are
  not independently verified. Full security/PDPA and historical exposure reviews
  remain separate. No customer records or production cloud data were examined.
- This release is Direct macOS only. Windows and MAS must be ported/tested separately;
  no App Store approval or Intel hardware test is implied by a universal binary.
- Website/support/metadata must reflect these boundaries before publication; prices
  stay unchanged and customer refunds/messages require separate owner direction.
