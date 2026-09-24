# BillNgai 2.0.4 — verification record

Date: 2026-09-24. **Source verification checkpoint; release continuation below.**
See [RELEASE-2.0.4.md](RELEASE-2.0.4.md) for subsequent authorized packaging and
publication evidence. Earlier missing-config/no-remote-work statements below
describe the source checkpoint and are not the current release status.

Subsequent release acceptance: 165 tests passed again; approved OAuth check passed
on field; fresh universal build completed; Apple Accepted; final DMG stapled and
Gatekeeper accepted both DMG and mounted app. Both native suites passed against
the final read-only mounted installer with synthetic profiles, and all 17 packaged
tracked files match source commit `8c1dfcfbb1891979706d63558c90075d50be9722`.
See the release record for submission ID, final hash, fixture paths and public-byte
checks. Remaining expanded manual/other-platform checks below are not claimed done.
Candidate is an uncommitted working tree in `BillNgai-publish-2.0.3`, based on
`6647d5bbeb7992fb3384b30b60b1678506511368`. Coordinator source hashes and checks are
recorded below. No new commit exists. Do not turn a pending release item into a
pass without evidence.

## Evidence separation

The installed/public 2.0.3 artifact and its earlier 81-test/notarization results
belong to [RELEASE-2.0.3.md](RELEASE-2.0.3.md), not this changed candidate. The
post-release diagnostic probes intentionally reproduced defects; their observed
assertions are not fixed-regression passes. The initial audit's 79-pass/one-file
load failure (`@electron/asar` absent, two release-config cases not run) is an
earlier environment checkpoint, not the final 2.0.4 suite result.

All current implementation tests use synthetic VM fixtures or temporary profiles.
No verification recorded here establishes customer-document validity, legal
certification, external practitioner sign-off or absence of every possible bug.

## Recorded checks

| Check | Result / scope |
|---|---|
| `node --test test/main-stabilization.test.cjs test/storage-safety.test.cjs` | **35/35 passed** at the main/storage teammate checkpoint, 2026-09-24; synthetic isolated profiles only |
| `node --check main.js` / `node --check preload.js` | Passed at that checkpoint |
| `git diff --check` | Passed after integration |
| Complete `npm test` | **165/165 passed**, no skipped/cancelled cases; includes release-config unit fixtures |
| `npm run release:check` | **Blocked as expected:** this audit checkout lacks `secrets/gdrive-oauth.json`; no credentials copied or invented |
| Final renderer syntax and literal i18n scan | Renderer syntax test passed; main/preload `node --check` passed; **588 unique literal `tr()` keys, zero missing entries** |
| Native source UI/lifecycle/close/PDF tests | **Passed** `test/stabilization-electron-smoke.cjs` on local arm64 macOS / official Electron 43.7.3 with a verified isolated temporary profile |
| Signed/notarized 2.0.4 installer and packaged smoke | **Not built/verified by this checkpoint** |
| Public hashes, GitHub release and website deployment | **Not performed for 2.0.4** |

The 35-test subset covers native queue ordering and disk-change locks, malformed
recovery before replacement, preservation backup bytes/failure/corruption, trusted
IPC callers, delayed-save quit/window close, rejection/timeout/stale acknowledgments,
review-event shapes, attachment immutability/type/size/hash, missing evidence,
evidence bundle round-trip/all-before-copy validation, and protected export targets.
It does not run a real Electron window or prove real native dialog/keyboard behavior.

## Integration regression inventory

Read the actual final tests and outputs; this inventory documents intended coverage,
not a blanket pass claim:

- `test/document-stabilization.test.cjs`: payment modal/validation/retry, declined
  quotation, void/legacy quick-action eligibility, draft print label and unsupported
  tax-invoice output, malformed renderer import and inert imported IDs.
- `test/legacy-recovery.test.cjs`: historical read access/provenance, reference
  retention, archive versus void, rollback, separate reviewed payment events,
  supported new receipt, missing evidence, imported facts and duplicate/concurrent
  actions, review export context.
- `test/recurring-stabilization.test.cjs`: month-end/leap recurrence, anchor
  preservation, failed-save rollback, duplicate generation and number collisions.
- `test/reporting-stabilization.test.cjs`: frozen inputs, unallocated date/currency,
  explicit/ambiguous payment identity, split progress, reviewed payment projections
  and once-only counting when a receipt is subsequently issued.
- Existing history/issuance/reporting/containment/storage/release suites remain
  required. Fixture changes must reflect supported semantics, not merely silence
  failures. Main structural validation and renderer validation must agree before
  backup restore is allowed to replace active bytes.

## Required native and visual acceptance

- [x] Run the final app with an explicitly isolated temporary profile; record
  runtime, source identity, fixture path and actual hardware architecture.
- [ ] Click both actual lifecycle modals; test cancellation/Escape, blank/invalid
  values, save failure, retry, double click and reload. No unsupported prompt calls.
- [ ] Delay a real native save, then invoke Quit and Cmd-W/window close. Confirm
  completion precedes destruction; failure/timeout preserves input and permits retry.
- [ ] Exercise missing/corrupt/changed external stores and invalid nested recovery;
  inspect unchanged original bytes and verified preservation copies.
- [ ] Verify all historical types, missing status/snapshot, retained clients,
  archived/voided/deleted variants and conflicting identities without real data.
- [ ] Select synthetic PDF/PNG/JPEG evidence using the native picker; check duplicate
  attachment, missing/corrupt file, original export and separate bundle round-trip.
- [ ] Exercise eligible and rejected legacy-payment/receipt paths end-to-end;
  ensure original invoice stays unchanged and reports count the payment once.
- [ ] Inspect draft PDF text and rendered pages, supported issued receipt, Thai/
  English UI and historical/output-blocked states. A screen banner alone is not
  proof that printed output is safely labelled.
- [ ] Review app-wide keyboard/focus/error messages and final translation coverage.

## Release gates remain separate

No current 2.0.4 artifact identity, notarization submission, public download or
deployment ID exists in this checkpoint. Do not invent one or reuse 2.0.3 values.
After separate authorization, follow `DEPLOYMENT.md` and
`mac_signing_notarization_plan.md`: reviewed reproducible commit; correct version/
changelog/configuration; signed universal build; Apple Accepted; staple/signature/
Gatekeeper checks; read-only mounted exact packaged smoke and source comparison;
final post-staple SHA; R2/GitHub public-byte checks; then truthful website deployment
and live-link verification. Preserve immutable prior releases and assess data
compatibility before any rollback.

Intel hardware, Windows and MAS require their own verification; universal packaging
alone does not prove hardware coverage. MAS uses coordinated app SemVer with a fresh
build number and deliberate channel-specific port. Cloud re-enablement, professional
review, customer messages/refund decisions and broad security/PDPA certification are
not implied by these tests.

## Coordinator completion entry — 2026-09-24

All 16 audited categories implemented, plus review-found milestone HTML escaping,
client/image failed-save rollback, missing-evidence rejection, concurrent receipt
protection and unsupported imported review-event settlement rejection. Three native
Codex teammates implemented/reviewed bounded areas; coordinator integrated and
checked them. An attempted external Claude workspace review was refused by the
connector's allowed-workspace policy and did not run; no review credit is claimed.

Final application SHA-256 (uncommitted files):

```text
7e64ea91a452df7e69265469ea43e8b1340670b6a49f6e148d95f1eb64aa16e0  billing.html
6e48796e647a5b36e0fe67d7d709563f2a708da470264d5ba5fe754f4f603d92  main.js
f7e35bd193495792902336233aa5bb587f31e9e368058a63c877c148d3388284  preload.js
3c2c80fb553ac7328f0096d8b7fa1d56755303f7c5cf75e023fe3281a80f4eb6  package.json
251b3dc6b9087ae1b54a7723b6a6ddcca55313fed0c640e834145a063bd1597d  package-lock.json
```

Commands/results:

- `npm ci`: first sandbox attempt could not resolve npm; approved retry installed
  pinned dependencies (305 audited packages, no npm audit vulnerabilities reported).
  Official Electron download needed approved network access and completed. This is
  not a comprehensive dependency/security certification.
- `npm test`: final **165 pass / 0 fail / 0 skipped**. Earlier integration failures
  were corrected and rerun, not counted as final passes.
- `node --check main.js`, `node --check preload.js`, renderer syntax regression and
  `git diff --check`: passed. Literal translation scan: 588 keys, no missing keys;
  dynamic wording still needs normal UI review.
- `NODE_PATH=/Users/lighthouse-control/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node test/stabilization-electron-smoke.cjs`:
  passed against the final source. Runtime asserts userData is the temporary profile
  before fixture mutation, and app version is 2.0.4. Actual buttons exercised void
  cancellation/save/reload, invoice payment date/full confirmation, retained review,
  legacy payment plus separate new receipt, report once-only counting, TH/EN screens
  and native window-close while a local save is pending. No page errors.
- Final synthetic artifacts/profile: `/var/folders/tb/619_zw050jd0m07bpqrll38r0000gn/T/billngai-204-native-8qXEy9`.
  Evidence attachment and bundle export used **real IPC/hash/disk code but stubbed
  native picker destinations**; this does not claim OS file-picker UX acceptance.
  Missing/corrupt evidence, bundle import/round-trip and close rejection/timeouts are
  covered by synthetic main/renderer tests, not all by live native clicks.
- Native `draft.pdf` text extraction includes `ร่าง — ยังไม่ออกเอกสาร`.
  Poppler-rendered page and stable historical-review screenshot visually checked:
  visible draft label, legible Thai, no clipped table, labelled retained fields and
  unknown historical parties. Native PDF check is source runtime, **not an exact
  signed installer test**.

Unchecked native checklist items above represent remaining expanded/manual release
acceptance, not claims that all combinations were clicked. In particular actual
native file-picker presentation, full keyboard/accessibility exploration, live
fault injection across every lifecycle, exact signed/notarized package and Intel/
Windows/MAS remain unverified. Source implementation is complete for this scope;
release configuration, packaging and publication remain blocked/separate.

No real profile/document was read or changed for implementation tests, no app was
installed, no remote tree was updated, and no commit/tag/release/website was pushed.
