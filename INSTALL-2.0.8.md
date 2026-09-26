# Owner-directed 2.0.8 installation

**Completed 2026-09-27:** private signed/notarized 2.0.8 installed at
`/Applications/BillNgai.app`, verified and left open. Previous 2.0.7 app and full
current profile retained in `/Users/lighthouse-control/BillNgai-update-2.0.8`.
Public release remains 2.0.4.

Owner authorized building the old-record review as 2.0.8 ("DO IT") after asking for a
cleaner app without repeated old-document repair buttons. Scope and source checks:
[LEGACY-REVIEW-2.0.8.md](LEGACY-REVIEW-2.0.8.md). This authorizes the local commit,
signed/notarized private build and installation; not publication, push/tag,
R2/website changes, customer messages, or answering the owner's review groups.

## Source and build

- Reviewed commit `48940b007ba9acbbf534e349cbc91f5bb657d0d4` (local only).
  190/190 tests, `release:check`, syntax, whitespace and 698 translation keys pass.
- Universal Developer ID build (79QFYKTJMN), hardened runtime, x86_64 + arm64;
  deep/strict signature passes. 17 packaged files match the commit; OAuth valid.
  `app.asar` SHA-256 `5c2bf30cc2cdcc9d60edd683c32c6aef79fefb6975f4b268213648ea583e0f8e`.
- Apple submission `6765e334-4aa4-431b-899a-0a3ac77611b3`: **Accepted**, issues `null`;
  log `review/2026-09-27/notarization-2.0.8.json`. Stapled, validated; DMG Gatekeeper
  `Notarized Developer ID`.
- Final DMG **223,544,960 bytes**, SHA-256
  `1bf781c129bf69493c9382181574516f5b868acfddb93a93188152986aaa5538`; copy in the
  update folder.

## Exact-artifact checks (read-only mounted final DMG)

Signature and Gatekeeper pass; source comparison repeated and passes. Packaged
suites on synthetic profiles: release smoke PASS, old-record review
(`billngai-legacy-review-kHe4ou`), stabilization (`billngai-204-native-YrtKW5`),
payment matching (`billngai-payment-match-vFGRMu`). The same suites also passed on
the staged app before notarization.

## Owner data

- 2.0.7 quit normally. Full profile copied to `profile-before-update`; 80 regular
  files byte-identical. billing.json SHA-256 at capture
  `a9e8b4f79119375220eb4a8e5696c75885c52ff823d78e9d50ac573f54ef5312`; 44 clients /
  79 document entries / 48 not deleted / 12 deletion markers / 7 payment matches.
- Preservation check on a private temporary copy (sync token excluded), final mounted
  2.0.8 executable: no load failure; 16 TH/EN views and all 79 document views without
  errors; every original field preserved after save/reload; 7 matches still counted;
  12 unresolved groups listed on the review screen; empty pair card gone and one to-do
  line shown; source unchanged; copy deleted. Counts/booleans only were printed.
- Installed from a verified staging copy; previous app kept as
  `BillNgai-2.0.7-installed.app`, plus a verified copy `BillNgai-2.0.7-original.app`.
  Installed version 2.0.8; signature valid; Gatekeeper `Notarized Developer ID`.
- Launched on the owner profile and quit normally: billing.json byte-identical to the
  capture; no new backup/journal files. Relaunched and left open.
- None of the 12 groups was answered. That is the owner's decision in the app.

## Rollback

Quit normally, preserve the current profile first, then restore
`BillNgai-2.0.7-installed.app`. 2.0.7 still loads 2.0.8 data after answers are saved
(verified: 2.0.7's `main.js` from `ba1f5a1` recovered and reloaded a synthetic file
with a `legacy_group_review` event); it ignores the answers, so groups show as
unresolved again until 2.0.8 is back. Never restore an older database over
newer work; do not run two versions against one profile.

## Not claimed

No public release, push, tag, R2 or website change. No Intel-hardware, Windows, MAS,
VoiceOver or real-user usability verification.
