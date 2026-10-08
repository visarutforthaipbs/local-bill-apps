# Native mobile implementation checkpoint — 2026-10-03

**Status:** Working local iPhone/iPad prototype. Cross-platform data sharing and
App Store readiness are incomplete. This is partial implementation toward PRD
M1/M2; neither milestone is closed. M0 desktop TestFlight/prerequisites and
physical-device/synthetic workspace join gates remain open.

**UI audit follow-up:** the supplied phone screenshots exposed gaps in the earlier
document-list checks. Read [UI-UX-AUDIT-2026-10-03.md](UI-UX-AUDIT-2026-10-03.md).
Modal containment, readable paper previews, labeled recurring/split editors,
report/assets/date-field overflow, keyboard focus/action visibility, touch targets,
dialog navigation and backup capability feedback have been corrected in mobile
adapters. 112 native synthetic cases pass across two phone sizes and iPad in Thai
and English, including four software-keyboard cases. Seven bridge tests, 26 native
store assertions, 33 financial tests, normal simulator and unsigned device builds
pass. The shared renderer hash below is unchanged. Client/recurring unsaved recovery,
physical accessibility/keyboard/rotation and long-PDF gates remain open.

Evidence: [expanded matrix](review/ui-audit/matrix.json) and the audit's linked
before/after images, native PDF and financial/relaunch records. The earlier table
below describes the original prototype checkpoint; its limited portrait list
coverage must not be read as whole-app usability approval.

## Identity and source

| Item | Observed value |
| --- | --- |
| Native bundle | `com.visarut.billngai` |
| Existing Apple product | `com.visarut.billngai.pro` |
| Intended existing Apple record / SKU | `6789503350` / `billngai-mas`; no record/product changes made |
| Local target metadata | 2.0.12 / build 1; prototype placeholder |
| Minimum target | iOS 16, iPhone and iPad |
| Toolchain | Xcode 27.0, iOS 27.0 runtime |
| Capacitor npm / Swift package | Exact 8.5.2 |
| Renderer | Current `BillNgai-development/billing.html`; development base 2.0.9 plus existing uncommitted work |
| Renderer SHA-256 | `459c7c1792270d0d56dd7a025760c7ac07b1a08567813a9c072a1071f8aef018` |

The renderer is **not a claim of reconciliation with the public 2.0.12 release**.
Desktop source was not overwritten. Mobile style/bridge files compose with the
existing renderer; the packager changes viewport, local resources, CSP and CSV
completion feedback, without changing formulas or issuance logic. Current
desktop journal/menu/Node-only services are not ported by setting `isElectron`:
that compatibility flag selects the native renderer path, while explicit mobile
capabilities describe what the host actually supports.

Native disk revision is a SHA-256 of the saved JSON bytes, used only for local
optimistic concurrency. It is **not** the server's canonical record hash/cursor.
Non-null `syncV3` saves are refused until the mobile coordinator adapter exists.

## Passed checks

| Check | Evidence / result |
| --- | --- |
| Native storage | 26 synthetic assertions: exact bytes/unknown fields, restart/device ID, backup-before-write, stale/external writer rejection, issued/payment/review-event immutability, tombstones, corrupt/missing data refusal, unsupported/fractional/boolean schema versions |
| Host bridge / packaging | 6 Node tests: ACK-based ordered saves, failed-save revision retention, explicit unavailable capabilities, file-export cancellation/content, selected PDF identity, existing identity, bundled-only CSP, no credentials/QA in normal bundle, opaque 1024px icon |
| Existing financial rules | 33 unchanged issuance/reporting tests pass; `review/shared-rules-tests.log` is local generated evidence |
| Simulator Debug build | Xcode build succeeds; final normal bundle also compiles |
| Device Release compile | `npm run build:device` succeeds with signing disabled; no IPA/install/distribution validation implied |
| Synthetic workflow | On both devices: draft → issued invoice → paid → ordinary receipt; 2 records, shared payment, one net-income item of ฿970, native issued-edit rejection and backups |
| Native PDF | Both exports: A4, one page, ใบเสร็จรับเงิน / Receipt, ฿970.00; wrong selection rejected; text checks and rendered visual inspection pass for this fixture |
| Termination / relaunch | Both retain issued records/snapshot and offer/recover the unfinished quotation edit; `review/qa-relaunch.json` |
| Adaptive documents | Four visible navigation destinations, ≥44px targets, readable identity widths (phone 160px, tablet 352px), no whole-page horizontal overflow on these portrait fixtures |

Evidence: [first run](review/qa-first.json), [relaunch](review/qa-relaunch.json),
[iPhone documents](review/iphone-documents.png),
[iPad documents](review/ipad-documents.png),
[iPhone PDF](review/iphone-receipt.pdf), [iPad PDF](review/ipad-receipt.pdf).
All records/files are synthetic; installed Mac/Windows apps and real billing
profiles were not accessed by these tests.

Dedicated simulator IDs used:

- `BillNgai QA iPhone` — `1DB7DC33-7D64-4623-9264-2E699B325FEF`, iPhone 17 Pro.
- `BillNgai QA iPad` — `176EE3B2-3748-47D2-9028-B4099AC46B13`, iPad Pro 11-inch M5.

The workflow evidence was captured in the debug QA bundle. Native text exports,
hidden unsupported controls and branded launch assets compile in normal builds;
real share-sheet completion/cancellation remains a manual/physical gate. These
PDF/storage checks do not prove native Google sync, Apple ownership continuity
or every export format. Xcode 27's preview app is Device Hub. It was opened, but
native UI automation could not inspect its window because the control Mac was
locked; simulator-runtime screenshots provide the recorded app views.

## Corrections found during implementation

- Generated Capacitor SceneDelegate bypassed the custom controller, leaving the
  native bridge unregistered; it now creates `BillNgaiViewController`.
- Desktop compact rows squeezed identity text on iPad; mobile layouts stack the
  date/footer and use the same four labeled destinations at tablet size.
- Desktop screen-only trail leaked into native PDF; mobile print rules hide it.
  Resetting viewport minimum heights removed an extra blank iPad PDF page.
- WebKit mapped Inter tabular digits to private-use PDF text. Printed paper uses
  normal numeric glyph variants, preserving visible values and searchable ASCII
  amounts. Some Thai shaped-glyph text extraction is still imperfect despite
  visually correct Thai; broader text/search and long-document tests remain open.
- The approved icon master has an alpha channel/non-1024 dimensions. Packaging
  now generates an opaque exact 1024px derivative for iOS; master untouched.

## Security and failure behavior implemented

Billing JSON is private application-support storage: bounded schema validation,
serialized writes, file synchronization/atomic rename, directory synchronization,
private permissions and iOS first-unlock file protection. Unknown fields are
retained. Corrupt/missing initialized data cannot become an autosaved blank store.
Every changed save retains the previous file. Current native validation is a
foundation and must be brought to full desktop schema/transition parity before
import or cloud activation.

OAuth is not present and no mobile token was created. Apple verified transaction
proof stays in native Keychain (`AfterFirstUnlockThisDeviceOnly`), never in JS,
backup JSON or worker context. Delivery is finished only after secure proof
persistence; unfinished/deferred transactions have a listener. Revoked/unverified
ownership does not grant Pro, and `cloudReady` remains false. Actual StoreKit
purchase, restore, pending, refund and Keychain failure tests remain open.

Bundled UI only; no remote server URL or external top-level native bridge
navigation. CSP disallows browser network connections and embedded frames. Native
PDF/export callbacks distinguish OS completion and cancellation and make no
recipient-delivery claim. Native logging is disabled in normal builds.

## Required continuation before shipping

1. Reconcile accepted desktop/public shared-core baseline and M0 known sync/UI
   issues without overwriting concurrent development changes. Expand golden
   fixtures and native validation/history compatibility checks.
2. Access Google project `billngai`; current signed-in Console account sees only
   the different `billngai-app`. Owner account-switch question is pending. Do not
   invent client IDs, create a replacement workspace/project, or reuse an installed
   desktop client as the mobile/web server client.
3. Native Google SDK/system OAuth, secure refresh/token handling, verified subject
   and trusted mobile/server audiences; canceled/rejected auth stays Not connected.
4. Shared coordinator protocol, staged bootstrap/activation, durable replica/outbox,
   idempotent reservations/finalization, conflicts, account switch and recovery.
   Never permit offline local numbering after workspace binding. Assets/evidence/
   PDF transfer and >512-record bootstrap must work across all five clients.
5. Server verification of modern Apple proof and unified workspace Pro access,
   retaining current MAS/direct license compatibility. Current coordinator support
   for MAS receipts is not proof that this iOS JWS path is integrated.
6. Backup import/restore, evidence attachment bundles, accountant ZIP, storage-pressure
   behavior and the remaining P0 local workflows. Unsaved edit recovery currently
   uses shared WK localStorage, verified for simulator termination; verify physical
   lifecycle/storage behavior and provide durable acknowledgement where required.
7. Signed physical iPhone/iPad tests: real Google join/sync, actual native sharing/
   AirPrint, long PDFs/languages, keyboard/safe areas, rotation/split view, Dynamic
   Type, VoiceOver, background interruption and the PRD's complete conflict matrix.
8. Existing App Store platform/product verification, real Apple purchase/restore,
   TestFlight, privacy/listing/review material and authorized submission. No physical
   iOS device was connected during this checkpoint; no App Store upload occurred.

Official integration references:
[Capacitor iOS](https://capacitorjs.com/docs/ios),
[native plugin code](https://capacitorjs.com/docs/ios/custom-code),
[Google iOS setup](https://developers.google.com/identity/sign-in/ios/start-integrating),
[Google sign-in / server-client configuration](https://developers.google.com/identity/sign-in/ios/sign-in).

## Worker review record

MiMo was invoked for bounded native-storage implementation (420 seconds) and a
smaller correctness review (180 seconds). Both ended at their local timeout with
no returned proposal/findings and no observed model identifier; this does not
establish quota/context exhaustion. No worker code was accepted or substituted
with another model. Codex implemented and executed the checks recorded above.
Private runner records have rejected `review.md` files:

- `~/.local/state/mimo-worker/20261003-165222-bqhf9pna/`
- `~/.local/state/mimo-worker/20261003-170306-9583xnvg/`


## Physical recovery and native accessibility continuation — October 3

Supersedes the earlier statement that client/recurring drafts had no recovery.
Implemented a private native atomic, revision-guarded scratch store for these two
editors, with explicit Restore/Discard, raw field preservation, stale-base refusal,
acknowledged writes before closing and a commit marker included in the same
billing save. A failed cache cleanup after a successful save cannot replay a new
client/recurring entry. Shared financial/issuance functions remain unchanged.

MiMo Pro supplied the bounded Swift draft store and initial tests; Codex reviewed
and hardened missing-file handling, Unicode controls, symlink rejection and read
size bounds. Private acceptance record:
`~/.local/state/mimo-worker/20261003-211350-j083zqtz/review.md`.
A separate accessibility MiMo review timed out after 600 seconds without findings;
it was rejected, not counted as validation. Codex/swarm reviewed the presentation
changes and ran the checks.

**Physical iPhone recovery passed.** iPhone 14 Pro, iOS 27.2 build 24B5089g,
separate signed Debug bundle `com.visarut.billngai.qa`, only synthetic records.
`review/recovery/physical-iphone/write.json`, `restore.json`, `check.json` show:

- write unfinished client and recurring forms without adding saved records;
- force-terminate the QA process, relaunch and restore raw fields;
- save through shared functions, obtaining exactly two clients and one recurring
  record including the original synthetic client;
- force-terminate/relaunch again; neither saved scratch entry is offered again;
- original issued invoice/receipt JSON is unchanged in every phase.

`write-first.json` is an intermediate run before device-scoped draft keys and is
not final acceptance evidence. Real customer containers were never seeded.

Native preferences now drive screen-only text scaling, measured phone navigation
height, large-text card/form reflow, whole-dialog scrolling, Reduce Motion feedback
and VoiceOver view-heading focus/image alternatives. Preference updates also run
on returning from Settings. Canonical paper/print is outside the scaling wrapper.

**Automated acceptance:** 35 mobile Node tests (7 bridge/package, 19 recovery,
9 accessibility), 26 native billing-store assertions, 31 native draft-store
assertions and 33 shared financial/reporting tests pass. Signed physical QA Debug,
normal unsigned iOS Release and normal simulator Debug compile. Root app privacy
manifest is present in the Release app. Normal bundles exclude all three QA
scripts; unsigned compilation is not a distribution archive or App Store upload.

**Largest-text simulator acceptance:** 14 focused cases (client, recurring,
document editor, split, receipt, More and business Settings; Thai and English)
pass with actual simulator iOS category `UICTContentSizeCategoryAccessibilityXXXL`,
native/applied scale 2.8125, and 45px input text. Both receipt PDF checks remain
one A4 page, with the correct title/net amount and unchanged frozen snapshot.
Evidence: `review/accessibility/simulator-max/phone-max-summary.json`.

**Physical accessibility remains open:** baseline client and recurring form
checks pass at Small, Reduce Motion on, VoiceOver off. Native application, view
controller and web view all report Small; these are not Larger Text passes. Owner
is adjusting the real phone setting. Largest text, software keyboard at that size,
spoken VoiceOver task completion, rotation, hardware keyboard and physical iPad
still require observed results. See the latest continuation below if added.

**Release state:** manager read-only App Store Connect check found macOS public
2.0.1/build 2.0.8 Ready for Distribution, and macOS 2.0.12/build 2.0.9 uploaded to
TestFlight as Ready to Submit. No 2.0.12 App Review submission or iOS platform was
observed. Read `APP-STORE-READINESS-2026-10-03.md`: mobile native Google OAuth/sync,
modern Apple proof verification/shared Pro, source reconciliation, remaining P0
workflows, archive/privacy/listing and physical acceptance still block shipping.
No platform/SKU/product creation, upload, public release or customer-data change
was performed.


### Physical text enlargement observed

After owner adjusted the slider, all three native readings changed to
`UICTContentSizeCategoryAccessibilityM` (Accessibility Medium). Applied scale
1.5416666666666667, inputs 24.666666px, headings enlarged. Client, recurring,
document editor and receipt checks pass in English with no geometry/target
violations; full-dialog footer actions are reachable. Physical PDF remains one
A4 page, correct ordinary receipt title/net amount, frozen HTML unchanged.
Evidence: `review/accessibility/physical-iphone/client-en-accessibility-medium.json`,
`recurring-en-enlarged.json`, `editor-en-enlarged.json`, `receipt-en-enlarged.json`,
and `receipt-accessibility-medium.pdf`. This is an actual enlarged-text physical
pass, **not maximum-size or 200% acceptance**. The maximum category still requires
physical checking. VoiceOver enablement/task completion is requested next.

### iPhone UI direction supersedes the reading-card preview — 2026-10-03

Owner explicitly changed the requirement: keep document A4 proportions or show a
PDF, without squeezing/reflowing paper. `mobile-print-preview` now scales authored
A4 HTML uniformly (820×1160 minimum); PDFKit opens the actual generated file on
request. Raster thumbnails were removed. Screen transforms/min-height do not enter
print output. Dynamic Type excludes all paper, including its preview wrapper.
Familiar utility icons retain translated accessible names and 48-point targets;
Save/Issue/delete stay explicit. Contact/default/notes disclosure preserves input
IDs and native draft capture. Mobile voice guides/SFX, Sounds tab and audio assets
are removed; this does not disable iOS VoiceOver.

Both MiMo Pro UI packets (`20261003-222921-_txtsqix`,
`20261003-224604-a8ekl0cp`) timed out at 900s, exit 143, no changes/observed model.
No proposals were integrated and no successful worker review is claimed. Manager
implemented the UI using the installed iOS design skill. Source review caught a
native share completion error path; manager now reports failure and keeps cancel
silent. The earlier thumbnail page-index finding became inapplicable after raster
preview removal. Native cached selection and rapid-opening guards remain.

New native PDF QA verifies PDFKit presentation, A4 page title/count, zoom range,
translated close/share names, and actual UIColor components. It caught asset catalog
integer-string red/alpha becoming 1/255; native tokens now use decimal fractions
and actual canvas measures (1, .976471, .952941, 1). This keeps the approved cream.
QA avoids requestAnimationFrame after fullscreen presentation, since the hidden
WKWebView stops animation frames. DEBUG result run IDs prevent stale physical reads.

VoiceOver manual testing was declined. Current physical test launch reads Small/XS,
so the latest pass does not establish physical maximum text acceptance. Prior AXM
results remain historical, not maximum-size claims. Store release remains gated by
mobile sync/entitlements/import/assets/privacy/listing and physical acceptance.

Final verification for this UI revision: 38 mobile Node tests; 26 native billing
and 31 draft assertions; 33 shared financial tests. 50 simulator cases passed:
28 standard phone layouts (14 screens × Thai/English), 14 largest Dynamic Type
phone cases (AXXXL), 6 small-phone cases and 2 native PDF presentation cases.
Exact evidence index: `review/iphone-ui-current-summary.json`. Signed physical QA
and unsigned normal Release/simulator Debug compiled. Normal app bundles contain
root PrivacyInfo.xcprivacy, omit all three QA scripts and omit audio assets. Shared
`billing.html` SHA256 remains
`459c7c1792270d0d56dd7a025760c7ac07b1a08567813a9c072a1071f8aef018`.

Updated UI recovery passed on the dedicated small-phone profile:
`review/recovery/iphone-ui-small/{write,restore,check}.json`. SIGKILL between phases,
raw hidden notes restored, one client/recurring saved, no replay, frozen documents
unchanged. The earlier phone-profile replay probe (`iphone-ui-replay-check.json`)
used a profile without the expected prior recovery records and is not acceptance.

Physical iPhone final acceptance after owner unlocked it: all 10 latest cases
pass (client, recurring, software keyboard, one-page receipt PDF and native PDFKit
viewer, each in Thai and English). All results use fresh matching run IDs; index:
`review/iphone-ui-physical-summary.json`. Native viewer confirms actual PDF pages,
A4 title, zoom range, translated close/share labels and approved opaque cream
canvas. Current phone reports XS/Small (app baseline clamped to 1), Reduce Motion
on and VoiceOver off; no maximum physical text or spoken VoiceOver claim. The
signed isolated QA app is installed and its Thai native PDF left open for review.
`receiptNative-en-iphone-ui-final.stale-read.json` is an obsolete copy rejected by
run-ID freshness, not acceptance evidence. No Store upload/submission was performed.
Prior release gates remain open.
