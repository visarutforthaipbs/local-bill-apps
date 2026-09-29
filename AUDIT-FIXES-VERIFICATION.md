# Audit fixes — source verification

2026-09-29 · Base `28b29c527886480ab3e3c5276f2e3227b691973a` · Unreleased

The owner authorized fixing the financial and 37signals design audits. This is
an implementation on the current source checkout, still version **2.0.8**.
No app was packaged, signed, installed or published; no customer profile was
used or modified. No Git commit or push was made. Earlier audit files remain
unchanged as records of the original findings.

## Implemented

| Finding | Result |
|---|---|
| F1 / D1 | Certificate fields and `updatedAt` no longer invalidate confirmed historical income. Full immutable review snapshots remain intact. Other source changes, including payment amounts, dates and group membership, still invalidate the answer. |
| F2 | Select the latest answer for a group before checking its source. An invalid latest answer reopens review; an older answer cannot silently return. |
| F3 | Explicit `not_income` groups no longer contribute missing-date/currency blockers to income reports. Unresolved/included records retain their warnings. |
| F4 | Consumption of imported `same_payment` answers enforces the same dated, THB, positive-amount representative eligibility as the editor. Ineligible answers remain in history but do not count as answered income. |
| D2 | Recover pending historical answers and existing-document edits after navigation/dismissal/reload. Source changes invalidate recovery; pending choices never affect income. Confirmation must be entered again. Local-storage failure keeps the editor/navigation open. Older new-document recovery remains available; existing draft VAT is preserved for explicit review. |
| D3 / D8 | Six primary destinations. Recurring lives under Documents; accounting periods live under Income summary. Old-record review, correction and document viewing retain Documents as their parent. The legacy return action explicitly names Documents. |
| D4 / D7 | Receipt VAT prerequisite appears before the form. Only THB is selectable for receipts; imported unsupported currency remains visible for explicit correction. Document creation follows the selected type. First-use and filtered-empty states have appropriate actions; adding the first client resumes the requested document type. |
| D5 | Backup/restore appears first. Distinct local restore-point and exported-file labels; optional storage location disclosure; JSON attachment scope and evidence export/import beside backup when evidence exists. Backup history uses task labels for review/matching/correction snapshots. |
| D6 | Reports lead with net received, expected withholding and outstanding invoices. Accounting detail is disclosed, automatically open when VAT is present. Relevant limitations and actionable review links remain; accounting periods omit repeated generic caveats. Dashboard names its all-time received period and shows amounts immediately. |
| D9 | Unavailable tax-invoice numbering removed from the form while stored formats survive. Client copy and withholding-default scope match supported behavior. Routine limits are version-neutral; Pro copy reflects local AI. Local-store recovery copy no longer assumes Drive/sync. |
| D10 | Shared chart styles live in the main stylesheet; unused dashboard chart/count-up helpers removed. Existing report tests now exercise the active report. BRAND/AGENTS/CLAUDE document the product contract and current feature state. |

No migration rewrites historical documents or review events. Financial matching
ignores only certificate metadata and the update timestamp; it is intentionally
conservative about all other changes. Structural import validation is retained:
F4 is enforced when an imported answer is consumed, not by discarding history.
Draft recovery is local to this Mac and is not a replacement for saved document
backups. Explicit save, confirmation and pre-review snapshots remain in place.

## Validation

- `npm test`: **195 passed, 0 failed**. Five new regressions cover F1–F4,
  including certificate updates for both historical answer types and protected
  changes to amounts/dates/membership.
- `test/design-fixes-electron-smoke.cjs`: passed with real source Electron and
  a verified temporary profile. Covers six navigation entries, old-answer
  recovery and stale-source rejection, WHT save/reload retaining THB 10,400,
  existing-draft recovery, closing without accepting recovery, storage quota,
  stale draft rejection, pre-upgrade recovery, retained VAT/payment-date inputs,
  reset confirmations, type-specific creation, receipt prerequisites,
  backup labels, report nesting/styles, first-client flow, TH/EN translations,
  and a 940-pixel viewport without whole-page horizontal overflow.
- Existing source desktop smokes: **legacy-review, payment-match, stabilization,
  option-a, and electron-storage all passed**. They cover backup-before-review,
  original-record preservation, native save/reload, void/payment/evidence flows,
  Settings save failure, optional AI/license behavior, fail-closed storage,
  receipt issuance, frozen printed content and PDF output. The Option A test
  now targets its specific add-on disclosure because Settings has multiple
  intentional disclosures. Expected injected storage failures appear in its log.
- `npm run release:check`: passed. This validates packaged OAuth configuration;
  it does not build or certify a release.
- Inline renderer, main, preload and new smoke syntax checks passed;
  `git diff --check` passed. Literal `tr()` and static sidebar translation keys
  are checked in the native harness. No page errors in the new flow.
- Visually inspected Thai/English source screenshots. Ordinary non-VAT reports
  have collapsed accounting detail; historical VAT reports open it automatically.

Logs: `review/2026-09-29/design/implementation-*.log`.
Screens: `review/2026-09-29/design/implementation-screens/` (six captures).
Hashes: `review/2026-09-29/design/implementation-source-hashes.json`.
The five existing desktop smokes preceded the last presentational-only backup
labels and unused-animation removal; the full unit suite and new desktop flow
ran after those changes. Final syntax/whitespace checks include the final source.

## Delegation and release boundary

Applied the [mimo-worker skill](/Users/lighthouse-control/.codex/skills/mimo-worker/SKILL.md).
A bounded finance implementation was sent with selected source and synthetic
fixtures. The invocation timed out after 600 seconds (exit 143), with no observed
model or proposed changes; stderr reported `unrecognized_model` for the requested
`mimo-v2.6-pro`. Codex rejected the empty result and completed/reviewed the changes
locally. No work is attributed to MiMo and no alternate model/endpoint was substituted.
Worker evidence and rejection:
`/Users/lighthouse-control/.local/state/mimo-worker/20260929-140724-i0b5hsbr/`.

The installed signed 2.0.8 app is unchanged. Packaging, signing/notarization,
installation, and a packaged-runtime smoke pass are separate release work.
Validation here exercises the source on this arm64 Mac, not a new Intel build.
