# Option A cleanup — implementation and verification

2026-09-25. Local source candidate, version remains 2.0.6. Continues the other
agent's Option A patch and preserves the pre-existing English translations.
The earlier broad navigation/lifecycle prototype is superseded by this scope.

## Delivered

- Three Settings tabs: My business, Documents & tax, Data & backup.
- Workspace tab and paused sync controls removed. Pro upgrade/activation and
  deactivation retained under Data & backup; dated licenses show their end date.
- e-Tax XML buttons and export promises removed in Thai and English. Backend
  containment remains enabled. Existing truthful restriction disclosures remain.
- AI sidebar hidden unless desktop + Pro + valid local add-on. Optional add-on
  setup stays accessible in a collapsed Settings section. Startup/activation
  refresh availability; concurrent checks share a promise to avoid render loops.
- New tax-invoice choice stays excluded (already true before this cleanup).
  Historical tax records, review, output blocks and stored schema remain intact.
- Blanket 2.0.4 banner removed. Receipt-specific hint and a version-neutral
  Usage limits entry remain in Documents settings; receipt editor has a short
  full-payment/THB/no-VAT hint. Data-load and record-specific warnings remain.
- No accounting calculations, issuance rules, sync backend, data migration,
  payment reconciliation or original-record editing changed.

## Verification

All on isolated synthetic profiles/ephemeral browser contexts:

| Check | Result |
| --- | --- |
| `npm test` | 182/182 pass, including renderer syntax and containment |
| `test/option-a-electron-smoke.cjs` | Pass: three tabs; TH/EN; edited settings saved before tab switch; failed save retains inputs; dated/lifetime license labels; activation/deactivation; installed/missing/invalid AI navigation; delayed status request deduplication; manual backup; document types; historical originals; reload; no missing literal translation keys or JS errors |
| `test/electron-storage-smoke.cjs` | Pass: missing/changed data protection, recovery, native save/reload, backups, frozen receipt/PDF, failed editor save |
| `test/stabilization-electron-smoke.cjs` | Pass: void/payment dialogs, draft PDF, historical tax output block, evidence bundle, receipt generation, TH/EN, close drain |
| `test/payment-match-electron-smoke.cjs` | Pass: explicit pair confirmation, backup/save/reload, no double counting, original preservation |
| `test/bulk-correction-electron-smoke.cjs` | Pass: eligibility, cancel, atomic backed-up review, originals retained, review-only proposal, reload/export |
| `test/compliance-browser-smoke.cjs` | Pass: unknown VAT rejected, explicit confirmation, receipt UI, frozen paper, duplicate draft, TH/EN and PDF |
| `../design/2026-09-25-minimal-2.0.6/check-option-a-browser.cjs` | Pass: browser TH/EN Settings, hidden AI, JSON/CSV controls and contextual limits |
| `git diff --check` | Pass |

MiMo supplied an independent read-only review; Codex checked each finding,
implemented changes and ran validation. Initial focused-test failures were test
synchronization/fixture issues: untouched Data tab has no editable fields, backup
completion needed an observable success condition, and fixture timestamps needed
stable values across initial reload. Final run passes with those corrected.

AI availability/license IPC was stubbed in the focused native test. This proves
UI gating and lifecycle behavior, not model inference or real license issuance.
No AI model is installed by this task. Native backup/storage/PDF paths are real.

Renderer SHA-256: `3e6b257eeff99eebee8dacc20082a0e3a8049701e17232ab0235327d95f986f1`.
Final Option A native artifacts: `/var/folders/tb/619_zw050jd0m07bpqrll38r0000gn/T/billngai-option-a-iDqCyA`.
Persistent screenshots and worker review: `../design/2026-09-25-minimal-2.0.6/option-a-*`.

## Delivery state

Changes are uncommitted in the development checkout. No version bump, packaging,
signing, installation or publication. The installed application and customer
profile were not changed. Existing broader layout and accounting workflows remain.
