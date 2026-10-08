# Existing-SKU mobile release readiness — 2026-10-03

**Decision:** the local iPhone/iPad prototype is not ready for public App Store submission. Keep app `6789503350`, SKU `billngai-mas`, bundle `com.visarut.billngai` and non-consumable `com.visarut.billngai.pro`. The simulator/UI improvements do not close the PRD's cross-platform, entitlement, physical-device or delivery gates.

This audit inspected source, local build resources and official Apple documentation. It did not access credentials, customer profiles, developer-account settings or production data, and did not upload or publish anything. The manager separately inspected App Store Connect and device availability; those observations are attributed below. Client/recurring recovery and accessibility changes are concurrent work: their final acceptance evidence belongs in [MOBILE-VERIFICATION.md](MOBILE-VERIFICATION.md), not an assumption in this audit.

## Apple record and current delivery state

| Item | Evidence and limit |
| --- | --- |
| Existing public Mac app | Manager's read-only App Store Connect observation on October 3: macOS 2.0.1 / build 2.0.8 is Ready for Distribution. |
| New Mac build | Manager observed macOS 2.0.12 / build 2.0.9 in TestFlight as Ready to Submit, uploaded October 3 at 3:40 PM. One internal tester invitation; no installations recorded. |
| Public review | Distribution showed only the existing 2.0.1 version plus Add Platform. No 2.0.12 App Review version/submission was observed. Upload/import validity is not public approval or purchase/sync test evidence. |
| iOS platform | No iOS platform was present in that observation. Add iOS to this existing app record at the delivery milestone; do not create a second record/SKU/product. |
| iOS build | Project metadata remains 2.0.12 / build 1, explicitly a prototype placeholder. No iOS upload or signed distribution archive is established by the existing verification record. |

Sources: [Mac release record](../../BillNgai-MAS-Pilot/RELEASE-MAS-2.0.12.md), [manager-inspected Mac TestFlight build](https://appstoreconnect.apple.com/teams/[team id redacted]/apps/6789503350/testflight/macos/bdf20101-dd28-405d-b2cf-b4685e03426e).

Apple supports adding a platform to an existing record while retaining the app identifier, SKU and bundle ID. Platform version/build strings may differ. The same in-app purchase can serve multiple platform implementations. Verify actual product availability and old-owner restore before claiming purchase continuity. [Add platforms](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/), [Configure In-App Purchases](https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases/)

## Release gates with concrete source evidence

| Gate | Current evidence | Required acceptance |
| --- | --- | --- |
| Native Google connection | `web/mobile-bridge.js` rejects connect/run/reserve/resolve/disconnect operations. No native OAuth SDK/callback implementation is present. The bundled CSP permits no browser network connections. | Approved iOS client and server audience in the existing Google project `billngai`; system/native authorization, secure credential renewal, subject/audience validation, cancel/deny/account-switch behavior and actual access to existing desktop Drive files. Sign-in alone cannot mean Connected. |
| Shared sync and assets | `BillNgaiStore.save()` rejects non-null `syncV3` with `MOBILE_SYNC_NOT_READY`. Native disk SHA-256 is a local concurrency marker, not the coordinator's canonical record hash. | Durable replica/outbox, staged activation/bootstrap, conflict and account recovery, idempotent numbering/finalization, offline financial gates and asset/evidence/PDF transfer. Test interrupted commits and more than 512 records. |
| Unified Pro entitlement | `BillNgaiNative.ownership()` returns `cloudReady: false`. It keeps StoreKit 2 JWS proof in Keychain; no native/server exchange exists. MAS coordinator `appstore.ts` verifies legacy base64 receipts with `verifyReceipt`, not iOS JWS. | Server validation of modern Apple proof with bundle/product/environment/revocation checks, common purchase identity/account limits across legacy/SK2, direct-license compatibility and workspace access without repurchase. Forged local Pro must never grant cloud operations. |
| Cross-platform acceptance | Existing evidence covers isolated desktop sync and a local mobile workflow. It does not cover the five-client release contract. Mac TestFlight has no observed installations. | Physical direct Mac, MAS Mac, Windows, iPhone and iPad converge on one synthetic workspace; concurrent edits/issues/payments, conflict review, offline recovery and shared artifacts pass PRD T02–T27 and T31–T32. |
| Shared-source baseline | Mobile packages the development renderer; the MAS candidate was ported from the public direct release. These are different current sources, not one reconciled release baseline. | Review accepted differences, choose the shared release baseline and run cross-runtime calculation/date/hash/issuance/history golden fixtures. Preserve concurrent edits; do not overwrite a source merely to make hashes match. |
| Complete local P0 behavior | Backup restore/import, evidence binaries and accountant export are unavailable or rejected in the bridge. Native store validation/transition checks are a subset of desktop validation. Client/recurring unsaved recovery is being completed separately. | Complete the PRD's P0 requirements, schema/history parity and durable recovery, or explicitly obtain a scoped product decision before changing the approved release requirements. Simulator layout fixes cannot close these gates. |
| Physical usability and lifecycle | Manager reports an available iPhone 14 Pro with Developer Mode enabled. That establishes a test device, not a passed test. Simulator geometry, keyboard and PDF checks remain useful partial evidence. | Signed physical iPhone and iPad acceptance: VoiceOver, large text, reduced motion, focus/keyboard/rotation/split view, interruption/reboot/locked storage, real share completion/cancel/Files/AirPrint and long multilingual PDFs. Record device/OS/build/fixture/actual result. |
| Distribution and listing | Current package scripts compile with `CODE_SIGNING_ALLOWED=NO`; project has no checked-in `DEVELOPMENT_TEAM` or demonstrated iOS distribution provisioning. The manager reports an existing developer account; imported Mac signing identities alone do not prove iOS provisioning. | Select the existing team, validate the registered bundle/capabilities and iOS development/distribution provisioning, archive/export/validate the normal Release bundle, then TestFlight. Confirm final version/build, icon, privacy report, encryption answers and iOS-on-Mac availability. |

PRD ownership and acceptance definitions: [mobile PRD §§17–20](../../docs/PRD-MOBILE-EXTENSION.md). Native code: [store](ios/App/App/BillNgaiStore.swift), [host](ios/App/App/BillNgaiNative.swift), [bridge](web/mobile-bridge.js), [project](ios/App/App.xcodeproj/project.pbxproj). Existing server evidence: [MAS Apple receipt verifier](../../BillNgai-MAS-Pilot/services/sync-coordinator/src/appstore.ts).

### Baseline fingerprints inspected

| Renderer | SHA-256 |
| --- | --- |
| `BillNgai-development/billing.html` | `459c7c1792270d0d56dd7a025760c7ac07b1a08567813a9c072a1071f8aef018` |
| `BillNgai-MAS-Pilot/billing.html` | `53eea693001c1e0c4f6390afe1aaf45efc1182fbf93505a8ad6b1429d597cd53` |
| `BillNgai-release-2.0.10/billing.html` | `a36927771baed1404d6f8bb4ba5fb0662591b44e17f17517e8c0ebcc6a75d9c9` |

These differences establish separate inputs; they do not alone prove divergent financial outcomes. Record a reviewed source manifest and final accepted fixture results for the candidate.

## Privacy manifest audit and correction

`BillNgaiStore.backups()` reads `.contentModificationDateKey` and file size from files in the private application-support backup directory, then shows their dates/size locally. Apple's required-reason list includes `contentModificationDateKey` in `NSPrivacyAccessedAPICategoryFileTimestamp`. `C617.1` matches accessing metadata of app-container files. The app must declare its own API use rather than rely on a linked SDK's manifest. [Required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [API categories and reasons](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)

The initial audit found no app manifest/resource reference. The manager then added [App/PrivacyInfo.xcprivacy](ios/App/App/PrivacyInfo.xcprivacy) and included it in the app target's Resources. Source reinspection confirms:

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
  <dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array><string>C617.1</string></array>
  </dict>
</array>
```

**Source correction complete; distribution-artifact acceptance remains open.** Rebuild the final normal Release archive and confirm `App.app/PrivacyInfo.xcprivacy`, lint all manifests, generate Xcode's aggregated privacy report and validate the archive. Root placement and target-resource membership matter. [Add a privacy manifest](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk)

No direct UserDefaults, system-uptime, disk-capacity or active-keyboard usage was found in the inspected BillNgai native and npm Capacitor/Cordova sources. Do not add unused reason categories as a blanket fix. This search is not proof about every instruction in a binary SDK; reevaluate when adding OAuth, asset, storage-pressure or other plugins.

The resolved Swift package uses **binary** Capacitor/Cordova 8.5.2 XCFrameworks, not the npm source files directly. Both binaries include valid empty privacy manifests, and both resolved XCFramework signatures passed local `codesign --verify --strict`. The existing unsigned device build includes their framework manifests; it predated the new root app manifest. An empty SDK declaration does not cover BillNgai's timestamp API. Capacitor and Cordova appear on Apple's SDK requirements list; keep their manifests and validate SDK signatures in the final distribution flow. [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)

The new app manifest's empty collected-data array and tracking false describe the **current local prototype**. Do not carry that conclusion into the final cloud product without a fresh data-flow audit. Required-reason API declarations and App Store privacy disclosures address different questions.

## Privacy policy, listing and reviewer material

The checked-in [MAS privacy policy](../../BillNgai-MAS-Pilot/docs/privacy.html) is dated July 10 and says all data stays only on the Mac, no server stores user data and the developer collects no data. That is unsuitable as a final description of the PRD's coordinator/account/entitlement metadata. The manager must verify the actual App Store policy URL: this source audit cannot establish which policy is currently published or linked.

Before submission, document the final flows and retention: on-device billing and credentials; user Drive payloads/assets; coordinator revisions/file references/document numbers/account claims/operation results; Apple entitlement bindings; redacted diagnostics. Assess linked user/device identifiers, purchase history and any retained financial/user content under Apple's definitions. Data processed only locally and Apple-only purchase processing must not be mislabeled as developer collection; ongoing off-device functionality must not be dismissed merely because it is optional. Publish accurate privacy/support URLs and App Store disclosures. [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

Prepare real **iOS/iPadOS** release screenshots in supported dimensions using synthetic records. Existing Mac screenshots and simulator audit screenshots are evidence, not automatically final listing assets. Keep Thai/English copy, non-VAT receipt limitations, data sharing and Pro descriptions accurate. Include review instructions for restoring the existing product and joining a separate approved sandbox Google workspace without exposing customer data or weakening production validation. Reassess the final login/account-deletion/unlink design against the PRD's current-policy gates. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

For accessibility claims, test all common tasks, including first launch, settings and purchase, using the claimed feature. For BillNgai: find/create/edit a client, recover unfinished work, create/issue/share a document, record payment/receipt, review income and manage connection/Pro. DOM labels, native notifications and passing viewport measurements alone do not prove VoiceOver or Larger Text support. Test system accessibility sizes, with at least the enlargement required by Apple's label criteria, and complete common tasks without sighted assistance for VoiceOver. [Accessibility labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels), [VoiceOver criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/voiceover-evaluation-criteria), [Larger Text criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/larger-text-evaluation-criteria)

## Acceptance sequence for the same-SKU release

1. Close the Mac TestFlight real purchase/restore and receipt-authorized sync gate; verify existing owners, canceled/pending/refunded purchases and persistence. TestFlight uses sandbox transactions, so preserve restricted review/test-account handling. [TestFlight IAP testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testing-subscriptions-and-in-app-purchases-in-testflight/)
2. Finish the shared mobile OAuth/sync/assets/entitlement contract and baseline reconciliation; execute the PRD's five-client safety matrix on isolated synthetic workspaces.
3. Complete local recovery/accessibility and physical-device output/lifecycle checks; record all unfinished or failed cases as open.
4. Rebuild and validate a signed normal Release archive, its source manifest, privacy resources/report and product/bundle identity. Confirm it excludes `mobile-qa.js`, `mobile-ui-audit.js`, debug-only QA entry points and all customer/test credentials.
5. Prepare a concrete existing-record iOS platform listing, screenshots, privacy answers and reviewer package. Verify actual platform/product settings and Mac availability, then perform authorized TestFlight delivery and tests.
6. Submit only after the required acceptance records and owner's release authorization are complete. The Mac upload and mobile simulator passes do not make this a public universal-sharing release.

No production deployment, signing-material export, platform creation, upload or submission was performed by this audit.


## Manager validation update

Client/recurring durable recovery is implemented and passed signed physical iPhone
force-termination, raw-field restore, save-once and subsequent no-replay checks.
Native text-size/Reduce Motion/VoiceOver preference presentation is implemented;
14 largest-text simulator cases pass. The physical phone has so far reported
Small, so physical Larger Text and spoken VoiceOver remain open. The manager built
and installed only the separate synthetic development QA bundle, not the
production bundle. Normal Release compilation now includes the root app privacy
manifest and excludes all QA resources. This establishes development provisioning
and compile/resource checks; it does not establish distribution provisioning, an
archive privacy report or TestFlight delivery. Full evidence and current limits
are in `MOBILE-VERIFICATION.md`. The overall release decision remains not ready.

### Owner's iPhone UI refinement checkpoint

A4-proportion preview and native PDF opening, icon utility controls, optional
client/defaults/notes disclosure, and mobile audio removal are implemented. Normal
Release and simulator builds pass; 50 synthetic simulator UI cases pass, plus
force-kill draft recovery after the DOM moves. After the owner unlocked the phone,
all 10 physical cases pass: client, recurring, software keyboard, receipt PDF and
native PDFKit viewer, each in Thai/English (`review/iphone-ui-physical-summary.json`).
VoiceOver and physical maximum Dynamic Type remain unaccepted. This checkpoint does not close
the sync/entitlement/import/asset/privacy/listing gates or authorize a new SKU.
See MOBILE-VERIFICATION.md for exact evidence and limitations.
