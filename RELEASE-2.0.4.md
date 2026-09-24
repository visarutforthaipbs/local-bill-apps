# BillNgai 2.0.4 — release record

Updated 2026-09-24. **Mac Direct 2.0.4 released and production website verified.**

## Authority and source

Owner explicitly authorized finishing the signed/notarized installer and publication,
using `ssh field` and the successful 2.0.3 release setup. This supersedes the earlier
implementation-only authority checkpoint. No customer profile, installed app, or
original dirty checkout is authorized for test mutation.

Source checkout: `/Users/lighthouse-control/BillNgai-publish-2.0.3`.
Remote candidate: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-2.0.4-candidate`.
Application hashes remain those in `VERIFICATION-2.0.4.md`. Reviewed source commit
`8c1dfcfbb1891979706d63558c90075d50be9722`, branch `codex/release-2.0.4`, tag `v2.0.4`.
Source branch/tag pushed to `visarutforthaipbs/local-bill-apps` after artifact checks.
165/165 tests passed again during release preparation; `git diff --check` passed.

## Recovered build setup and corrections

- Approved OAuth JSON recovered on field from the previous release. Remote
  `npm run release:check` passes. Credentials remain excluded from Git/logs.
- Existing Developer ID Application / team `79QFYKTJMN` is used. Existing Apple
  API signing key and its non-secret identifiers were found in the original
  checkout's `secrets/build.sh`; the old script's key path is stale, so use the
  existing key file under `Personal-Project/apple-notorious-key`. Do not source
  a historical build script blindly or export private key material.
- Earlier unsigned/adhoc and manually deep-signed diagnostic outputs were not
  accepted for release. They also lacked the generated branded icon. Preserved
  for diagnosis, never publish their DMG/hash.
- Reused the prior release's `build/icon.icns` after verifying the source PNG
  SHA-256 matches exactly (`7881995adbfb4f086e15780119e3be85c2138a7ceddaa9c281de96d3deeed1a0`).
- A fresh electron-builder universal build uses `dist/2.0.4-final-stage` and
  identity `Visarut Sankham (79QFYKTJMN)`. Builder rejects a full identity name
  containing the `Developer ID Application:` prefix; corrected that option.
- Await every build/transfer process to exit. Initial packaging output is not a
  completed signed build. Never substitute manual recursive signing for this gate.
- Native stabilization harness now accepts an explicit packaged executable,
  while still asserting its fresh synthetic profile before touching fixture data.

## Website publication

Website build, assertions, desktop/mobile smoke and manager disclosure/layout
review passed. Content commit `9911602ddc16d3ffccdce2cda4b5261836049ed4` pushed to
`visarutforthaipbs/billiong-releases` main. As with 2.0.3, no automatic Pages
deployment appeared after the push, so the documented Wrangler 4.136.2 fallback
deployed the tested clean `dist` to the existing production project.

- Production deployment: `e964578d-d928-48c0-b3e0-7f13e6a49e17`, success, correct
  content commit; https://e964578d.billiong-landing.pages.dev.
- Live site: https://billiong-landing.pages.dev/.
- Live landing, support and retired-demo HTML compared byte-for-byte with tested
  output. Chrome verified 2.0.4 disclosures and both actual Mac download links.
- Prior website rollback content `2af067cb2543880d19447795aa07acf20d2fb6e1`,
  deployment `8d125ac5-1c5f-43ba-be70-f5f47e4409f9`. A rollback restores old app
  limitations; do not replace customer data with older backups automatically.

## Verified installer — 2026-09-24

- Fresh electron-builder build completed with exit 0; universal x86_64/arm64,
  hardened runtime, Developer ID team `79QFYKTJMN`. Deep/strict signature passes.
- Final artifact on field:
  `BillNgai-2.0.4-candidate/dist/2.0.4-final/BillNgai-2.0.4-universal.dmg`.
  **223,517,554 bytes**, post-staple SHA-256:
  `64a4f36bd80c1404d651b298df2c3795249392833cf2ca63de5a9d8e4fe43611`.
- Apple submission `5843027f-7749-4f2a-a16c-1bbaf37e4778`: **Accepted**,
  `Ready for distribution`, issues `null`; log in `review/2026-09-24/notarization-2.0.4.json`.
- Staple/validate passed. Final DMG and read-only mounted app accepted by Gatekeeper
  with `source=Notarized Developer ID`. No security warnings were bypassed.
- All 17 tracked packaged files match source commit byte-for-byte; package identity
  and embedded OAuth validation pass. Packaged `app.asar` SHA-256:
  `0cc04725ad5d24d5ec4f14a239e14d7e73d8a0508a7653ae54fcf93c62686cf7`.
- Both native suites passed against read-only mounted installer executable on field
  Apple Silicon. Covered storage recovery, cloud containment, ordinary receipt,
  frozen fields, PDF, actual void/payment buttons, legacy review, evidence IPC/disk,
  new receipt counted once, TH/EN screens and close drain. Pickers use deterministic
  destinations; this does not claim all OS-picker UX or every manual fault scenario.
- Pre-staple synthetic profiles: `billngai-packaged-smoke-59h7a5` and
  `billngai-204-native-f542uw` under field's temporary directory. Draft PDF text
  and rendered page checked: visible draft label, legible Thai and intact table.
- Repeated both suites and source comparison against the final stapled DMG,
  all passed. Final profiles: `billngai-packaged-smoke-HZHLh3` and
  `billngai-204-native-X3UDHl`. Verification mount detached afterward.
- Do not publish generated pre-staple blockmap/latest metadata. No in-app updater;
  only final DMG and matching checksum are release assets.

Cloudflare Pages authentication works on lighthouse-control (existing account,
Pages scope). Field has no Wrangler login. Local GitHub push/API access works;
field's `gh auth status` reported a login but its release-create request returned
401. No release was created by that attempt; use the verified local login instead.
R2 upload follows the authenticated dashboard route used for 2.0.3.

Default SCP over the multiplexed Tailscale connection stalled; stopped only the
two identified release-transfer processes, preserving partial files. Retried the
DMG with `scp -X nrequests=4 -o ControlPath=none`; transfer completed. Always
compare the completed local file with the final checksum before upload.

Transfer completed; local DMG size/hash matches the final original. Both R2
objects uploaded through the authenticated dashboard (2/2 successful). Anonymous
download on field passed `cmp` and SHA-256 against the final original; public
checksum matches. GitHub draft assets finished and server-reported DMG digest
matches the same SHA-256/223,517,554-byte size. Public release checks continue below.

GitHub release published and marked latest:
https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.4.
Anonymous GitHub download on field also passed `cmp` and SHA-256 against the final
original; its public checksum matches. Both advertised destinations are verified:

- https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.4-universal.dmg
- https://github.com/visarutforthaipbs/local-bill-apps/releases/download/v2.0.4/BillNgai-2.0.4-universal.dmg

Checksum: `BillNgai-2.0.4-SHA256SUMS.txt` beside both installers. Previous artifacts
and tags are unchanged. Only the DMG and checksum were uploaded, no stale blockmap.

## Boundaries

AI-assisted software audit is not practitioner/legal certification. Intel hardware,
Windows and Mac App Store verification remain separate. Receipt/tax/cloud/e-Tax
restrictions remain; see PRD and changelog. Preserve original documents and PDFs;
database JSON and evidence bundles are separate backups. No silent customer-data
migration, automatic app replacement, new customer messages or refund promises.
