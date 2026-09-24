# 2.0.3 legacy preview and void-button incident

Date: 2026-09-24. Status: diagnosed; no application fix or new release authorized
by this diagnostic request. Owner reported blank old-document preview and no visible
response from “ยกเลิกและเก็บเอกสาร” in installed lighthouse-control app.

## Verified findings

- Installed `/Applications/BillNgai.app` reports 2.0.3. Packaged `billing.html`
  SHA-256 `d671a40a0f630a18b4662fa9e552a89dc644ba06712c7daed2ad7c74eea92f39`
  matches the released source; this is not an obsolete installation.
- Native UI shows the historical-review warning in place of the document preview.
  `renderPaper()` returns only the warning whenever `documentOutputBlocked()` is
  true. Issued legacy documents lack the newly introduced snapshots and therefore
  cannot show a readable preview, even though their saved records remain present.
  This is the implemented containment behavior, not evidence that data was deleted.
- A narrowly scoped, read-only local storage check confirmed retained records.
  No customer names, amounts, identifiers or raw records are included in this report.
- `voidDocument(id)` calls `prompt()` when invoked by the button without a reason.
  Electron 43.7.3 explicitly replaces that function with a throwing implementation:
  https://github.com/electron/electron/blob/v43.7.3/lib/renderer/window-setup.ts.
  The rejected async call has no user-visible error handler. It fails before setting
  `voidedAt`, `voidReason` or calling persistence, explaining the apparent no-op.
- Synthetic VM reproduction with the released function and Electron's throwing
  prompt produced `prompt() is not supported.`, zero persistence calls and an
  unchanged synthetic record. This was not a cancellation of a real document.
- Existing history suite still passes 18/18. Its prompt mock returns text, and
  void tests pass explicit reasons. Packaged smoke does not exercise this button.
  This is a missing native-interaction test in the release checks, not a new pass.
- Native console inspection was interrupted by app-state-change notifications;
  no live console exception was captured and no real void action was attempted.

## Recommended next change (requires implementation authorization)

1. Replace browser `prompt()` with the existing application modal pattern:
   mandatory reason, explicit confirm/cancel, visible save failures and unchanged
   data on cancel/error. Do not reinterpret “void” as “dismiss this warning”.
2. Provide a clearly labelled read-only historical review view of retained data,
   separate from authoritative printing/sharing. Do not invent snapshots, silently
   relabel old tax invoices or mark records reviewed without a defined workflow.
3. Add real packaged Electron interaction coverage for opening/cancelling/submitting
   the void dialog, legacy review visibility, persistence failures and reload.
4. If approved, ship a fresh patch version (proposed 2.0.4) through all release gates.
   Do not overwrite the published immutable 2.0.3 artifact or patch the installed
   signed bundle in place. Preserve customer data and back it up before migration.

User's actual documents were not modified, voided, exported or uploaded. Diagnosis
only; no source-code changes, Git commit/push or public release changes made.
