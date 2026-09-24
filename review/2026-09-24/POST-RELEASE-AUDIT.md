# BillNgai 2.0.3 — post-release swarm audit

Date: 2026-09-24. Coordinator: Codex. Status: audit/design complete; bugs remain
unfixed. Owner requested a broad agent audit and a plan for old documents, not a
new release or edits to customer records.

## Assessment

**2.0.3 has material functional, preservation and security defects.** The original
81-test release result did not cover the native button paths now reported by the
owner. Signing/notarization establish artifact identity/distribution checks, not
feature correctness. Do not describe the current release as comprehensively tested
or this review as finding every bug. Prioritize a properly tested patch; do not
overwrite the immutable 2.0.3 installer or recommend an untested data rollback.

Audited app source is unchanged from released commit
`49595e0567d397a7d334178615205ba41deb8748`, in the publishing checkout at docs HEAD
`6647d5bbeb7992fb3384b30b60b1678506511368`. Installed renderer was previously
verified to match SHA-256
`d671a40a0f630a18b4662fa9e552a89dc644ba06712c7daed2ad7c74eea92f39`.

## Team, review and acceptance

- `audit_document_flows`: editor/finalization, lifecycle/buttons, duplication,
  conversion/splitting, recurring, AI draft handoff, preview/share/print/PDF.
- `audit_storage_reporting`: main/preload storage boundaries, queue/shutdown,
  backup/recovery/import, reporting/WHT, local-file injection and failed saves.
- `audit_legacy_design`: migration/reference retention, states/actions, old payment
  history, historical review and phased recovery design.
- External `agy`, task `b9ecb0f9046f44fcb38fa84b3b9a55ca`: text-only independent
  design critique, completed. No code/test credit. Outcome **needs_revision**:
  useful archive/void/provenance separation, but coordinator rejected its blanket
  receipt-threshold claim, automatic legacy-to-non-VAT receipt path, treating
  snapshots as verified revenue, and archive removal from financial totals.
- Coordinator read the relevant source, independently reproduced the findings below
  using synthetic records, rechecked official RD sources, resolved those design
  disagreements and wrote the proposed recovery plan. No majority-vote acceptance.

## Confirmed findings

P1 means fix before the next recommended release. P2 means material correctness or
workflow defect; not a finding that a customer violated tax law. Line references
are for the unmodified released sources in this checkout.

| ID | Priority | Finding / impact | Evidence |
|---|---|---|---|
| F01 | P1 | Both void/archive **and new-invoice payment recording** fail in Electron. Unsupported `prompt()` rejects before persistence; no visible recovery UI. | `billing.html:4731`, `5060`; synthetic throwing-prompt reproduction; Electron 43.7.3 source |
| F02 | P1 | Draft print/PDF hides its only draft label. Draft receipts skip finalization checks but can render print-ready paper. Old tax-invoice drafts also reach the tax-labelled template. | print CSS `billing.html:586`, draft banner `4939`, guards `4697`, `4832`, `4842`; static/VM output proof, **not visually printed** |
| F03 | P1 | Quit acknowledgment does not drain local saves. Immediate quit can terminate an in-flight write and lose the newest edits; atomic saves only protect prior bytes. | `main.js:1159`, renderer `billing.html:5338`; actual handler/queue VM ordering `save started → app.quit → save completed` |
| F04 | P1 | Imported document IDs enter executable inline handlers. A crafted local import can execute renderer JS when its row is clicked, reaching exposed storage IPC. | `billing.html:3330` and other raw-ID handlers, `main.js:494`, `preload.js:4`; harmless marker executed in synthetic VM; not a remote-exploit claim |
| F05 | P1 | Retained legacy documents can lose their linked buyer evidence: migration still purges customer tombstones older than 180 days. | `billing.html:1423–1424`; retained document remained while synthetic referenced customer disappeared |
| F06 | P2 | Recovery accepts malformed nested records and can install a DB the renderer cannot load. Pre-restore backup exists, so recovery is possible; replacement should never have been accepted. | `main.js:494–501`, `558–569`, `623–629`; `clients:[null]` passes main validation then migration throws; `items:{}` similarly breaks computation |
| F07 | P2 | Settings/client/recurring forms ignore persistence failure and announce success. Recurring generation consumes number, adds a draft and advances schedule despite save failure. | `billing.html:4283–4285`, `4343–4345`, `3540–3568`; synthetic false-save paths; source record can later be unintentionally saved |
| F08 | P2 | Quotation “ลูกค้าปฏิเสธ” always does nothing: UI requests a transition not allowed by the handler. | `billing.html:4773`, `5053–5054`; sent status and zero writes after decline |
| F09 | P2 | Voided unpaid invoices remain overdue/outstanding in report/list, unlike dashboard; unavailable payment actions are still offered. | `billing.html:2540–2543`, `3314–3319`, `3726–3729`; separate cancellation from retained actual payment evidence |
| F10 | P2 | Annual report grouping/CSV uses current client identity, not frozen buyer. Editing a customer changes historical report identity while WHT CSV preserves it. | `billing.html:3698–3700`, `3802–3807` versus `1349`; synthetic name/tax-ID change |
| F11 | P2 | Historical access is a warning-only dead end. Raw-JSON archive is not a usable document review, and its export omits linked customer context. Deleted/void meanings are also conflated. | `billing.html:4911`, `4741–4744`, `4702`; deliberate original-output restriction but deficient review UX/preservation package |
| F12 | P2 | Unknown old currency is silently assumed THB and assigned rate 1. A warning elsewhere does not establish that conversion basis. | `billing.html:2475`, `3665`; explicit missing-currency fixture remains unresolved but computes THB |
| F13 | P2 | An invalid date such as February 31 is flagged uncertain but still allocated to March in reports. | `billing.html:3634–3636`, `3697`; should remain unallocated, not normalized into an asserted month |
| F14 | P2 | Distinct historical child payment IDs sharing one invoice parent collapse into one payment group. Existing warning flags ambiguity, but the selected total may omit real historical installments. | `billing.html:3642–3658`; confirmed grouping behavior; resolve evidence, do not simply disable all deduplication |
| F15 | P2 | Monthly recurrence from January 31 returns March 3, skipping February. | `billing.html:3432–3438`; define month-end/leap-year/local-date policy |
| F16 | P2 | Split progress counts unissued/voided children as billed; any child receipt including a draft can imply paid. | `billing.html:5117–5129`; unissued drafts alone produce fully-billed status |

F04 must be fixed at the DOM/event boundary, not by merely HTML-escaping an ID
inside JavaScript. Validate structural data and IPC callers as defense in depth.
F02 requires print/PDF-specific coverage; checking the HTML contains “draft” is not
enough. No assertion is made that a user's actual history contains crafted imports,
unsupported tax-invoice drafts, missing referenced customers or distinct installments.

## Reproducible checks

Run `node review/2026-09-24/audit-probes.cjs` from the app checkout.

- **19 diagnostic reproductions observed** by coordinator. These assertions confirm
  current defects/ambiguous behavior; they are **not** fixed-regression passes.
- Probe uses existing synthetic VM history fixture and selected actual source
  functions. It never opens the installed app/profile, reads real documents, sends
  network requests or writes application data.
- First payment reproduction did not reach the prompt because the initial fixture
  omitted `whtReviewed`. Fixture corrected to satisfy prior validation; both prompt
  failures then reproduced. Do not erase this distinction by claiming native clicks.
- Current local `npm test`: **79 passed, 1 test-file load failed** because this
  publishing clone has no `@electron/asar`. Two release-config test cases therefore
  did not run. This is an environment/dependency limitation, not evidence of a new
  application regression or a current 81/81 pass. Historical field 81/81 remains
  dated evidence only. `release:check` chained after the failed command did not run.
- `git diff --check`: passed. No application source/package version changed.

## Legal and product boundary recheck

Official sources read 2026-09-24:

- [Revenue Code sections 105 and 105 bis](https://www.rd.go.th/5203.html): applicable
  receipt issuance, required particulars and copy retention. This supports preserving
  evidence; it does not require hiding old records from their owner.
- [Sections 86/12 and 86/13](https://www.rd.go.th/5208.html): tax-invoice replacement
  rules and entitlement restrictions. A newly rendered historical copy or changed
  document title must not be treated as an automatic cure.
- [Order P.86/2542, clauses 25–26](https://www.rd.go.th/3568.html): specific correction
  procedures for the covered registered-operator cases. Do not apply this as a
  generic app-button workflow to an unregistered person's historical document.
- [Electron 43.7.3 window setup](https://github.com/electron/electron/blob/v43.7.3/lib/renderer/window-setup.ts):
  `prompt()` explicitly throws.

The proposed separation of read access, evidence quality, issuance and payment is
an engineering recommendation derived from these constraints, **not a legal ruling**.
Freelancer status alone does not establish VAT entitlement or ineligibility. Actual
historical correction, customer communication and tax exposure require a scoped
case-specific review; no real historical document was legally assessed here.

## Coverage limits / remaining checks

Broad source review is not exhaustive certification. Still required before a patch:
real packaged button/input/reload tests; draft PDF visual/text verification; delayed
write then quit; migrations using synthetic 2.0.2/2.0.3 fixtures; malformed/large
imports; duplicate-click and concurrent save behavior; keyboard/Thai/English/mobile
preview accessibility; full clean dependency/test run and signed artifact gates.
Intel/Windows/MAS hardware, cloud re-enablement, live AI add-on/model behavior,
full penetration/PDPA audit and every historical release remain outside this pass.
No live cloud/customer records, tokens or signing credentials were used.

Implementation proposal: [LEGACY-RECOVERY-PLAN.md](LEGACY-RECOVERY-PLAN.md).
No source implementation, commit/push, publication, customer message or data change
was performed in this audit. Findings are saved locally for owner review.
