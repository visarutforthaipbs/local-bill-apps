# BillNgai direct-download deployment

Verified workflow: 22 September 2026. Direct app, Mac App Store app and marketing
site have separate checkouts. Check Git status and preserve unrelated changes.

## Release gates

1. Update package version/lockfile and changelog. Run `npm test`, inline-script
   syntax/i18n checks and `npm run release:check`.
2. Run `test/electron-storage-smoke.cjs` with Electron and its temporary profile.
   Test missing/returning external data, recovery, save/reload, backup dates and
   PDF. Never put test records in a real application profile.
3. Verify Google OAuth is configured in the packaged app. `beforePack` validates
   the Desktop client JSON; `afterPack` checks the embedded app.asar copy. This
   does not establish consent-screen approval or successful network login.
   Record missing live Drive/two-device tests explicitly. Use a separate test
   Google account: connecting to a production workspace can change real files.
4. Review and commit only release files with owner authorization. Record the exact
   commit. Do not publish a tag/download link for a failed candidate. Corrected
   candidates require a fresh build and notarization.

## Build and verify macOS

Electron 43.7.3 and electron-builder 26.15.3 are pinned. Universal builds contain
Intel and Apple Silicon code and require macOS 12+. Record architectures actually
tested on hardware. Use the existing Developer ID Application in Keychain.
See `mac_signing_notarization_plan.md` for credentials and notarization.

Replace VERSION/STAGING below with release directories:

```sh
node_modules/.bin/electron-builder --mac --dir --universal --publish never -c.mac.notarize=false -c.directories.output=STAGING
node_modules/.bin/electron-builder --mac dmg --universal --prepackaged=STAGING/mac-universal/BillNgai.app --publish never -c.mac.notarize=false -c.directories.output=dist/VERSION
```

The explicit skip only defers notarization. Submit the signed DMG, wait for
Accepted, then staple and validate it. Verify the app's deep signature and
Gatekeeper assessment and the DMG assessment. Mount read-only and run
`test/packaged-electron-smoke.cjs` against that exact executable. Compare packaged
source with the release commit. Do not modify a signed app in place.

Calculate SHA-256 after stapling. Regenerate blockmap/latest-mac.yml hashes and
sizes after stapling if retaining them. There is no in-app auto-updater.
Never disable Gatekeeper, remove quarantine or restore a runtime explicitly
blocked as malware to continue testing. Replace it from an official supported
distribution. Notarization is not feature verification.

## Publish installer, then website

1. Verify Cloudflare account, R2 bucket, Pages project and production branch live.
   Old example URLs/commands in DELIVERY.md are not current deployment evidence.
2. Upload the versioned DMG and checksum to R2. Preserve the previous artifact.
   Download the public object and verify SHA-256 before changing website links.
3. Publish the reviewed Git commit/tag and matching GitHub Release asset if the
   website exposes a GitHub fallback. Never point it to a missing asset.
4. In `../promote-billiong`, update `src/config/product.ts`, version metadata and
   installation copy. Identify versions per platform and state macOS 12+.
5. Build/preview the site, deploy through the verified Pages integration, then
   check the live page and actual public download. Record URLs, hashes and
   deployment ID. Keep versioned installer objects immutable.
6. For rollback, restore links to the previous verified artifact while investigating.
   Updates are manual re-downloads. Customer messages require authorization to send.

## Other channels

Port shared fixes to MAS deliberately, preserving StoreKit and sandbox behavior.
Use the same app SemVer and a new build number; run MAS checks before submission.
Windows needs its own build and verification. Record these channels as pending
until verified; a direct macOS release must not imply those channels are updated.
