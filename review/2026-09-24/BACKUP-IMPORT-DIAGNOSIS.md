# 2.0.4 legacy backup import compatibility defect

Date: 2026-09-24. User requested diagnosis of the named local backup, not repair
or restoration. No application code, installed app, backup or active data changed.
Do not copy customer backup contents into this repository or synthetic fixtures.

## Evidence

- Owner-selected backup basename: `billing-2026-09-23T11-37-52-016Z.json`.
  209,185 bytes; valid JSON; SHA-256
  `81193913e7cada75271cf69db09b1deafcd4e5817b03ed60fa4ae81be5ad5d6c`.
- Filename/mtime-only inspection shows newer backups dated 2026-09-24, including
  `billing-2026-09-24T10-19-53-264Z.json`. Their contents were not inspected here;
  newer timestamp does not establish that they contain the desired records.
- Installed app is 2.0.4. Its packaged `main.js` exactly matches released source.
- Aggregate structure only: 44 clients, 78 document-array entries, no recurring
  entries. 66 entries have supported document types; 12 lack `type` and contain
  only `id`, `deletedAt`, `updatedAt`, `currency`. All 12 have string IDs and
  nonempty deletion/update timestamps. No financial/customer field values logged.
- Running the installed pure `validateData` function on the read-only backup
  throws `DATA_INVALID_SCHEMA` at the document-type allowlist check.
- The renderer's pure `validateRendererData` independently throws
  `DATA_SCHEMA_INVALID` for the same shape.
- A diagnostic **memory-only** subset excluding those markers passes the native
  validator. No sanitized backup was written. This is an isolation check, not
  permission or a recommendation to delete deletion history.

## Cause

The new validators require every document entry to have a supported `type`,
including deletion tombstones. Older `applySyncEvents` explicitly synthesizes
`{ id, deletedAt, updatedAt }` for payload-free delete events. Older migration can
add `currency`. Thus the app rejects its own historical deletion-marker format.
The generic “invalid file” import message obscures this compatibility failure.
This is distinct from intentional legacy tax-document print/export containment.

## Proposed repair — not implemented/authorized by this diagnostic request

Accept a narrowly defined, structurally validated historical deletion marker in
both validators. Preserve its original fields and deletion semantics; do not
invent document type/issuance facts, drop markers or resurrect deleted records.
Audit migration, archive/read-only display, reporting, duplicate detection and
export paths for type-less deleted markers before relaxing validation.

Add synthetic regression fixtures reproducing only this minimal shape (not real
customer data): native load/import/restore/save/reopen and renderer migration;
reject type-less live records, unknown typed records, duplicate IDs, invalid
timestamps and malformed nested records. Verify safe preservation of originals.
Run isolated packaged acceptance before any next release. The 165-test 2.0.4
suite did not cover this old tombstone representation; passing it was insufficient
to establish compatibility with this backup.

Ask for implementation authorization before changing the app. Separately confirm
which backup to restore before any active-data replacement; the selected filename
alone does not prove it is the latest snapshot.
