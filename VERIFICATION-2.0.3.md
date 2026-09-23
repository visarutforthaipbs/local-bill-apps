# BillNgai 2.0.3 candidate verification

Date: 2026-09-23. Scope: direct-download source candidate; MAS and Windows port/build verification remains pending under the coordinated release policy.

## Latest release-preparation audit — 2026-09-23

Owner authorization now covers the Direct macOS release workflow and matching
website publication after technical gates pass. The owner instructed "you audit
and do it" after the proposed outside-practitioner prerequisite was explained;
this substitutes an AI-assisted audit as the owner's release decision, **not**
professional sign-off or legal certification. Earlier gate wording below records
the prior state; see `PRD-2.0.3.md` for the dated decision and limits.

Final-audit P2 fix: `createReceipt` now copies `whtCertReceived`, `whtCertNo` and
`whtCertDate` from the paid invoice into its derived receipt. The receipt preferred
by deduplicated reporting therefore retains recorded 50-tawi certificate evidence.
A new regression verifies pending count zero, one tracked payment and `CERT-9` in
CSV both before and after conversion. The local issuance suite passed **15/15**.

After transfer, the release manager reports **81/81 full tests passed on field**
in the clean `BillNgai-release-2.0.3` release checkout. Native Electron 43.7.3 source
smoke also passed, using isolated fixture
`/var/folders/4_/yy75nyfs02544ssmwvlgvz980000gn/T/billngai-electron-smoke-ydrjeF`.
These results include the certificate-preservation change. The reviewed release
commit, signed universal installer, notarization/stapling, Gatekeeper, exact
packaged smoke, public-download hash and live website verification are **pending**
in this record. Source checks do not certify an untested packaged binary.
No Windows or MAS build/submission is completed or authorized by this Direct scope.

For session history, release-practice findings and next steps, read [SESSION-HANDOFF-2.0.3.md](SESSION-HANDOFF-2.0.3.md). Checks below were completed during implementation; the subsequent documentation-only handoff update did not rerun them or verify a packaged 2.0.3 installer.

## Delivered scope

Implemented PRD containment: explicit non-VAT/full-payment/WHT review, ordinary THB receipts only, shared issuance guards, unique local numbering, snapshots and historical quarantine, retained void/deletion evidence, payment deduplication, honest category/FX summaries, paused PIT conclusions, cloud sync/restore and custom e-Tax XML. Updated in-app claims and FAQ to disclose restrictions.

Unsupported workflows are blocked, not implemented: new VAT invoices, registered-seller receipts, partial/deposit/refund workflows, foreign-currency receipts, validated PIT engine, authorized e-Tax integration, durable multi-device issuance/conflict handling and historical-document correction. Existing records are not legally cured by this update.

## Team and manager review

Three native implementation agents delivered issuance, history and reporting with separate tests. Reporting agent independently cross-reviewed issuance/history. Manager reviewed integration and fixed surrounding dashboard, export, sync IPC, translation and product-claim paths.

Concrete findings fixed and regression tested:

- Malformed imported snapshot could crash duplicate/compute.
- Finalized invoices could lack the payment action.
- Derived receipts could use mutable raw amounts and current buyer rather than source snapshot.
- Receipt-to-invoice type change could carry payment facts into an unpaid invoice.
- Certificate save failure could leave an in-memory success state.
- Dashboard previously counted draft/repeated receipt documents rather than unique payment evidence.
- Final cross-review also found the old dashboard chart data source, issue-date substitution in WHT CSV, no correction route for VAT-bearing drafts, spreadsheet formula handling and unescaped draft numeric/date attributes. These paths are fixed with four additional regression tests; this is not a complete import/security audit.

The agent-team skill informed external independent review and evidence-based acceptance. agy's design review was inspected; its suggestions to reconstruct/revoke history or reopen VAT on assertion alone were not accepted. Qwen failed with SSH timeout; Claude failed authentication; agy's final file-based code review failed permissions/timeout. None is credited with completed implementation or final code approval. Native cross-review and manager checks supplied the final engineering review; provider credentials/settings were not changed.

## Checks completed locally

- `npm test`: 80/80 pass locally, including the existing storage/release suites and new issuance/history/reporting/containment suites. Existing installed `@electron/asar` was used via NODE_PATH; no dependency versions changed.
- Main/inline syntax checks pass.
- Literal `tr('…')` key scan found one missing new key (`ปิด`), corrected; final scan has no missing literal keys.
- Real isolated Chrome workflow passes: unconfirmed VAT rejected, explicit status confirmed, ordinary receipt finalized, customer/profile changes do not alter paper, duplicate remains unsaved draft, Thai/English screens run without page errors, PDF generated.
- Animation-free receipt and English summary screenshots visually inspected. Ordinary receipt visibly states `ไม่ใช่ใบกำกับภาษี`; no tax-payable/refund figure appears in summary UI.
- Tests use synthetic records, ephemeral browser context/localhost port and temporary storage harnesses. No real app data, cloud workspace, customer records or signing keys were used.

## Remote integration and remaining release gates

Before integration, field's billing.html, main.js, package.json, lockfile, FAQ and changelog hashes matched the preserved baseline. The existing dirty working tree is deliberately retained. Files are backed up separately before copying verified candidate content. No commit, tag, push, signing, public packaging or release publication is authorized by this work.

Remote verification: final expanded suite **80/80 passed** after all review fixes. `release:check`, main/preload syntax and `git diff --check` pass. Electron 43.7.3 isolated-profile smoke passed again on the final source: boot-load locking, preserved synthetic documents, native IPC recovery, save/reload, Thai/English backup history, finalized ordinary receipt/frozen paper/PDF and rejected changed-file save. Expected `DATA_MISSING`/`DATA_CHANGED_ON_DISK` messages are assertions in that test, not real customer-data failures. The old smoke fixture was adjusted from VAT 7 to VAT 0 to reach its intended changed-file test under the new validation rules, and extended to cover finalized receipts. Final temporary fixture: `/var/folders/4_/yy75nyfs02544ssmwvlgvz980000gn/T/billngai-electron-smoke-6Qw2jo`. Final local browser workflow and literal-translation scan also passed after the last fixes.

Pre-change backup: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-pre-2.0.3.iucTpL/source-before.tgz`; the original Electron smoke is separately retained as `electron-storage-smoke.cjs.before`. Staged candidate: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-2.0.3-stage.LPIRhN`. Source repository: `/Users/visarutsankham/Documents/Personal-Project/Billiong-App`. Original branch and HEAD remain unchanged; changes are uncommitted.

Historical gate record before the latest owner decision: Thai tax practitioner review of supported sample transactions and terminology; historical exposure/correction assessment with explicit customer-data scope; final signed/notarized artifact verification and distribution-channel/marketing review. The latest decision above changes only the outside-practitioner prerequisite, not the technical gates or need to avoid compliance claims. Local numbering does not solve concurrent use of a shared Drive/Dropbox JSON file; do not edit the same workspace concurrently across devices. Historical customer-data assessment and full PDPA/security review remain separate, pending scoped work.
