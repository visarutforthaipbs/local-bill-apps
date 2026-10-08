> This copy is the isolated 2026-10-04 data-integrity/SQLite source candidate.
> See [the implementation contract](../docs/SQLITE-IMPLEMENTATION-2026-10-04.md) for its
> new storage/validation and final checks. Earlier prototype notes below are historical.
> Live OAuth/Pro/device acceptance and integration with the active mobile UI remain gates.

# BillNgai iPhone / iPad native prototype

Implementation started 2026-10-03. This is the mobile host for the existing
BillNgai product: bundle `com.visarut.billngai`, Apple Pro product
`com.visarut.billngai.pro`, existing Apple SKU `billngai-mas`. No separate SKU,
subscription or purchase product was created.

Read [the mobile PRD](../../docs/PRD-MOBILE-EXTENSION.md) and
[verification / remaining gates](MOBILE-VERIFICATION.md) before continuing.
The [2026-10-03 UI/UX audit](UI-UX-AUDIT-2026-10-03.md) records phone fixes,
expanded native evidence and remaining usability gates.
**Cross-device sync is not implemented in this prototype.** Use synthetic data.
The installed Mac app and its customer profile are separate from these simulators
and the separately signed physical QA bundle `com.visarut.billngai.qa`.

## What runs

- Bundled current `../billing.html`, with the same financial calculations,
  confirmation steps, frozen documents and payment deduplication.
- iPhone bottom navigation and iPad sidebar: Home, Documents, Clients, More.
  Existing orange/cream colors, fonts, icons and document branding are retained.
- Native atomic JSON storage, stale-write protection, issued-fact guards and
  backups before replacing saved data. Client/recurring unsaved edits have a private
  native revision-guarded scratch cache, explicit Restore/Discard and save-once
  cleanup. Restoring unsaved work does not issue a document or save a record.
- Native text-size, Reduce Motion and VoiceOver preference adapters; larger text
  reflows cards/forms and allows whole-dialog scrolling. Physical feature acceptance
  is tracked separately from source/unit tests.
- Native A4 PDF generation and share sheet; JSON / CSV text exports use native
  sharing. Cancellation does not claim completion. PDF sharing also offers
  the OS-supported print actions.
- StoreKit 2 purchase/restore implementation for the existing Pro product,
  secure proof persistence and interrupted/deferred transaction delivery.
  Real Apple purchase/restore and shared entitlement verification remain untested.

Unsupported cloud connection, import/restore, external file locations, evidence
files, accountant ZIP export and AI/license-code controls are hidden or rejected.
The app labels this stage as a prototype. Local JSON export is available.

## Local setup

Requires macOS, Node 22+ and selected Xcode 26+ with an installed iOS simulator
runtime. This Mac was verified with Xcode 27 / iOS 27. Capacitor packages and the
Swift package are pinned to 8.5.2. No React, Flutter, Tailwind or second financial
implementation is introduced.

From this directory:

```sh
npm ci
npm test
npm run test:native
npm run test:shared
npm run build:simulator
npm run ios:open
```

Choose a **dedicated test simulator** in Xcode. The generic simulator build is
`.build-simulator/Build/Products/Debug-iphonesimulator/App.app`.
In Xcode 27, open the visual preview through **Xcode → Open Developer Tool →
Device Hub**. [Apple's Device Hub documentation](https://developer.apple.com/documentation/xcode/device-hub)
`npm run build:device` compiles the Release iOS target **without signing**; it
does not produce an installable/distributable IPA. Device provisioning,
App Store configuration and publication are separate remaining steps.

`npm run sync:ios` regenerates the allowlisted web bundle and copies it into the
native project. Run it after renderer/assets/host changes. Do not edit `www/` or
`ios/App/App/public/` by hand. The packager derives native launch color/logo/icon
from the existing source; it creates the required opaque 1024px icon without
changing the approved master. Standard builds exclude synthetic QA scripts and
disable Capacitor logging.

## Synthetic native workflow checks

The debug-only check uses an **empty simulator profile**, creates an invoice,
records its payment, issues an ordinary receipt and verifies one income item.
It deliberately leaves an unfinished quotation edit for a termination/relaunch
recovery check. It must never be launched against customer data.

```sh
npm run prepare:web -- --qa
npx cap sync ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .build CODE_SIGNING_ALLOWED=NO build
```

Install `.build/Build/Products/Debug-iphonesimulator/App.app` into a newly created
test simulator, then launch with `--billngai-qa` using `xcrun simctl launch`.
The result is in that app container's `Documents/mobile-qa-result.json`; its
synthetic receipt is `Documents/mobile-qa.pdf`. Terminate and relaunch with the
same flag **without uninstalling** for the second phase. The second phase clears
the recovered edit; start a fresh test profile for another full pair of runs.
Return to `npm run sync:ios` afterwards to remove QA resources from normal builds.

The existing isolated QA devices are listed in the verification document. Do
not uninstall this bundle from any other simulator or physical device.

For the expanded UI audit, prepare with `npm run prepare:web -- --ui-audit`,
sync and compile the same DEBUG target. Install it only on a dedicated simulator
whose name starts with **BillNgai UI Audit **, then run:

```sh
node scripts/run-ui-audit.cjs DEDICATED_SIMULATOR_UDID review/ui-audit DEVICE_LABEL
```

The runner checks 18 screens in Thai and English with synthetic data. To retest
specific screens, set `BILLNGAI_AUDIT_SCREENS=editor,recurring`.
`BILLNGAI_AUDIT_SCREENS=clientKeyboard` checks the real software keyboard; select
that preview in Device Hub and tap Notes if WebKit requires a user gesture.
Hardware-keyboard-only or background attempts must not be recorded as software
keyboard passes. Return to `npm run sync:ios` for a normal bundle afterwards.

## Next implementation step

Obtain access to the existing Google Cloud project **`billngai`**. The browser
currently exposes a different project, `billngai-app`; do not create mobile
clients there. Configure an iOS OAuth client for the existing bundle ID and a
web/server client for backend ID-token verification in the correct project.
Then implement native Google auth and the shared sync/entitlement/asset contract
with desktop prerequisites and the PRD's five-client conflict tests. Google
sign-in alone must never set the workspace Connected state.

Local app metadata currently uses marketing version 2.0.12 / build 1 as a
prototype placeholder. Verify App Store Connect platform/build requirements
before choosing a distribution build number. Nothing here was uploaded or
submitted to Apple.


## Physical QA and editor recovery

Use only the separate `com.visarut.billngai.qa` development bundle on a registered,
unlocked physical device. Override the product bundle identifier at build time;
the production identity and existing Apple SKU stay unchanged. Never run a seed
harness in a customer container.

`npm run prepare:web -- --ui-audit --recovery-qa` includes DEBUG-only synthetic
checks. After `npx cap sync ios`, build Debug with the approved team and the QA
bundle override. Install without uninstalling between recovery phases. Launch with
`--billngai-qa --billngai-recovery-qa --recovery-phase write`, force-terminate the
QA process, then launch phases `restore` and `check` with another termination
between them. Read `Documents/mobile-recovery-qa-result.json` from that QA
container only. The check refuses a profile without `DB.meta.mobileSynthetic`.
Physical evidence is in `review/recovery/physical-iphone/`.

UI checks use `--billngai-qa --billngai-ui-audit --audit-screen client` and an
`--audit-language en` or `th` argument. Results include actual native accessibility
preferences and computed font sizes. Small/default results cannot certify Larger
Text; DOM geometry cannot certify spoken VoiceOver navigation. Restore the normal
QA-free bundle with `npm run sync:ios` before normal builds.

### iPhone presentation (2026-10-03 owner revision)

The native mobile host keeps orange/cream, replaces familiar utility actions with
named 48-point icons, retains Save/Issue/destructive labels, and collapses optional
client contact/defaults and recurring notes. Existing inputs stay connected for
native scratch recovery. Built-in guides/SFX and the Sounds tab/audio asset bundle
are omitted on mobile; OS VoiceOver remains supported but manual acceptance is open.

Documents retain their authored A4-width layout, with uniform screen scaling and
A4 minimum proportions. Long HTML previews are continuous; use the PDF button for
actual print pagination, selectable text, pinch zoom and native sharing. There are
no raster PDF thumbnails. Printing removes the screen transform/minimum height.
The native viewer and export reuse a token-bound cached canonical PDF, refuse stale
selection, and keep cancellation distinct from successful sharing. File previews
and documents never receive app Dynamic Type reflow.

Applied guidance: installed `mobile-ios-design` skill (HIG clarity, disclosure,
icons, touch targets and safe areas); no framework rewrite or new SKU.
