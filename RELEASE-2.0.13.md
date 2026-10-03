# BillNgai 2.0.13 desktop release — 2026-10-04

Owner authorized desktop publication before mobile sync. Release source
`dd8e7ce0202ae2c63bb53c55f2528eff21cdec08`, based on public2.0.12 checkout c303ac3.
The clay UI was ported from development; main.js, preload.js and lib/*.cjs
remain byte-identical to the public2.0.12 baseline. Mobile/MAS WIP excluded.

## Changes and verification

Folded-paper b icon, five clay illustrations, outline icons, reduced-motion
support, optional local Sounds/Thai female guides with translated transcripts.
App orange/cream palette, seller branding and frozen documents retained.
264 tests pass on Mac and Windows. Eleven source native suites pass. MiMo Pro
completed a static review; Codex verified its concerns against the full tree and
package. All binary assets are tracked; no retired illustration paths packaged.
Names for icon close/delete controls come from existing accessibility enhancement.

Universal Mac: Developer ID Application Visarut Sankham (79QFYKTJMN),
Electron43.7.3 / builder26.15.3, x86_64 and arm64, minimum macOS12.
Apple notarization Accepted (3200a983-8082-4c05-83f1-d72ea15c67a2), no issues.
DMG staple/validation and app+DMG Gatekeeper accepted as Notarized Developer ID.
Eleven checks pass from the exact final read-only DMG: packaged config/asset/
accessible icon check; first-use, receipt reissue, design, payment matching,
stabilization/recovery, fintech layout, brand color, audio, PDF and legacy review.
31 packaged runtime/font/artwork/audio files match source; embedded OAuth matches.
Only Apple Silicon hardware was used for Mac native tests; Intel included but
not hardware-tested. QA profiles synthetic; owner data and installed apps unchanged.

## Installers and publication

Mac DMG: dist/2.0.13/BillNgai-2.0.13-universal.dmg, 231149350 bytes.
SHA256: 46fc1115520becd9204255bb38ef9439dac641310f093cf83bc67550a399eabd.
Mac tag v2.0.13 at dd8e7ce, GitHub release marked latest:
https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.13
R2: https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.13-universal.dmg
R2 and anonymous GitHub downloads match the final stapled DMG. The initial
GitHub transfer stalled; an HTTP/1.1 resumed transfer completed with the same hash.

Windows unsigned x64 Beta: same source, tag v2.0.13-windows. PC build,
264 tests, five packaged suites plus configuration/assets/accessibility check
pass. Local/PC/anonymous R2/anonymous GitHub SHA256 agree. See WINDOWS-2.0.13.md.
Previous 2.0.12 artifacts/tags retained. No auto-updater metadata is published;
pre-staple blockmap/latest-mac.yml removed rather than retaining invalid hashes.

Website source ab635a9 deployed to production fae0b43d-8e97-4dab-825b-ac377b38ce52
(branch main). Local build/release checks and 390/1280px browser checks pass.
Live homepage, support and Mac/Windows targets verified in the browser; proof
screenshot retained. https://billiong-landing.pages.dev now serves2.0.13.
See promote-billiong/RELEASE-DESKTOP-2.0.13.md and root handoff.md.

## Limits and next work

Earlier three-device2.0.12 live sync proved core convergence, numbering,
conflicts and payment deduplication. Canceled-login callback feedback and dirty
close behavior remain open/disclosed; live Google login was not repeated for this
UI release. Windows signing, this installer upgrade/uninstall and other Windows
versions are not certified. This is not a new unconditional sync sign-off.

Separate MAS record remains2.0.12/build2.0.9; no upload/submission from this
release. Mobile sync/Pro and physical accessibility remain unfinished; iOS OAuth
client/configuration and live tests are required. Development WIP preserved.
Follow INSTALL-2.0.13.md for manual upgrade and rollback precautions.
