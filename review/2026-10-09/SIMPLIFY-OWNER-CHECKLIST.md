# Simplification 2.0.15 — owner-only checklist (2026-10-09)

Source: `PRD-SIMPLIFY-2026-10.md` §4.3 (owner-only actions) and §8 (verification gates).
Agents prepare drafts, commands and evidence; every step marked **owner runs this** needs the
owner's hands, signing identities, Apple account or judgement. Do the steps in order; a red gate
stops everything after it. Nothing below has been done yet; tick a box only after the command ran
or the screen was completed on this Mac.

Paths are relative to the repo root on `codex/simplify-2.0.15` after streams A–G are merged.
If the owner renames 2.0.15 → 2.1.0 (PRD §9), replace the version in every path and in
`package.json`, `mobile/` project settings and the App Store Connect versions before step 1.

## Phase 0 — merged source is green (manager runs, owner confirms)

- [ ] 0.1 Unit tests and release validator
  ```sh
  npm test
  npm run release:check
  ```
- [ ] 0.2 Syntax-check the extracted renderer script
  ```sh
  python3 -c "import re;s=open('billing.html',encoding='utf-8').read();open('$TMPDIR/billing-inline.js','w',encoding='utf-8').write('\n'.join(re.findall(r'<script>(.*?)</script>',s,re.S)))" && node --check "$TMPDIR/billing-inline.js"
  ```
- [ ] 0.3 Electron smokes from PRD §8.2 (each launches its own synthetic profile; never `npm start`)
  ```sh
  for t in fintech-ui pdf-output brand-color payment-match bulk-correction design-fixes stabilization option-a receipt-reissue prepublish; do node "test/$t-electron-smoke.cjs" || break; done
  node test/migration-electron-smoke.cjs      # new in stream E
  ```
- [ ] 0.4 Retired strings are gone from the tree (expect no output)
  ```sh
  grep -rn "lin\.ee\|Early Bird\|ซื้อ Pro\|TOR → Invoice\|playAppSfx\|e-Tax" billing.html main.js preload.js mobile/web mobile/scripts scripts test || echo "clean"
  ```
- [ ] 0.5 iOS builds
  ```sh
  cd mobile && npm ci && npm run build:simulator && npm run build:device && cd ..
  ```
  Then the simulator pass on iPhone 17 (light + dark) and iPad Pro 11-inch from
  `.claude/skills/apple-platform-design/SKILL.md` §4.3, recorded under `review/2026-10-10/design/screens/`.

## Phase 1 — Mac App Store package (owner runs this: needs the Apple Distribution identities in Keychain)

- [ ] 1.1 Bump the MAS build number (`mas.bundleVersion` or the build counter used for 2.0.14) so it is higher than the last delivered 2.0.14 package, then build
  ```sh
  npm run dist:mas
  ```
  Output: `dist/mas-universal/BillNgai-2.0.15-universal.pkg` (the `.app` sits next to it).
- [ ] 1.2 Entitlements and signature (PRD §8.3) — expect `app-sandbox` and `network.server` = true
  ```sh
  codesign -dvv --entitlements :- "dist/mas-universal/BillNgai.app" 2>&1 | grep -E "app-sandbox|network.server|network.client|Authority"
  pkgutil --check-signature "dist/mas-universal/BillNgai-2.0.15-universal.pkg"
  ```
- [ ] 1.3 Packaged bundle contains none of the retired strings (expect "clean")
  ```sh
  rm -rf "$TMPDIR/asar" && npx --yes @electron/asar extract "dist/mas-universal/BillNgai.app/Contents/Resources/app.asar" "$TMPDIR/asar"
  grep -rln "lin\.ee\|Early Bird\|ซื้อ Pro\|TOR → Invoice\|playAppSfx\|e-Tax" "$TMPDIR/asar" || echo "clean"
  node test/packaged-electron-smoke.cjs
  ```
- [ ] 1.4 Packaged source matches the release commit
  ```sh
  node scripts/verify-packaged-source.cjs "dist/mas-universal/BillNgai.app/Contents/Resources/app.asar" .git "$(git rev-parse HEAD)"
  ```
- [ ] 1.5 Record SHA-256 and size in the release notes before delivery
  ```sh
  shasum -a 256 "dist/mas-universal/BillNgai-2.0.15-universal.pkg"; stat -f %z "dist/mas-universal/BillNgai-2.0.15-universal.pkg"
  ```
- [ ] 1.6 **Owner runs this:** open Transporter → Add → the `.pkg` → **Deliver**. Wait for the "Delivered" state; note the time.

## Phase 2 — iOS archive (owner runs this: Apple Distribution + "iOS Team Store" profile)

- [ ] 2.1 Raise `CURRENT_PROJECT_VERSION` in `mobile/ios/App/App.xcodeproj` above the last TestFlight build (2.0.14 used 3–5; 2.0.15 starts at 1 — check TestFlight first).
- [ ] 2.2 **Owner runs this:** `cd mobile && npm run sync:ios && npm run ios:open` → Xcode → scheme App, destination "Any iOS Device (arm64)" → Product → Archive → Organizer → **Distribute App** → App Store Connect → Upload (keep "Upload symbols", manage version automatically off). Confirm "Validated App" before upload.
- [ ] 2.3 **Owner runs this:** App Store Connect → My Apps → BillNgai → TestFlight → wait for processing → add yourself as internal tester → install on iPhone and iPad.

## Phase 3 — TestFlight pass with a sandbox Apple account (owner taps, agent reads)

- [ ] 3.1 **Owner runs this:** on the TestFlight Mac and iOS builds: free tier without sign-in (setup → client → document → PDF), buy Pro with a sandbox Apple account, Restore Purchases on the second device, connect Google Drive with the test account, sync one document both ways, Stop syncing.
- [ ] 3.2 **Owner runs this:** migration rehearsal — export from a direct 2.0.15 build (Settings → ข้อมูลและสำรอง → "ย้ายไป App Store"), import on the store build's first-run sheet ("นำเข้าจากเวอร์ชันเดิม"), confirm document count, counters and one corrected-receipt PDF match (PRD §5.3).
- [ ] 3.3 **Owner runs this:** window reopen on Mac — close the window, click the Dock icon, then Window menu → BillNgai. Both must bring it back (Guideline 4).

## Phase 4 — App Store Connect metadata (owner runs this)

All text is drafted in `review/2026-10-09/design/RELEASE-NOTES-2.0.15-UI.md` (addendum 2026-10-09).

- [ ] 4.1 App Store Connect → My Apps → BillNgai (`6789503350`) → **macOS App** → "+" version → `2.0.15` (or 2.1.0).
- [ ] 4.2 Same for **iOS App** → "+" version.
- [ ] 4.3 For each platform: **What's New** (Thai primary, English) → paste the "App Store — What's New, simplified 2.0.15" copy.
- [ ] 4.4 **Screenshots** retaken on the final UI (PRD §8.5): Mac, iPhone 6.9"/6.5", iPad 13"; light set plus one dark set; upload per platform. Source folder: `review/2026-10-10/design/screens/` (agent) → owner-approved sample content only.
- [ ] 4.5 **App Review Information**: paste the "Review Notes — draft" block; put the test Google account email in "Sign-in required" with its password there, not in the note. Contact phone/email = owner.
- [ ] 4.6 **App Privacy**: answers unchanged from `APP-STORE-SUBMISSION-2.0.14.md` (User ID, Purchase history, Other user content; none for tracking).
- [ ] 4.7 **Build**: select the processed 2.0.15 build on each platform. Export compliance: `ITSAppUsesNonExemptEncryption=false` is already in both Info.plists.
- [ ] 4.8 **In-App Purchases** section: confirm `com.visarut.billngai.pro` is attached to the version (it is the existing product; price unchanged — do not touch the price tier).
- [ ] 4.9 Support URL check on the day: open https://billiong-landing.pages.dev/support — must load and show contact + privacy.

## Phase 5 — Submit (owner runs this)

- [ ] 5.1 Tag the verified commit on the worktree branch after the manager's final gate (no push until the owner decides):
  ```sh
  git tag -a v2.0.15 -m "BillNgai 2.0.15 — App Store only"
  ```
- [ ] 5.2 **Owner runs this:** App Store Connect → macOS version → **Add for Review** → **Submit to App Review**. Then the same for iOS. Choose manual release so both platforms go live together.
- [ ] 5.3 **Owner runs this:** if rejected: paste the Resolution Center text into a new session for Role 5 (Channel Ops) to draft the reply; the owner sends it.
- [ ] 5.4 **Owner runs this:** after approval on both platforms → **Release this version** on both the same day. Only now is anything "released"; update `CHANGELOG.md` date and `SKU.md` status line.

## Phase 6 — final direct DMG with the guided export (owner runs this: notarisation credentials)

PRD §4.2 step 2. Same source; direct target. Build only after the store release is approved so a
direct user who exports lands on a store build that can import.

- [ ] 6.1 Build and notarise (`DEPLOYMENT.md` and `mac_signing_notarization_plan.md`; `APPLE_API_KEY` = path to the `.p8`)
  ```sh
  npm run dist
  xcrun notarytool submit dist/BillNgai-2.0.15-universal.dmg --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --wait --output-format json
  xcrun stapler staple dist/BillNgai-2.0.15-universal.dmg && xcrun stapler validate dist/BillNgai-2.0.15-universal.dmg
  spctl -a -vv -t install dist/BillNgai-2.0.15-universal.dmg
  shasum -a 256 dist/BillNgai-2.0.15-universal.dmg | tee dist/BillNgai-2.0.15-universal.dmg.sha256
  ```
- [ ] 6.2 Confirm the DMG shows the "ย้ายไป App Store" card and the one-line notice in Settings → ข้อมูลและสำรอง, and that the licence-key path still accepts an existing key (kept for this build only, PRD §2 row 3).
- [ ] 6.3 **Owner runs this:** upload the DMG and `.sha256` to R2 bucket `billiong-releases` (Cloudflare dashboard → R2 → billiong-releases → Upload; keep the previous object). Download the public object and compare the hash:
  ```sh
  curl -fsSL "https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.15-universal.dmg" -o "$TMPDIR/dl.dmg" && shasum -a 256 "$TMPDIR/dl.dmg"
  ```
- [ ] 6.4 **Owner runs this:** landing page (`../promote-billiong`): `src/config/product.ts` → version 2.0.15, Mac DMG link, add the "Download on the App Store" badge for Mac and iOS, remove the Windows download and the AI add-on copy; mark the DMG "final direct version — moving to the App Store". Then
  ```sh
  npm run build
  release_site_commit=$(git rev-parse HEAD)
  npx --yes wrangler@4.136.2 pages deploy dist --project-name=billiong-landing --branch=main --commit-hash="$release_site_commit" --commit-dirty=false
  ```
  Check the live page and the actual download before announcing anything.

## Phase 7 — free IAP Pro offer codes for lifetime-key holders (owner runs this)

Apple stopped creating IAP promo codes on 2026-03-26. Use an IAP Offer Code; see `SKU.md` correction 2026-10-10 and `review/2026-10-10/PRO-OFFER-MIGRATION-MESSAGE.md`.

- [ ] 7.1 Verify the completed direct Pro buyer(s) in the private Notion BillNgai Sales Log against original purchase evidence. As of 2026-10-10 it has one completed Pro Early Bird row. No customer identity or code goes in this repo.
- [ ] 7.2 **Owner runs this after the app is Ready for Distribution and BillNgai Pro IAP is Approved:** App Store Connect → BillNgai → In-App Purchases → BillNgai Pro → Offer Codes → Create Offer → Free Offer. Set suitable customer eligibility and storefronts. Keep the Pro price unchanged.
- [ ] 7.3 **Owner runs this:** create a random custom code for each verified buyer with redemption limit 1; send that buyer the App Store Connect redemption URL with the drafted Thai message. Record code, recipient and date in the private sales log. Apple's one-time-use code batches require at least 500 codes, so do not request a one-code batch.
- [ ] 7.4 **Owner runs this:** check redemption after 30 days and replace an expired unredeemed code if needed. No customer contact before both store builds are live.

## Phase 8 — customer messages and announcements (owner runs this)

- [ ] 8.1 Role 4 drafts: "ขึ้น App Store แล้ว" post, LINE broadcast, website copy. Nothing is posted before step 5.4.
- [ ] 8.2 **Owner runs this:** post/send after both platforms are live. Store copy and App Store Connect text never mention prices, other channels or LINE.

## Phase 9 — retirement release (later, PRD §4.2 step 3)

- [ ] 9.1 Owner sets the date for taking the direct download link off the landing page (PRD §9 suggests 60 days after the store release).
- [ ] 9.2 Engineering stream (new PRD cycle): remove `licenseKey` validation, `dist`/`dist:unsigned`/`dist:win`, notarisation scripts; move `DELIVERY.md`/`WINDOWS-*.md` to `review/archive/`.
