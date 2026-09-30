# Owner-directed 2.0.10 release

**Installed 2026-09-30:** private signed/notarized universal 2.0.10 at `/Applications/BillNgai.app`. Public release remains 2.0.4.

Owner asked to install 2.0.10 on this Mac and clean up older versions. Established private-release process: local release commit, Developer ID signing, Apple notarization, exact-artifact validation, rollback backup, local installation. No push/tag, downloads, website change, customer message, MAS or Windows submission.

## Scope

2.0.9 plus the pre-publish audit fixes and the seller-color fix, built from the separate worktree `BillNgai-release-2.0.10/` (branch `release/2.0.10`). The Google Drive sync v3 pilot is **not** included. Details: `PREPUBLISH-FIXES-VERIFICATION.md`, `RELEASE-2.0.10.md`.

## Validation and artifacts

- Source commit `f99b500f047938f92d5d683d97d12d6a85540baf` (local only). 211/211 unit tests; inline/main/preload syntax, all 757 translation keys, release configuration and whitespace checks pass. Source storage smoke passes.
- Developer ID team `79QFYKTJMN`, hardened runtime, secure timestamp, universal x86_64 + arm64. Deep/strict signature passes; app and DMG Gatekeeper results are `Notarized Developer ID`.
- Apple submission `d3b6736a-e7f2-4eba-9b0a-23f3ee74c226`: Accepted, “Ready for distribution”, no issues. Stapled and validated.
- Final DMG: `dist/2.0.10/BillNgai-2.0.10-universal.dmg`, 223,535,003 bytes. SHA-256 `f960e8947b8e9f1efac0f1d7e665c5b68c38eb8abcb6a9eb62159f1aee5e7d23` (computed after stapling; `.sha256` file alongside). Identical copy in the update folder. The blockmap predates stapling and no `latest-mac.yml` was generated; there is no auto-updater or public upload.
- All 17 packaged source files match the commit; packaged identity and OAuth valid. app.asar SHA-256 `b13ccbb481ca5441b724dc268addb3cd5faa8b779891a4e46e6d62fb3a0f02be`.
- Nine suites pass against the exact executable on a read-only mount of the final DMG, each with an isolated synthetic profile: packaged recovery/receipt, corrected receipts, design fixes, fintech UI, legacy review, payment matching, stabilization/close drain, seller colors, and the new first-day flow (setup → quotation checklist → invoice → payment → inline VAT answer → receipt → pending WHT card).
- Source upgrade test: a profile built by the real 2.0.4 code opens in 2.0.10 with frozen documents, legacy originals, numbering and income preserved, and still opens in 2.0.4 afterwards.
- No disposable owner-data copy test was run this time (not separately authorized).
- 2.0.9 quit normally before installation. Full current profile backup verified: 86 files, byte-identical (hash manifest). Previous app copied with ditto and its signature verified. Installed app matches every file in the mounted final app; signature and Gatekeeper pass.
- Backup directory: `/Users/lighthouse-control/BillNgai-update-2.0.10` — `profile-before-update`, `BillNgai-2.0.9-installed.app`, final DMG, `backup-manifest.json`.
- Evidence: `review/2026-09-30/release-2.0.10/`.
- Hardware-tested on this Apple Silicon Mac only. Intel hardware, a clean Mac, Windows, MAS and live Drive sync are not claimed.

## Installed live-profile check

Installed 2.0.10 opened the owner profile and quit normally with `billing.json` byte-identical before/after. Relaunched and left open. No documents were issued and no settings were changed during this release.

## Cleanup (owner-selected “old apps/installers”)

Moved to `~/.Trash/BillNgai-cleanup-2026-09-30/` (recoverable until the Trash is emptied), about 9.1 GB: app copies 2.0.4–2.0.8 from the update/recovery folders, DMGs 2.0.2–2.0.9 duplicates (update folders, recovery folder, `release-artifacts-2.0.3`, Downloads), and build outputs `dist/2.0.7*`, `dist/2.0.8*`, `dist/2.0.9-staging`, `dist/control-readiness`, `dist/2.0.10-staging`. The replaced `/Applications` 2.0.9 app is also in the Trash; its verified copy is in the backup directory.

Kept: every `profile-before-update` / `profile-before-restore` customer-data backup, the 2.0.9 rollback app (update-2.0.10 folder) and DMG (`BillNgai-development/dist/2.0.9`), the 2.0.4 public-release artifacts, all source folders, bare Git repositories, migration backups and website working folders.

## Rollback

Quit normally and preserve the current profile first, then restore `BillNgai-2.0.9-installed.app` from the backup directory. 2.0.10 adds no new stored record types, so 2.0.9 reads 2.0.10 data; a VAT answer given in 2.0.10 stays valid. Never overwrite newer customer data with an older backup, and never run two versions against one profile.
