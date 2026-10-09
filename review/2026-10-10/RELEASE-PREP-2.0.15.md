# BillNgai 2.0.15 release preparation — 2026-10-10

Status: prepared locally; **nothing delivered to App Store Connect, submitted for review, notarized as the final direct DMG, published, or sent to customers** in this session. Version 2.0.15 was retained.

## Verified source and UI

- Base branch: `codex/simplify-2.0.15`, starting at `e91e331a31f8fe5a00091010bbeffc143cc5b032`.
- `npm test`: 333/333 pass. `npm run release:check`: pass. Mobile `npm test`: 66/66 pass.
- The synthetic iPhone UI audit found two 36-point Income Summary tabs. `mobile/web/mobile.css` now gives tabs, pill selectors and filter chips a 44-point minimum. The corrected audit passed for dashboard, documents, client, receipt, report and settings in Thai and English on the iPhone 18 Pro Max and iPad Pro 13-inch, plus dark dashboard/documents/receipt. `git diff --check`: pass.

## Mac App Store package

- `npm run dist:mas` completed from the simplification source. `dist/mas-universal/BillNgai-2.0.15-universal.pkg`: **225,889,701 bytes**, SHA-256 **a006638ae9fdc7d243d9b76f7108b87c36b4164ceaa7bcafdf22d7db7895fe8e**.
- `scripts/verify-packaged-source.cjs`: 19 packaged tracked files match the base commit; app.asar SHA-256 `6cb018f29aa239f78a2742144f5efd9ae5c9785621f0c393fbcc4846828d3acb`.
- Installer signature is trusted by Apple certificate chain; app `codesign --verify --deep --strict` passes. The app has `app-sandbox`, `network.client`, and `network.server` entitlements.
- The literal-string sweep is **not clean** for `e-Tax`: one bookkeeping disclaimer and the intentionally inert `exportETaxXML` containment stub (with its Thai/English error) remain. No other searched retired string appeared. The current checklist should record these explicit exceptions rather than mark its blanket command clean.
- The signed MAS app did not launch through Playwright outside App Store distribution here, so its packaged runtime smoke is pending TestFlight. `spctl` rejected the local MAS app (Apple Distribution origin); this is not a Developer ID notarization result.
- **Transporter delivery pending.** The package has not been uploaded or processed by Apple.

## iOS archive and screenshots

- Final release archive after the 44-point fix: `/private/tmp/BillNgai-2.0.15-b1-2026-10-10.xcarchive`, version **2.0.15 (1)**, 17 MB; no UI-audit scripts in the release bundle. App executable SHA-256 `0fb921713f663e51d0ac5b442591a8183d1ff4e1473e15d32f5bab1209f9ca2c`.
- The archive succeeded with **Apple Development** signing. App Store export failed with `No Accounts` and `No profiles for 'com.visarut.billngai'`; Xcode has no signed-in account or iOS App Store distribution profile available to the command. **No distribution IPA, validated upload, or TestFlight build exists from this archive.**
- 48 synthetic screenshot candidates are under `review/2026-10-10/design/store-screens/`. iPhone 18 Pro Max captures are 1320 × 2868; 13-inch iPad captures are 2064 × 2752. All 36 mobile captures passed the project UI audit. The 12 Mac captures are real native-window screenshots at Apple's 1440 × 900 size; the desktop source UI smoke passed. **Owner must approve the synthetic sample content before upload.**
- Mac captures came from the shared source Electron UI because the signed MAS app could not be launched locally before App Store distribution. Compare them with the processed Mac build in TestFlight before upload. The previous `review/2026-10-09/screenshots-store/` set predates the simplification and is not a final source.

## Metadata and customers

- Store What's New and Review Notes drafts: `review/2026-10-09/design/RELEASE-NOTES-2.0.15-UI.md`, simplified 2.0.15 addendum. The Review Notes still need owner verification of the test Google account, with its password entered only in App Review sign-in fields.
- `https://billiong-landing.pages.dev/support` returned HTML on 2026-10-10 and contained contact and privacy text.
- Notion `BillNgai Sales Log` currently has **one completed Pro Early Bird sale**. Verify eligibility against the original purchase record before allocating one IAP Pro code. No customer identity, licence key, or future code was copied into this repository. No customer was contacted.
- The final direct DMG and R2/Pages update follow approval and release of both store builds, per `SIMPLIFY-OWNER-CHECKLIST.md`; the existing 2026-10-09 `dist/BillNgai-2.0.15-universal.dmg` predates this final check and must not be published.

## Next required actions

1. Sign in to the developer account in Xcode Settings → Accounts, make the `com.visarut.billngai` iOS App Store distribution profile available, export/upload the final archive, and wait for processing. If Xcode re-signs during export, preserve version 2.0.15 (1) and upload symbols.
2. Deliver the verified Mac `.pkg` through Transporter and wait for its Delivered/processed state. Record Apple-side build IDs and times.
3. Complete the TestFlight free/Pro/restore/sync/migration and Mac window-reopen checks from the owner checklist. Compare Mac screenshot candidates with the processed store build and approve all synthetic listing content.
4. Enter both platforms' metadata and Review Notes, attach the existing Pro IAP, select processed builds, then submit for review with manual release.
5. After both platforms are approved and released, build/notarize the final direct DMG, verify its public R2 checksum and landing page, then generate and deliver one IAP Pro code per verified lifetime-key holder.

Current Apple references: [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/), [IAP offer codes](https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases).
