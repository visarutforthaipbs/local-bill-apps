# Data integrity and SQLite source candidate — 2026-10-04

**Historical candidate checkpoint.** Safe integration is now in `BillNgai-integrated-revamp/`; see [the integrated acceptance matrix](INTEGRATED-DATA-ACCEPTANCE-2026-10-04.md) for current source, tests and remaining release gates. Counts below belong to the earlier candidate.

Implemented in `BillNgai-income-reconciliation/`, branch `codex/data-integrity-sqlite`, based on production 2.0.13 plus the previously prepared pending-receipt display. This is a tested source candidate, **not a released or production-migrated app**. No owner profile, installed app, production coordinator or published installer changed.

## Financial interpretation

- `lib/billing-data.cjs` is the shared structural/domain validator and canonical payment-fact contract. Domain schema 3, replica `syncV3.version=3`, and SQLite `user_version=1` are separate version numbers. Unsupported future versions and malformed version types fail closed.
- Confirmation matching uses record IDs and canonical facts. Object/record insertion order, certificate tracking, `updatedAt`, the migration review flag and the archive display timestamp do not change a payment. Amounts, dates, membership, payment identities and other retained facts do. Evidence snapshots stay unchanged.
- Review events are immutable. A new `legacy_group_review` declares the observed earlier tip IDs in `supersedes`. Conflicting concurrent tips stay pending; equivalent tips count once. A reviewed successor must acknowledge all observed tips. Array order and timestamps never decide income. Dangling/cyclic ancestry stays invalid and uncounted. Dependency checks include source documents and superseded review events.
- Migration copies inputs, retains unknown fields and tombstones, and does not add current-time stamps or expire old evidence. It never invents payments or adjusts real income to hit a target.
- Before activating the interpretation, the UI displays old/new **received, receipt evidence awaiting review, and conflicted amounts**, by currency, plus affected document groups. Conflicted amounts are a subset of pending, not extra cash. Pending receipt evidence can contain duplicates and is not confirmed income. The previous interpreter is used only for this comparison. A backup must succeed before activation; ordinary persistence/silent sync are held meanwhile.

## Validation compatibility

The shared validator rejects unsupported live statuses, present negative/nonfinite/null line amounts, invalid nested shapes, malformed review/reissue evidence and false deletion-marker impersonation. Missing/null `deletedAt` does not bypass validation.

Desktop deliberately retains historical envelopes with missing status/items/line particulars; it does not invent originals. iOS preserves its **previous stricter live-document requirement** using `strictLiveDocuments:true`: supported status, an items array, string descriptions, finite nonnegative quantity/price, with both absent and null deletion treated as live. This is an intentional host compatibility difference, **not identical acceptance of every legacy envelope**. Structurally valid type-less deletion markers and retained deleted evidence remain supported. Incomplete live desktop history may require explicit review before mobile acceptance; do not silently fabricate missing particulars or weaken the mobile boundary.

## Local storage and recovery

Desktop uses Node/Electron's built-in SQLite. iOS uses system SQLite3 and JavaScriptCore to execute the exact bundled shared validator. No replacement financial ledger or extra desktop native package was introduced. Each local database stores the complete workspace JSON, revision and initialization/origin metadata. Billing records, replica, cursor, conflict state and outbox therefore commit together.

JSON-to-SQLite migration validates and backs up first, retains exact JSON unchanged, preserves unknown fields, fingerprints the original default/external JSON, and rejects later writes by an older JSON app. Origin identity is also recoverable from local safety metadata. Stale revisions compare inside `BEGIN IMMEDIATE`. Missing initialized files, damaged SQL, future SQL/domain versions and symlinks do not become fresh profiles.

JSON remains portable backup/import/export; **SQLite files never sync through Drive**. External raw-file linking/moving is hidden for SQLite storage. A reviewed recovery can restore missing/corrupt SQLite, preserve raw database/journal/WAL bytes before opening SQLite, keep JSON backups, re-establish a reviewed origin baseline, and verify a staged replacement. It cannot bypass an intact sync binding, an unknown binding safety state or a future schema. Native safety mirrors record binding before a bound commit and clear it only after a successful unbound commit. Interrupted recovery blocks ordinary loading; explicit recovery remains available. Failed replacement preserves the original evidence and restores sidecars. No ordinary-load fallback to JSON exists.

## Cross-device compatibility rollout

The coordinator adds authenticated capability 4 and a permanent per-workspace minimum client protocol. Header `X-BillNgai-Protocol: 4` is required after a successful `POST /v3/protocol/upgrade`; old clients are blocked on data reads and writes. Replica record/log format remains v3 and the same Google workspace is retained.

Desktop/mobile transports require explicit local consent before this irreversible upgrade, verify capability/minimum, and fail closed on older servers. Offline drafts remain local; online review/issuance preflight happens before writing a pending intent. The UI explains that older Mac, PC and iPhone clients will stop syncing, including reading. Silent sync cannot grant consent. Deploy the backward-compatible service capability first, distribute all supported clients, then perform the reviewed workspace upgrade. Do not activate the production workspace from source QA.

## Final evidence

Evidence directory: `~/.local/state/billngai-data-implementation-2026-10-04/final-evidence/`.

| Check | Result |
|---|---|
| Desktop automated suite | 300/300 passed |
| Mobile JavaScript/bundle suite | 41/41 passed |
| Coordinator tests | 25/25 passed |
| Coordinator type check / Wrangler deployment dry run | Passed; no deployment |
| Native Swift store / editor recovery | 52 + 31 synthetic assertions passed |
| Electron isolated native workflow | Upgrade preview/backup activation, review validation, save, reload, unchanged originals, unique income, TH/EN passed |
| Three durable-device simulation | Separate SQLite profiles; conflicting answers preserved/pending; explicit successor converges; replay never duplicates income |
| Unsigned Release iOS build | Passed; no installation/submission |
| Preservation | Original development baseline hashes and owner's JSON hash unchanged |

The three-device test runs synthetic profiles on this Mac. It is **not** a live two-Mac/Windows/iPhone Google OAuth or native Windows acceptance claim. `ssh pc` still timed out at final retry. Physical iPhone accessibility, mobile Google OAuth/Pro continuity and signed release acceptance remain separate gates.

Five scoped MiMo Pro implementation/review jobs timed out without final output or proposals. Manifests/responses/diffs/stderr were inspected; no worker result was accepted and no quota/context diagnosis was inferred. Codex implemented and validated the candidate locally.

## Next release/integration work

1. Review/integrate this candidate into the active development/MAS/mobile changes without replacing their renderer or source tree wholesale. `BillNgai-development/` was intentionally not edited; its baseline hashes are preserved. The candidate's `mobile/` is an isolated source snapshot for native build verification, not a replacement of that active project. Older copied mobile audit documents record prior work, not this candidate's acceptance.
2. Rebuild Mac/MAS/Windows/iOS release artifacts against the integrated source. Verify native Windows SQLite and physical iPhone workflows, current UI/accessibility, Google OAuth, Pro verification and real cross-platform sync with isolated test accounts/profiles.
3. Deploy the reviewed backward-compatible coordinator capability, update clients, disclose/approve its permanent minimum-client upgrade, and run the live synthetic account acceptance matrix.
4. Only then schedule an explicitly reviewed owner-profile migration and final release. No real profile (including a copied real profile) was used as a runnable migration fixture here. The separately reconciled owner's [owner total redacted] remains unchanged; unresolved historical groups were not reclassified.
