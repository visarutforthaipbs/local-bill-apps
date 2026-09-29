# Owner-directed 2.0.9 release

**Installed 2026-09-29:** private signed/notarized universal 2.0.9 at `/Applications/BillNgai.app`. Public release remains 2.0.4.

Owner authorized building the completed UI, audit fixes and corrected receipt workflow as the next release. Following the established private-release process: local release commit, Developer ID signing, Apple notarization, exact-artifact validation, rollback backup, and local installation. No public push/tag, downloads, website changes, customer messages, MAS or Windows submission.

## Scope

- Original orange accent and cream canvas; compact document rows, clear header actions, six primary destinations, consistent address fields.
- Safer historical payment review, certificate tracking, draft recovery and backup controls.
- Backed-up, confirmed ordinary receipt corrections with frozen details, original references and shared receipt numbering; no duplicate income.
- A4 print layout keeps correction signatures on the same page.

Earlier source-only records: `AUDIT-FIXES-VERIFICATION.md`, `FINTECH-UI-VERIFICATION.md`, `RECEIPT-REISSUE-VERIFICATION.md`. Their no-build statements describe earlier checkpoints, not this release.

## Validation and artifacts

- Source commit `c1fdd8c88b00db160e88ca446d5c723a784845ca` (local only). 203/203 unit tests; inline/main/preload syntax, translation keys, release configuration and whitespace checks pass.
- Developer ID team `79QFYKTJMN`, hardened runtime, universal x86_64 + arm64. Deep/strict signature passes; app and DMG Gatekeeper results are `Notarized Developer ID`.
- Apple submission `15defe94-fb58-434a-ac45-729c69716f6f`: Accepted, no issues. Stapled and validated.
- Final DMG: `dist/2.0.9/BillNgai-2.0.9-universal.dmg`, 223,551,892 bytes. SHA-256 `687b3e692d3678e32d4d5bf64bb58f0a938e10a3262af9ece2ad399fa788d17e`. Copy retained in the update folder. Blockmap and latest metadata regenerated after stapling; no auto-updater or public upload.
- All 17 packaged source files match the commit; packaged identity and OAuth valid. app.asar SHA-256 `9fe27019188038e65ccfbac47ae44ace89c2be959ad9f4149597a1dee27fea1a`.
- Seven suites pass against the exact executable on a read-only mount of the final DMG: packaged recovery/receipt smoke, corrected receipts, audit design fixes, fintech UI, legacy review, payment matching, and stabilization/close drain. All use isolated synthetic profiles. Final synthetic receipt PDF is one A4 page and visually checked; document list retains the approved orange/cream appearance.
- Disposable owner-data copy: all 79 documents and 27 review events preserved; ten corrected receipts, seven payment matches, twelve unresolved groups and confirmed net THB 52,100 unchanged. Sixteen language/view states and all records render; save/reload passes. Live source unchanged.
- Original development app quit normally before installation. Full current profile backup verified: 86 entries, byte-identical. Previous app copied and verified, then retained on replacement. Installed app matches every file/symlink in the final mounted app; signature and Gatekeeper pass.
- Backup directory: `/Users/lighthouse-control/BillNgai-update-2.0.9`, including `profile-before-update`, `BillNgai-2.0.8-installed.app`, `BillNgai-2.0.8-original.app`, final DMG and private backup manifest.
- Source/build/notarization/test evidence: `review/2026-09-29/release-2.0.9/`. Private owner-profile evidence stays outside Git at `~/.local/state/billngai-release-2.0.9/`.
- MiMo release review timed out with `unrecognized_model`, no observed model or findings. Manager rejected the empty result, completed local review and ran the validation; see the recorded worker disposition.
- Hardware-tested on this Apple Silicon Mac. Intel hardware, Windows, MAS and live cloud sync/Drive are not claimed.

## Installed live-profile check

Installed 2.0.9 opened the exact owner profile, loaded all ten corrected receipts, and quit normally with `billing.json` byte-identical before/after. Relaunched normally and left open. No review groups were answered during this release.

## Rollback

Retain the prior installed app and full current profile before replacement. Never overwrite newer customer data with an earlier backup. Older versions do not expose or protect corrected receipts; use 2.0.9 for ongoing work after the new correction events exist.
