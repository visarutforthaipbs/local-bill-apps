# BillNgai 2.0.15 release preparation — 2026-10-10

Status: iOS **2.0.15 (1) uploaded to App Store Connect** (last observed processing); the corrected Mac package (build 2.0.16) was **Delivered** by Transporter at 09:13 Asia/Bangkok and shown as ready for internal testing after build 2.0.15 was rejected as a duplicate. Nothing submitted for App Review, notarized as the final direct DMG, published, or sent to customers. Version 2.0.15 was retained.

## Verified source and UI

- Base branch: `codex/simplify-2.0.15`, starting at `e91e331a31f8fe5a00091010bbeffc143cc5b032`.
- `npm test`: 333/333 pass. `npm run release:check`: pass. Mobile `npm test`: 66/66 pass.
- The synthetic iPhone UI audit found two 36-point Income Summary tabs. `mobile/web/mobile.css` now gives tabs, pill selectors and filter chips a 44-point minimum. The corrected audit passed for dashboard, documents, client, receipt, report and settings in Thai and English on the iPhone 18 Pro Max and iPad Pro 13-inch, plus dark dashboard/documents/receipt. `git diff --check`: pass.

## Mac App Store package

- `npm run dist:mas` completed from the simplification source. `dist/mas-universal/BillNgai-2.0.15-universal.pkg`: **225,891,316 bytes**, SHA-256 **c791054000842e7d1e896bd8daabe57ad110a6039d6fe428b3805024f3f8aa75**. The customer-facing `CFBundleShortVersionString` remains 2.0.15; MAS `CFBundleVersion` is now **2.0.16**.
- `scripts/verify-packaged-source.cjs`: 19 packaged tracked files match the base commit; app.asar SHA-256 `6cb018f29aa239f78a2742144f5efd9ae5c9785621f0c393fbcc4846828d3acb`.
- Installer signature is trusted by Apple certificate chain; app `codesign --verify --deep --strict` passes. The app has `app-sandbox`, `network.client`, and `network.server` entitlements.
- The literal-string sweep is **not clean** for `e-Tax`: one bookkeeping disclaimer and the intentionally inert `exportETaxXML` containment stub (with its Thai/English error) remain. No other searched retired string appeared. The owner checklist now records these explicit exceptions and checks the retired UI strings separately.
- The signed MAS app did not launch through Playwright outside App Store distribution here, so its packaged runtime smoke is pending TestFlight. `spctl` rejected the local MAS app (Apple Distribution origin); this is not a Developer ID notarization result.
- **Transporter retry delivered.** Apple rejected the first 2.0.15 package with error `-19232`: bundle version `2.0.15` was already uploaded. That rejected package and app were preserved in `/private/tmp/BillNgai-rejected-mas-build-2.0.15-2026-10-10/`. The new package uses MAS build 2.0.16. Its app signature and installer chain pass with full keychain access; expanded installer metadata confirms both version fields. The owner-provided Transporter screenshot (`review/2026-10-10/mas-2.0.16-transporter-delivered.png`) shows the corrected **2.0.15 (2.0.16)** package **Delivered on 2026-10-10 at 09:13 Asia/Bangkok** and **ready for internal testing**. App Store Connect build-list availability and TestFlight installation remain to be checked.

## iOS archive and screenshots

- Final release archive after the 44-point fix: `/private/tmp/BillNgai-2.0.15-b1-2026-10-10.xcarchive`, version **2.0.15 (1)**, 17 MB; no UI-audit scripts in the release bundle. App executable SHA-256 `0fb921713f663e51d0ac5b442591a8183d1ff4e1473e15d32f5bab1209f9ca2c`.
- The archive first succeeded with **Apple Development** signing. App Store export initially failed with `No Accounts` and `No profiles for 'com.visarut.billngai'`. After the owner completed Xcode sign-in, automatic provisioning downloaded an App Store distribution profile. A first export failed because Xcode invoked Apple `/usr/bin/rsync` with Homebrew `rsync` on `PATH`; retrying with `PATH=/usr/bin:/bin:/usr/sbin:/sbin` succeeded. The exported IPA is `/private/tmp/BillNgai-2.0.15-b1-ASC-export-system-rsync/BillNgai.ipa`, SHA-256 `2bb74e8b7ea00035c1f09857ec50fde4f4b6932629d417df7b01741f41c6dae2`. Its 2.0.15 (1) signature verifies for team `<team ID>`, `get-task-allow=false`, and `beta-reports-active=true`. `xcodebuild` uploaded the archive successfully on 2026-10-10 at 08:51 Asia/Bangkok; App Store Connect reported **processing**. TestFlight availability is still pending.
- 48 opaque RGB JPEG screenshot candidates (no alpha channel) are under `review/2026-10-10/design/store-screens/`. iPhone 18 Pro Max captures are 1320 × 2868; 13-inch iPad captures are 2064 × 2752. All 36 mobile captures passed the project UI audit. The 12 Mac captures are real native-window screenshots at Apple's 1440 × 900 size; the desktop source UI smoke passed. **Owner approved the synthetic sample content on 2026-10-10.**
- Mac captures came from the shared source Electron UI because the signed MAS app could not be launched locally before App Store distribution. Compare them with the processed Mac build in TestFlight before upload. The previous `review/2026-10-09/screenshots-store/` set predates the simplification and is not a final source.

## Metadata and customers

- Store What's New and Review Notes drafts: `review/2026-10-09/design/RELEASE-NOTES-2.0.15-UI.md`, simplified 2.0.15 addendum. The Review Notes still need owner verification of the test Google account, with its password entered only in App Review sign-in fields.
- `https://billiong-landing.pages.dev/support` returned HTML on 2026-10-10 and contained contact and privacy text.
- Notion `BillNgai Sales Log` currently has **one completed Pro Early Bird sale**. Verify eligibility against the original purchase record before allocating one free IAP Pro **offer code**. Apple stopped IAP promo-code creation on 2026-03-26; a custom code limited to one redemption avoids the 500-code minimum for random one-time-use batches. No customer identity, licence key, or future code was copied into this repository. No customer was contacted.
- The final direct DMG and R2/Pages update follow approval and release of both store builds, per `SIMPLIFY-OWNER-CHECKLIST.md`; the existing 2026-10-09 `dist/BillNgai-2.0.15-universal.dmg` predates this final check and must not be published.

## Next required actions

1. Wait for the uploaded iOS 2.0.15 (1) build to finish App Store Connect processing, then add it to internal TestFlight and record Apple-side build ID/time.
2. Confirm the delivered Mac 2.0.15 (2.0.16) build appears in App Store Connect, add it to internal TestFlight, and record the Apple-side build ID/time.
3. Complete the TestFlight free/Pro/restore/sync/migration and Mac window-reopen checks from the owner checklist. Compare Mac screenshot candidates with the processed store build; the synthetic listing content was approved on 2026-10-10.
4. Enter both platforms' metadata and Review Notes, attach the existing Pro IAP, select processed builds, then submit for review with manual release.
5. After both platforms are approved and released, build/notarize the final direct DMG, verify its public R2 checksum and landing page, then create and deliver one free IAP Pro offer code per verified lifetime-key holder.

Current Apple references: [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [IAP offer codes](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases).

---

## 2.1.0 — builds of 2026-10-10 (afternoon), branch `codex/installment-receipts` @ a7c352c

Version renamed to 2.1.0 (2.0.15 stays TestFlight-only). Contents: simplified app, installment payments
(`PRD-INSTALLMENTS.md`), iPhone/iPad Thai font fix. Not submitted for review — the owner's accountant check
on installment receipts is still open.

- **iOS 2.1.0 (1)**: archived with `xcodebuild … DEVELOPMENT_TEAM=<team ID> CODE_SIGN_STYLE=Automatic archive`
  (the project file carries no team; pass it on the command line), exported with method `app-store-connect`,
  destination `upload`, system `PATH` to avoid the Homebrew rsync issue. Xcode reported "Upload succeeded" at
  12:26 Asia/Bangkok. Archive kept in the session scratchpad only.
- **Mac App Store 2.1.0 (build 2.1.0)**: `npm run dist:mas` → `dist/mas-universal/BillNgai-2.1.0-universal.pkg`,
  225,931,719 bytes, SHA-256 `bfd56ba06b51fa9929f85a79c277240bc2f06a084c831f157dec34bc40717d69`. `codesign --verify
  --deep --strict` passes; entitlements app-sandbox, network.client, network.server; retired-string sweep 0;
  installment code present. Opened in Transporter — **owner presses Deliver** (no API-key upload path is used
  from this session).

Next: add both processed builds to internal TestFlight, run the owner checklist's TestFlight checks on the
2.1.0 builds, then submit after the accountant answer.

## 2.1.0 submitted for review — 2026-10-11

Owner confirmed the accountant check and TestFlight testing on 2026-10-11 and said "ship it". Done through the
App Store Connect API with the new team key `<release key ID — private layer>` (role App Manager; the Developer-role key
`<notarization key ID — private layer>` can upload but not edit versions). Metadata source: `review/2026-10-11/store-metadata-2.1.0.json`.

- iOS: the app's first version record ("1.0", never released) renamed to 2.1.0; build 2.1.0 (1) attached; Thai
  description/keywords/promo/support URL set; What's New omitted (Apple does not allow it on a first version);
  9 iPhone 6.9" + 9 iPad 13" screenshots uploaded and processed; review notes 2,024 chars; contact set.
  Review submission `6e162161-64c2-49b7-948e-da9294f1aff6`.
- macOS: new version 2.1.0 created; build 2.1.0 attached; same listing plus What's New; the six 2.0.1 screenshots
  it inherited were deleted and replaced by six 1440×900 captures of the new UI; review notes as above.
  Review submission `91f7770c-b54f-4291-a121-ba00e24e34b9`.
- Release type: after approval (manual release not used). Pro IAP `com.visarut.billngai.pro` already approved.
- Listing change to note: description and keywords no longer claim tax invoices, VAT, e-Tax XML or tax estimates.

- 2026-10-11 14:0x Asia/Bangkok: **iOS 2.1.0 approved** (submission 6e162161 complete, version READY_FOR_DISTRIBUTION, auto-release after approval). macOS 2.1.0 still WAITING_FOR_REVIEW.
