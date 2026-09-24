# BillNgai 2.0.4 — implementation handoff

Updated: 2026-09-24. **Mac Direct 2.0.4 released; website and both downloads verified.**

Current release continuation is recorded in [RELEASE-2.0.4.md](RELEASE-2.0.4.md).
Source `8c1dfcfbb1891979706d63558c90075d50be9722` / tag `v2.0.4` is published;
installer and website publication status is recorded in that release file.
The owner explicitly authorized finishing and publishing via field. Approved OAuth
and Apple notarization configuration have been recovered; the earlier missing-config
blocker below is historical. Installed app and customer data remain untouched.
The sections below preserve the implementation checkpoint, not current release status.

## Read first

The owner authorized “implement it all” after the 2.0.3 post-release swarm audit.
Candidate stabilization plus scoped historical review/evidence/payment-recovery
work is implemented and source-verified. Earlier audit/proposal statements that implementation
was not authorized are historical. They do not mean current code is untouched.
Conversely, implementation authorization and passing source tests are not release
or customer-data mutation authorization.

Read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), [BRAND.md](BRAND.md),
[PRD-2.0.4.md](PRD-2.0.4.md), [VERIFICATION-2.0.4.md](VERIFICATION-2.0.4.md), the
[post-release audit](review/2026-09-24/POST-RELEASE-AUDIT.md) and
[recovery proposal](review/2026-09-24/LEGACY-RECOVERY-PLAN.md).

## Repository and authority

- Candidate checkout: `/Users/lighthouse-control/BillNgai-publish-2.0.3`.
  Its directory name remains 2.0.3; it now contains the uncommitted 2.0.4 work.
- Base HEAD at this handoff: `6647d5bbeb7992fb3384b30b60b1678506511368`.
  **HEAD alone does not identify the candidate.** Capture final diff/hashes and
  reviewed commit only after integration/verification.
- Released 2.0.3 source/tag remains `49595e0567d397a7d334178615205ba41deb8748`
  / `v2.0.3`; see [RELEASE-2.0.3.md](RELEASE-2.0.3.md). Do not move that tag or
  overwrite its installer with new bytes.
- No 2.0.4 commit/tag, installed-app replacement, customer-record change, artifact
  publication, website deployment or remote-tree synchronization is established
  by this implementation checkpoint.
- Preserve the original dirty `Billiong-App` checkout on `field`, all prior source
  backups and unrelated changes. Do not mass-stage, reset, clean, or copy an older
  snapshot over newer work. Do not use the real BillNgai profile for testing.

## Work and coordination

The coordinator integrates/reviews the renderer and version/release documentation.
Native Codex teammates cover main/preload/storage, document/recurring workflows,
reporting and synthetic regression tests. The earlier external agy response was an
audit-stage design critique, accepted only in part; it is not implementation,
test, legal or release approval credit.

Candidate changes map all F01–F16 findings in the PRD: modal lifecycle actions,
durable save/rollback behavior, draft output boundaries, ID handling, preservation,
historical read access, separate archive/void, consistent reports, date/currency
uncertainty, payment grouping, recurrence and split progress. Integration is not
the same as final acceptance; use the verification document's dated results.

Main/preload additions include nested import validation, trusted main-frame IPC,
navigation protection, verified non-expiring pre-2.0.4 copies, close/quit drain and
native evidence APIs. Historical review retains originals; append-only sidecar
events record newly reviewed facts. No historical issuance snapshot is manufactured.

## Important integration contracts

Close and quit use a correlated handshake:

```js
onQuitFlush((_event, { requestId, reason }) => { /* drain renderer work */ });
quitFlushDone({ requestId, ok: true /* false if unsafe */ });
onQuitCancelled((_event, { requestId }) => { /* clear this attempt's closing state */ });
```

`reason` is `quit` or `window`. Stop new mutations immediately, await pending
persists, and ensure issuance is no longer busy before success. Main waits for the
native queue too. A rejected/missing acknowledgment keeps the window open; stale
request IDs cannot authorize a later attempt. No forced destruction on timeout.

Evidence bridge:

- `attachEvidence()` returns `{schemaVersion,sha256,fileName,mime,size,attachedAt}`
  or `null` on native-picker cancellation; no arbitrary paths reach the renderer.
- `evidenceInfo(hash)` returns `{sha256,available:true,mime,size}` or
  `{sha256,available:false}`. **Check `available === true`, not `missing`.**
- `exportEvidence(hash)` exports verified original bytes through a native dialog.
- `exportEvidenceBundle(hashes)` requires the explicit deduplicated hash array.
- `importEvidenceBundle()` restores validated evidence bytes only; it does not
  replace database records or invent links/confirmation events.

Evidence files are local content-addressed copies under the profile's `evidence/`.
Ordinary database JSON does not contain them: back up/restore JSON and the separate
bundle. Review-event imports require structural validation, and receipt execution
must revalidate supported facts, evidence availability and duplicate eligibility.
Hash verification does not authenticate a transaction or certify legal validity.

## Review corrections and verification checkpoint

During integration, independent review caught missing-evidence status mismatch,
omitted bundle hash arguments, and insufficient imported-event/receipt concurrency
validation. The coordinator revised those paths. Stored `renderedHtml` remains
archival text; document rendering rebuilds escaped frozen fields, not injected HTML.

Final coordinator checks: **165/165 automated tests pass**, main/preload/renderer
syntax and whitespace pass, 588 literal translation keys with none missing. The
isolated native source test passes lifecycle buttons, legacy review/payment/new
receipt, real evidence IPC/disk with stubbed picker destinations, TH/EN screens,
draft PDF and save-before-window-close. PDF text and rendered page reviewed.
`VERIFICATION-2.0.4.md` records exact source hashes/artifact paths and unverified
manual/platform/package gates. `npm run release:check` is blocked by missing OAuth
release configuration in this audit checkout; do not invent credentials.

## Safe next steps

1. Inspect current Git status/diff and source hashes before editing. Preserve all
   candidate work and prior audit files; agents have completed their assignments.
2. For further changes, rerun the 165-test suite, syntax/i18n and native source smoke;
   update recorded hashes/results rather than reuse old evidence.
3. Complete remaining manual/native/package acceptance explicitly listed in the
   verification file. Obtain approved release configuration through normal release
   channels before packaging; no need to read or display secret contents.
4. Keep this as a local candidate until release/install authority and acceptance
   gates are satisfied. Do not silently install it on the owner's working profile.
5. For a later authorized release follow `DEPLOYMENT.md`, signing runbook, SKU and
   channel policy. Verify current targets, final stapled bytes and GitHub fallback
   before changing website links; a Git push is not proof of Pages deployment.

Windows/MAS parity, external practitioner review, customer support/refund policy,
case-specific tax-document correction and full security/PDPA assessment are not
completed by this candidate. Cloud/e-Tax/unsupported tax features remain paused.
