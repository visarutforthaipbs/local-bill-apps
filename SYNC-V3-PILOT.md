# Google Drive sync v3 — private pilot, 2026-09-29

Status: implemented in source for isolated development testing. **Not enabled in
installed 2.0.9, not released, not deployed, and not validated against live Google
Drive or two physical Macs.** Existing cloud journals and the real billing profile
have not been modified. This is not a declaration that Pro sync is production-ready.

## User workflow

- Settings → Data contains one Google Drive card, only when the development service
  URL is explicitly configured. Pro is checked before connecting.
- Drafts stay editable offline. Issuance reserves an online number before freezing
  the paper. The native save path commits financial changes online.
- Unknown finalization outcomes remain pending in the same atomic billing file.
  They are invisible to income reports until acknowledged. Other drafts remain
  editable; another financial finalization waits for the pending result.
- Conflicts preserve both versions across restart. Related transaction records stay
  together. Draft conflicts permit a local choice; issued facts are never silently
  rewritten. Resolution history retains both variants.
- A second device must start with an empty isolated profile. An existing local
  workspace is never automatically merged/replaced during connection.
- Attached evidence binaries still require the existing separate evidence bundle
  transfer. This is disclosed in the pilot card; reference metadata is synced.

## Storage and coordination

`lib/sync-v3*.cjs` implements replica transitions, durable outbox orchestration,
billing projection/immutability, bounded Drive transport and the native controller.
`main.js` stores replica metadata in `billing.json` with the corresponding visible
records, using existing locking, atomic replacement and backup mechanisms. Native
IPC rejects stale renderer revisions and local records changed outside the replica.

Google Drive stores immutable JSON payload files in **BillNgai Workspace v3**.
The old monthly journal protocol remains disabled, including all legacy mutation
IPC. It cannot overwrite the new workspace.

`services/sync-coordinator` is a separate Cloudflare Worker/SQLite Durable Object
service. Each verified Google subject has an isolated object. It holds opaque IDs,
revision/content hashes, Drive file IDs, counters, reserved numbers, claim IDs and
operation results. It does not receive customer document payloads. Token verification
checks signature, issuer, audience and expiry. A private subject allowlist is required;
empty configuration denies access. Account-bound requests reject account switching.

A commit checks every base revision before changing any head. Commit, claims, heads,
operation deduplication and sequence-log append are one SQL transaction. Stable
operation IDs make lost-response retries idempotent. Issued seals and review-event
hashes cannot be replaced. Payment/receipt/correction uniqueness claims prevent
conflicting records from being separately admitted.

Number reservations never expire or get reused. Bootstrap imports existing issued
numbers (including corrected receipts/retained records), counter floors and higher
known issued sequence values. Number formatting uses the existing prefix/year/padding;
sequence identity uses document type + calendar year, including across format changes.
A failed/cancelled issuance can leave a reserved gap; it never renumbers an issued paper.

## Local verification

- `npm test`: 234 app tests passed at this checkpoint, including 31 new sync tests.
- Coordinator: 18 Workers-runtime tests passed, including two billing replicas using
  the actual Durable Object protocol, concurrent payments, concurrent reservations,
  counter floors, atomic rollback, JWT rejection, account isolation and idempotency.
- Native handler tests use real main-process handlers/storage with synthetic
  transport; transport HTTP tests use stubbed responses. They are not live Drive tests.
- Native Electron pilot UI smoke passed with a separate temporary synthetic profile:
  Thai/English pilot controls, Pro gating, conflict dialog and no page errors.
- Existing seller-color native smoke passed; issued snapshots and app palette retained.
- Type checking, Worker deployment dry-run, release configuration check and diff checks
  passed. No deployment was performed. MiMo review timed out without output; no MiMo
  proposal was accepted. Codex implemented and validated the changes directly.

Evidence is in `review/2026-09-29/sync-v3/`. Native smoke screenshots contain only
synthetic names. No customer profile/credentials were sent to the worker or tests.

## Live test status (2026-09-30)

First live two-Mac test (lighthouse-control + lighthouse-field, private staging service, owner-approved
test Google account) passed join, concurrent edit, concurrent numbering, payment, kill-during-issuance
and double payment. Its findings and audit P1-3 are fixed and re-verified live. Details:
`review/2026-09-30/sync-v3-live/SYNC-V3-LIVE-TEST.md`. Items 1–3 below are partly done; token refresh
after one hour, account-mismatch, network loss and populated-device onboarding remain.

## Required before real use

1. Select a separate Google test account and configure its verified subject allowlist
   plus the existing Desktop OAuth audience in a private staging deployment.
2. Exercise fresh OAuth consent and token refresh, Drive uploads/downloads, new-device
   joining and account-change rejection on lighthouse-control and lighthouse-field,
   using isolated profiles only. Interrupt network and app processes at commit boundaries.
3. Complete native end-to-end issuance/correction/payment testing against that deployed
   service, including retries from the actual editor, concurrent numbering and conflict
   resolution. Local handler tests do not substitute for this.
4. Review onboarding for an already populated second device, bootstrap size (currently
   capped at 512 records), setup-race recovery, evidence binary transfer and release
   access/Pro entitlement policy. Current allowlisting is a pilot policy, not public
   licensing. Import/restore/detach while a sync workspace is bound needs explicit UX
   and further acceptance testing before public exposure.
5. Final review of service operations, backups/restore, pricing/privacy disclosures and
   staged rollout. Package/sign/notarize only after acceptance. No version bump yet.

## Developer commands

Use synthetic profiles only. Do not launch a configured pilot against the owner profile.

```sh
npm test
npm ci --prefix services/sync-coordinator
npm run types --prefix services/sync-coordinator
npm run check --prefix services/sync-coordinator
npm test --prefix services/sync-coordinator
npm run dry-run --prefix services/sync-coordinator
NODE_PATH=/Users/lighthouse-control/.config/billngai/test-tools/node_modules node test/sync-v3-electron-smoke.cjs
```

The app-side gate is `BILLNGAI_SYNC_V3_URL=https://<approved-staging-host>` and
`!app.isPackaged`. The service ships with blank audience/allowlist, workers.dev
and preview URLs disabled. No account identifiers or tokens belong in source.
OAuth refresh tokens remain protected by macOS safeStorage; token writes now fail
when encryption is unavailable rather than falling back to plaintext.

References: [SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/),
[Workers guidance](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/),
[Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect),
[installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[Drive upload API](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
