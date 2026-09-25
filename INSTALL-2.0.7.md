# Owner-directed 2.0.7 installation

**Completed 2026-09-26:** private signed/notarized 2.0.7 installed at
`/Applications/BillNgai.app`, verified and left open. Original 2.0.6 app and full
current profile retained in `/Users/lighthouse-control/BillNgai-update-2.0.7`.
Public release remains 2.0.4.

2026-09-25: owner asked to "make it as our 2.0.7 and install into this mac and test
it", after the Option A cleanup and the UI/UX audit fixes. This authorizes the local
commit, signed/notarized private build and local installation, not public
publication, Git push/tag, R2/website changes or customer messages.

## Source

Reviewed source commit `ba1f5a122ea1ae59809b2ae8710c6676a9835335` on
`codex/control-development` (local only). Scope and source checks:
[UX-AUDIT-VERIFICATION.md](UX-AUDIT-VERIFICATION.md),
[OPTION-A-VERIFICATION.md](OPTION-A-VERIFICATION.md), CHANGELOG 2.0.7.
After the version bump: 182/182 tests, `release:check`, `git diff --check` and the
source stabilization smoke passed (`billngai-204-native-TNqfvU`).

## Build and notarization (lighthouse-control, Apple Silicon)

- `electron-builder --mac --dir --universal` then `--mac dmg --prepackaged`, per
  `DEPLOYMENT.md`; Developer ID Application: Visarut Sankham (79QFYKTJMN),
  hardened runtime, x86_64 + arm64. Deep/strict signature passes.
- All 17 packaged tracked files match the commit; package identity and embedded
  OAuth validation pass. `app.asar` SHA-256
  `ce92a71d332f28874c15d4f9b23c4921bbe8aff6d4ef3301e78f57a1c526b0ab`.
- Apple submission `6d04c22f-02a0-4e1b-bff0-0888d731656f`: **Accepted**, "Ready for
  distribution", issues `null`; log in `review/2026-09-26/notarization-2.0.7.json`.
- Stapled and validated; Gatekeeper accepts the DMG as `Notarized Developer ID`.
- Final DMG: **223,547,915 bytes**, SHA-256
  `6fcd88040e7d9e36a1d934472f290c9272514c8cbc91e6f9708fe86fa594ecbc`.
  Copy retained in the update folder. Pre-staple blockmap/latest metadata unused.

## Exact-artifact checks

Read-only mount of the final stapled DMG: app deep/strict signature and Gatekeeper
(`Notarized Developer ID`) pass; 17-file source comparison repeated and passes.
Packaged native suites against the mounted executable, synthetic profiles only:
release smoke (PASS), stabilization (`billngai-204-native-LXWBqe`), payment matching
(`billngai-payment-match-YbuUV2`). Earlier runs against the staged app also passed
(`billngai-204-native-5oNp0f`, `billngai-payment-match-dN6WJI`), plus the session
UX end-to-end script (keyboard switch, issue/confirm/Escape, draft, Undo, reopen,
crash-draft restore, settings save on leave, 940px layout, no page errors).

## Owner data

- Installed 2.0.6 quit normally via its own quit path. Full profile copied to
  `BillNgai-update-2.0.7/profile-before-update`; 77 regular files byte-identical.
  billing.json SHA-256 at capture
  `ad415c79d8912ec772abca7d905c8abed69013235ea3aae6ac36053543a4aba2`;
  44 clients / 78 document entries / 47 not deleted / 12 deletion markers /
  0 review events / 0 recurring (same counts as the 2.0.6 record).
- Preservation check on a private temporary copy (sync token excluded) with the
  final mounted 2.0.7 executable: no load failure; 16 TH/EN views and all 78 document
  views opened without errors; every original field preserved after save/reload;
  dashboard flags incomplete received total with the pending-payment card; source
  file unchanged; temporary copy deleted. Only counts/booleans were printed.
- Installed from a verified staging copy. Previous installed app preserved as
  `BillNgai-update-2.0.7/BillNgai-2.0.6-installed.app`, with a separate verified copy
  `BillNgai-2.0.6-original.app` (version 2.0.6, signature valid).
- Installed app reports 2.0.7; signature valid; Gatekeeper `Notarized Developer ID`.
- Launched on the owner profile, quit normally: billing.json byte-identical to the
  captured baseline; all top-level values deep-equal; no new backup/journal files.
  Relaunched and left open. No payment match, correction event, issuance or other
  data action was performed.

## Rollback

Quit normally, preserve the current profile first, then restore
`BillNgai-2.0.6-installed.app` to `/Applications/BillNgai.app`. Data remains
compatible (no schema change in 2.0.7). Never automatically restore an older
database over newer work; do not run both versions against the same profile.

## Not claimed

No public release, tag, push, R2 upload or website change. No Intel-hardware,
Windows, MAS, VoiceOver or real-user usability verification. At a future public
release, update FAQ/DELIVERY/website/LINE guidance that still says
"ตั้งค่า → พื้นที่ทำงาน" (now "ข้อมูลและสำรอง").
