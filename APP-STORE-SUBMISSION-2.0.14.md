# BillNgai 2.0.14 — App Store submission preparation (2026-10-07)

Status (2026-10-13): **CYCLE CLOSED ON APPLE'S SIDE — all platforms approved at version 2.1.0.**
iOS 2.1.0 was approved 2026-10-11 (11 ต.ค. 2569) and has been live since then. macOS 2.1.0 was
accepted 2026-10-13 (13 ต.ค. 2569): submitted 2026-10-11 00:02 PDT via API Key, Submission ID
`91f7770c-b54f-4291-a121-ba00e24e34b9`, "Number of items submitted: 1", accepted items: App Version
2.1.0 for macOS. iPhone, iPad and Mac are all covered (two separate approvals, same version).
Apple notes it can take up to 24 hours after release for items to become publicly available —
@billngai-release verifies the live listing before any announcement goes out.

Still open (not Apple-blocking): (1) the redaction-breach decision (see handoff-M5 2026-10-13
entry) gates every tag/release/publish from this tree; (2) the launch announcement package is
prepared from `drafts/mas-launch-announcement-approved.md` only after the listing is verified
visible; social drafts are fed from @billngai-sync's redacted summaries, never raw configs.

Historical status (2026-10-07 16:00): **iOS 2.0.14 (3) is "Ready to Submit" in TestFlight. macOS 2.0.14 was
delivered through Transporter at 15:32 and is also "Ready to Submit" in TestFlight; the delivered
package is b2 (SHA `fb8c638b…6f88`). No missing-compliance flag was shown for it.
The production sync service runs the new coordinator with the purchase-verification secrets.
Nothing is submitted for review.**

The existing Apple record is kept: app `6789503350`, SKU `billngai-mas`, bundle
`com.visarut.billngai`, non-consumable `com.visarut.billngai.pro`, team `[REDACTED — team ID in the private layer]`.
iOS is a platform added to that record; there is no new SKU or purchase.

## Candidate packages (built from the same uncommitted source)

| Channel | Artifact | Identity | SHA-256 / bytes |
| --- | --- | --- | --- |
| iPhone + iPad (use this) | `mobile/.build-release-2.0.14-b4` archive, uploaded 2026-10-07 17:08 | 2.0.14 (4): build 3 plus the iPad sidebar fix; Apple validated | uploaded from the archive |
| iPhone + iPad (superseded: iPad sidebar cannot be tapped) | `mobile/.build-release-2.0.14-b3/export/BillNgai.ipa` | 2.0.14 (3), Apple Distribution, iOS Team Store profile, iOS 16+, arm64 | `37007ad4c53deaff290266f2deab8129da81193b3439f0bb8347a6ef20ec29aa` / 7,822,028 |
| Mac App Store | `dist-rollout-mas-2.0.14-b3/mas-universal/BillNgai-2.0.14-universal.pkg` (b2 is superseded: it lacked the export-compliance flag) | 2.0.14 (2.0.14), Apple Distribution + 3rd Party Mac Developer Installer, sandboxed, x86_64 + arm64, macOS 12+, `ITSAppUsesNonExemptEncryption=false` | `f0d4f84069dd9c29f54af69bb4df67c2373d2d141f54a908c53099f7873991ea` / 227,544,192 |
| Windows (direct, Beta) | PC `dist-sqlite-2.0.14-b2\BillNgai-2.0.14-x64-Setup.exe` | 2.0.14, x64, **not signed** | `cb0e7a759e8193570272befa2271a4a503fc2337031c0db82604aec14fff1a01` / 110,357,517 |
| Mac (direct) | not rebuilt | The 2026-10-04 notarized DMG predates the current source. Rebuilding needs the notarization credentials, which are not available to this session. | — |

Local checks on the iOS package: signature valid; production Google client and production
coordinator origin; iPhone and iPad families with all four iPad orientations;
`ITSAppUsesNonExemptEncryption=false`; privacy manifest present and linted; no QA scripts in the
bundle and no QA launch flags in the binary. Local checks on the Mac package: installer and app
signatures, sandbox entitlement, both architectures, nine packaged source files identical to the
tree, Apple renderer without the direct-purchase dialog.

Apple validated the iOS archive ("Validated App") before the upload. The Mac package is validated
by Transporter when it is delivered.

## What is verified on real devices (2026-10-07)

- iPhone 14 Pro and iPad Pro 11-inch (M4), QA bundle: 22/22 screens each in Thai and English;
  full software keyboard with the Notes field visible above it on both.
- Live sync on synthetic data through Google Drive and the test coordinator: this Mac, a second
  Mac, Windows 11 and the iPhone hold identical content, including a document with stored images.
- Real Restore Purchases of an existing Pro purchase on the iPhone (2026-10-04).

Not yet verified: Files import on a device, largest text size with VoiceOver, a new purchase /
refund / expired lease in TestFlight, the packaged Mac App Store build live, a first upload above
512 records live.

## Mac App Store requirements checked (research 2026-10-07)

Sources: Electron's Mac App Store Submission Guide, Apple's App Review Guidelines, Apple's
"Upcoming requirements" page, Cloudflare's Durable Objects "Code updates" note.

| Requirement | This package |
| --- | --- |
| Built with the Xcode 26 / OS 26 SDKs (required since 2026-04-28) | Electron runtime reports SDK 26.5, minimum macOS 12.0; iOS archive built with Xcode 27 |
| Sandboxed, with `app-sandbox` and `application-groups` = Team ID + bundle ID; helpers `app-sandbox` + `inherit`; `ElectronTeamID` in Info.plist | All present |
| Signed with Apple Distribution, installer signed, store provisioning profile | Yes; "BillNgai MAS" profile valid until 2027-07-10 |
| No `com.apple.quarantine` attribute on any file | None found |
| 2.4.5(iv) no downloading of extra code | The AI add-on block is hidden in the store build |
| 2.4.5(vi) no licence keys or licence screen | The licence-key dialog and direct purchase dialog are removed from the store renderer; the only outside links are two Revenue Department references |
| 2.4.5(vii) updates only through the store | No updater or update prompt in the store build |
| 3.1.1 purchases through In-App Purchase, with restore | Pro is the existing non-consumable; Restore Purchases in Settings |
| 3.1.3(b) access to Pro bought elsewhere | Allowed because Pro is also sold as an in-app purchase in the app |
| 4.8 login services | Google sign-in is not the app's account; the app is a client for the user's own Google Drive (listed exception). Explain in review notes |
| 5.1.1(v) | No account creation, so no account deletion; "Stop syncing" removes the Google credentials from the device; tokens stay on the device |
| 2.1 review access | Production coordinator is live; a test Google account is still needed for the reviewer |
| Export compliance | `ITSAppUsesNonExemptEncryption=false` on both platforms |
| Entitlement likely to be asked about | `com.apple.security.network.server`: used only for the local loopback address that receives Google's sign-in reply |

## Order of remaining steps

1. **Owner, now:** in Transporter (already open with the package), press **Deliver** for
   `BillNgai-2.0.14-universal.pkg`.
2. **Owner:** in App Store Connect → TestFlight, wait for iOS 2.0.14 (3) and macOS 2.0.14 to finish
   processing, add yourself as an internal tester, and install both from TestFlight.
3. **Owner + agent:** on the TestFlight builds, with a sandbox Apple account: buy Pro, restore,
   cancel a purchase, connect Google Drive, sync between the Mac and the iPhone. The agent can read
   the coordinator's behaviour and fix what fails; the taps and the Apple account are the owner's.
4. Done 2026-10-07: the reviewer's Google account (address recorded in the private layer) is on production's
   sandbox list. **Owner:** make sure it is clean and has 2-Step Verification off, set a review-only
   password, sign in once on the TestFlight build and add two or three sample documents.
5. Hands-on device checks still open: Files import, largest text with VoiceOver.
6. **Owner:** in App Store Connect, create macOS version 2.0.14 and the iOS version; fill in
   screenshots, description, What's New, App Privacy answers and review notes from this document;
   answer the age-rating questions if prompted.
7. **Owner:** publish the privacy policy edit (drafted, uncommitted, in
   `promote-billiong/public/privacy.html`).
8. Release the direct Mac and Windows 2.0.14 builds at the same time as the store builds, so a user
   who upgrades a workspace on one device is not locked out on another. The direct Mac build still
   needs notarizing.
9. **Owner:** submit both platforms for review; after approval, plan the backed-up migration of the
   owner's own profile.

## App Privacy answers (proposed; matches the privacy manifest)

Data is collected only when the user turns on Google Drive sync. None is used for tracking.

| Data type | Collected | Linked to user | Purpose | What it is |
| --- | --- | --- | --- | --- |
| Identifiers → User ID | Yes | Yes | App functionality | Google account identifier that selects the workspace |
| Purchases → Purchase history | Yes | Yes | App functionality | A hash of the App Store purchase or Pro licence, and when it was verified |
| User content → Other user content | Yes | Yes | App functionality | Record identifiers, content fingerprints, Drive file identifiers, document numbers |

Not collected: names, addresses, line items, amounts, document contents, images, contacts,
location, diagnostics, usage data. Document contents live on the device and, with sync, in the
user's own Google Drive.

## Privacy policy changes needed before submission

`promote-billiong/public/privacy.html` (last updated 2026-09-30) already describes the sync
coordinator accurately. It still needs:

- "for macOS" / "on your Mac" / "macOS Keychain" → Mac, Windows, iPhone and iPad; the iOS
  Keychain for iPhone and iPad.
- App Store purchases: the app sends Apple's signed purchase proof to the coordinator, which
  checks it with Apple and stores only a hash of the purchase identifier and the time it was
  verified. This sits beside the existing sentence about the hash of the Pro key.
- A new "last updated" date.

## Review notes (draft, English)

> BillNgai creates quotations, invoices and receipts for Thai freelancers who are not VAT
> registered. All features work without an account: open the app, add a client, create a
> document, issue it and share the PDF.
>
> Pro is a one-time non-consumable purchase (com.visarut.billngai.pro), the same product as the
> Mac version; "Restore Purchases" is in Settings. There is no other way to buy Pro in this app.
>
> Google sign-in is optional and is used only to store the user's own data in the user's own
> Google Drive (drive.file scope) so their devices stay in step. It is not an app account, so
> there is no account creation or deletion; "Stop syncing" in Settings disconnects the device and
> keeps local data. To test sync, sign in with the test Google account below on two devices.
>
> Test Google account: the reviewer Google address is recorded in the private layer (password entered in
> App Review Information, not here)
> Sandbox Apple account: (reviewer's own)

## What's New (draft)

Thai: รองรับ iPhone และ iPad โดยใช้สิทธิ์ Pro เดิม · ซิงก์ผ่าน Google Drive ระหว่าง Mac, Windows, iPhone และ iPad · เก็บข้อมูลในเครื่องปลอดภัยขึ้นพร้อมสำรองก่อนอัปเกรด · โลโก้และลายเซ็นเก็บเพียงชุดเดียว ไฟล์ข้อมูลเล็กลงมาก

English: iPhone and iPad support using your existing Pro purchase · Google Drive sync across Mac, Windows, iPhone and iPad · safer on-device storage with a backup before upgrading · logo and signature are stored once, so your data file is much smaller.

## Screenshots

Draft captures at the required sizes are in the private evidence folder under
`appstore/screenshots-draft/`: iPhone 6.9-inch 1320×2868 and iPad 13-inch 2064×2752, Thai and
English, seven screens each (dashboard, documents, receipt, clients, client form, editor, report).
They use the minimal synthetic profile ("Synthetic client", ฿970); the final listing needs
owner-approved sample content. The simulators are "BillNgai UI Audit Listing Phone" and
"BillNgai UI Audit Listing Tablet".
