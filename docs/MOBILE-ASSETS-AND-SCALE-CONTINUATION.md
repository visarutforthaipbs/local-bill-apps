# Remaining mobile asset/scale work — 2026-10-04

This is implementation guidance, not completed functionality. The candidate's
public-mobile PRD cannot pass while evidence bytes need manual bundle transfer
and setup rejects more than512 records. Do not submit these limitations as if
all platforms already provide the complete workspace.

## Existing mechanisms to reuse

- `main.js` evidence store: immutable SHA256-named local bytes,20MiB per file,
  actual PDF/PNG/JPEG magic checks, hash verification and safe native export.
  Review-event evidence metadata already contains hash, size, MIME and display
  name. Evidence is added before the immutable review decision is sealed.
- Business logo/signature/stamp are currently embedded in replicated business
  and frozen snapshots. They already travel with JSON; do not falsely claim all
  logos fail to sync. Repeated embedded images can dominate workspace size.
- Drive holds immutable JSON payloads. Coordinator holds root, revision/head
  hashes, file IDs, number claims and entitlement/account metadata. It must never
  become a customer billing-payload database.
- Local cursor/outbox/conflicts and domain facts commit together in SQLite.
  Asset caches may be separate because their availability does not change ledger
  facts; verify references/hashes before use. Missing assets remain explicit,
  retryable and recoverable, never silently deleted or substituted.

## Asset implementation boundary

1. Introduce a versioned immutable asset reference contract, narrowly supporting
   reviewed file types, size limits and content hashes. Retain existing evidence
   identity/metadata and unknown fields. A file hash does not prove authenticity.
2. Reuse authenticated Drive root/OAuth and existing account/Pro/protocol4 gates.
   Publish immutable bytes and verified metadata; root/account substitution,
   arbitrary outbound URLs, metadata-only fake success and hash mismatches fail.
3. Add portable native cache/transfer operations on desktop and iOS, with bounded
   streaming, same-content deduplication, durable resume checkpoints and explicit
   retry/cancel. Never expose native paths, keys or arbitrary networking to shared
   document HTML. Native PDF/OS sharing handles binary output.
4. Keep authored A4 preview and frozen original HTML. If issued PDF bytes are to
   be shared, bind their archived reference to the exact sealed snapshot, preserving
   the first archived output; do not rewrite old originals or imply a freshly
   generated PDF is an original archival byte copy. Decide this binding before
   implementing PDF transport rather than bolting it onto the receipt amounts.
5. Portable backups must include an asset manifest and necessary verified bytes,
   or explicitly disclose that a JSON-only export does not include attachments.
   Bound-workspace restore cannot overwrite cloud heads wholesale.
6. Test actual byte-for-byte transfer/retry on control Mac, MAS, field Mac,
   Windows, iPhone and iPad using synthetic PDF/images. Cover partial upload,
   interrupted download, deleted/corrupt Drive object, offline viewing, account
   switch, checksum failure, protected destinations and incomplete backup.

## Large workspace implementation boundary

MiMoPro review20261004-120605-5mh9iun5 is reviewed, with manager corrections:

- Preserve protocol4 minimum-client consent/gating. Do not downgrade it to3.
- Current upload progress is already durable and resumed per immutable file;
  coordinator initialization is already one atomic, idempotent transaction. Reuse
  these mechanisms before adding a staged/chunk protocol.
- Increasing512 to2048 alone is insufficient: request body512KiB can reject the
  eventual metadata after all files were uploaded. Ordinary dirty sets beyond512
  also remain unsyncable. Budget encoded **UTF-8 bytes**, not JS string length.
- Keep dependent invoice/receipt/review decisions together. Any ordinary batching
  must choose dependency-complete groups and never expose half a financial action.
- Review bounded pull-page byte size and16MiB response bounds, including the one
  indivisible initial transaction; cursor advances only after complete validation.
- Duplicate sealed number/claim enforcement already exists in `Workspace.apply`
  and rolls back atomically; do not duplicate or weaken it.
- Measure local64MiB aggregate guard with real frozen snapshots, repeated images,
  records/head state and pending copies. Network count/byte changes alone do not
  prove the PRD's1000documents/500clients/100assets baseline fits or performs well.

Acceptance requires the complete representative baseline, interrupted bootstrap
resume, racing first devices, setup failures retaining local originals, unchanged
financial totals and idempotent replay. Record actual package/source identity and
rebuild affected channels after shared protocol/storage changes.

## 2026-10-07 status: record-count scale implemented; embedded images are the real ceiling

Implemented and tested (source only, synthetic data; no deployment):

- `S.prepare(s, metadata, related)` budgets coordinator metadata in UTF-8 bytes with a
  worst-case 128-character file id **before any upload**. First upload (`mode:'initializing'`,
  pristine replica) stays one atomic operation: at most 4,096 changes and 768 KiB, else
  `SYNC_BOOTSTRAP_TOO_LARGE`. Ordinary sets above 512 changes / 480 KiB go out as whole
  dependency groups (`B.related`); one group larger than an operation fails with
  `SYNC_BATCH_TOO_LARGE` while unrelated records still progress.
- `SyncSession.sync()` sends up to 16 operations per call, transfers six files at a time,
  saves attached file ids after every third group instead of every upload, and continues from
  the state the host actually stored (the controller settles a finalization while saving).
  A pull uses identical local content instead of downloading it again.
- Coordinator: `validateCommit(value, max)`; initialization accepts 4,096 changes and an
  800 KiB body on `/v3/initialize` only; every other route keeps 512 changes / 512 KiB. Pull
  pages stop at 8 MiB of metadata without splitting a transaction. The first-upload ceiling
  comes from the Durable Object storing request and result in one row (about 2 MB); storing a
  request digest there is the upgrade path if roughly 2,000 issued documents is ever too few.
- Desktop and mobile connect use the same `S.prepare` preflight before OAuth; iOS allows the
  larger body only for `initialize`.

Measured with `scale-measure.cjs` (private evidence, synthetic records, stub transport):
1,000 documents + 500 clients without images now complete a first sync (1,501 records, one
operation, 98 saves). 150 records previously took 155 saves and 240 MB of writes; now 14 saves
and 20 MB.

Measured live on 2026-10-07 (synthetic QA workspace, real Drive and QA coordinator): 520 changes
are two operations (512 + 8). Sequential transfers took about 1.4 s per uploaded record; with
six parallel transfers Windows uploaded 520 edits in 213 s and each Mac pulled them in about
110 s. A 1,500-record first upload is therefore roughly ten minutes, not yet measured live.

**Not solved, and more urgent than the record count:** every issued document stores the
business logo and signature twice (`issuedSnapshot.business` and again inside
`issuedSnapshot.renderedHtml`). `pickAsset()` has no size cap or resize. With an 87 KB logo and
26 KB signature each issued document is about 225 KB, so:

- 100 issued documents make a 22 MB workspace, 44 MB once connected (records are also held in
  the replica) and 66.6 MB while the first upload is pending: over the 64 MiB save guard.
- Without sync the same guard is reached near 290 issued documents. Public 2.0.13 has the same
  guard and the same snapshot shape.
- The 8 MiB per-record upload bound is reachable with a multi-megabyte logo.

**Resolved for business images on 2026-10-07 (owner approved):** new issued originals refer to
`asset:<sha256>` entries in the workspace's `assets` map; the shared validator verifies every
entry against its hash and refuses a reference to a missing image; stored images sync as
immutable `asset:<hash>` records placed first in an operation; chosen images are scaled down.
Old snapshots stay byte-for-byte as issued. Measured: 1,000 issued documents with an 87 KB logo
and 26 KB signature are a 5.4 MB workspace (17 MB peak during first sync). See the root handoff
for tests and the rollout rule (only a coordinator built from this tree accepts `asset:` keys).

Still open from the asset section above: evidence attachments and archived PDF bytes are not
transferred between devices; that needs binary transfer, not this reference scheme.

Read the newest root handoff before starting. Owner data/originals remain preserved;
use isolated synthetic profiles only. No production capability change, old-client
cutoff or owner migration may be inferred from this design document.
