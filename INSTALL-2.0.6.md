# Owner-directed 2.0.6 installation

**Completed 2026-09-25:** private signed/notarized 2.0.6 installed at
`/Applications/BillNgai.app`, verified and left open on the dashboard.
Original 2.0.5 and full current profile retained in
`/Users/lighthouse-control/BillNgai-update-2.0.6`. Public release remains 2.0.4.
The progress entries below are chronological; pending notes were superseded by
the final installation evidence at the end.

2026-09-24: owner authorizes replacing installed private 2.0.5 with the update
fixing the misleading dashboard and including the bulk correction-review screen.
Retain old app and full current profile for rollback; do not permanently delete
them. This authorizes local installation, not public publication or accepting
customer payment matches/correction proposals on the owner's behalf.

Dashboard now shows an incomplete received total when ambiguous groups exist,
plus provisional historical amounts from eligible pairs only. Eligibility requires
one paid invoice and one issued receipt linked by parent/client, exact matching
amounts/date, THB, zero VAT, no deletion/void/conflict/installment/payment identity.
User selects and explicitly confirms each pair is one payment, adds a note, then
the app backs up and appends payment_match source snapshots. Reporting counts
the selected representative once; changed group membership/source invalidates the
match. No original document, payment ID, issuance snapshot or tax validity is altered.
Deleted and conflicting records remain visible for individual review and are not
silently discarded or automatically accepted. Current data has not been matched.

182 automated tests pass. Isolated payment UI native smoke passes backup/save/reload,
one-payment reporting and retained tax-output restrictions (`billngai-payment-match-HtRmOR`).
Actual restored database copy passes isolated source-runtime preservation test:
44 client records / 78 document entries / 47 non-deleted documents / 12 deletion
markers (`billngai-recovery-check-NYRUBw`). Customer data stays local.

Signed/notarized packaging, exact packaged tests, rollback capture and installation
are pending. Record real completion below. Public version stays 2.0.4.

## Build progress

Reviewed source commit: `8da524f7a33d17d3bff516adb27cc245ac91154b` (local only).
641 literal translation keys checked, none missing. Bulk native smoke also passes
after dashboard integration (`billngai-bulk-review-I8I95k`). On the owner's unchanged
data the provisional dashboard yields 7 eligible pairs / THB 52,100; 12 other groups
remain excluded for individual review. No matches have been saved to that profile.

Separate field build folder: `Documents/Personal-Project/BillNgai-private-2.0.6`.
Approved OAuth validation passes there. Source-only archive/bundle transferred;
customer data not transferred. Signing is running with the existing Developer ID.
The older storage smoke run locally reached its OAuth configured assertion and
failed because this checkout has no OAuth secret; rerunning that gate on field
with the approved configuration, not changing the assertion or supplying fake keys.

Field native storage gate now PASS: boot lock, missing/returning external data,
recovery, save/reload, TH/EN backup history, ordinary receipt issuance/frozen
paper/PDF, and failed-editor-save handling. Isolated fixture:
`billngai-electron-smoke-QwyDEO`. Expected DATA_MISSING/DATA_CHANGED_ON_DISK
fixture errors are asserted negative paths, not failures of the gate.

Signed build finished successfully. Deep/strict signature passes and all 17
packaged tracked files match reviewed source; packaged identity/OAuth valid.
app.asar SHA256: `ad961762851425bb80882cbc6f709cebf0600f89718b6af2085f1fee28dd58e2`.
Packaged native checks on field PASS: release smoke (`billngai-packaged-smoke-zLN4vw`),
stabilization (`billngai-204-native-0L164Z`), payment matching
(`billngai-payment-match-n0umNq`). All use isolated synthetic profiles.
Apple submission uploaded: `0fd288ba-922e-462a-bfd0-5e063e7ac8e4`; result pending.

2026-09-25 (local): Apple **Accepted**, submission log issues null. Stapling and
validation pass; app and DMG Gatekeeper both report Notarized Developer ID.
Final DMG: 223,510,440 bytes; SHA256
`a5f1219710eba464a45b9bd14f2b8938d8465b7ba36a09a56e4693cc8fd0fa27`.
Transfer to the local private update folder is in progress; installation pending.

Owner app quit normally through UI. Full current profile copied to
`/Users/lighthouse-control/BillNgai-update-2.0.6/profile-before-update`;
76 regular files verified byte-for-byte. This is the current restored profile,
not the earlier pre-September-23 restore backup. Current billing SHA256 at capture:
`1d55a8a90f6a0cb3bc8fd73f05440edcc1f0f2fb56285f7a9bb6e40d049f2e77`;
44 clients / 78 document entries / 0 review events. Use this baseline for update
preservation checks; the app may refresh non-document runtime metadata on open.

## Final local verification and installation

Transfer completed (exit 0); local final bytes/SHA match field exactly.
Read-only DMG mount `/private/tmp/billngai-private-206-mounted`: deep/strict
signature, Gatekeeper, stapler, all 17 packaged source files and OAuth gate PASS.
Exact mounted executable passes packaged release smoke (`billngai-packaged-smoke-FWZ1r6`),
payment-match smoke (`billngai-payment-match-cxOhRE`) and current customer-data
copy preservation/reload (`billngai-recovery-check-IOWwr0`, 44 clients / 78 entries /
47 not-deleted / 12 markers). Customer input file unchanged; isolated profile only.
Synthetic dashboard screenshot `billngai-payment-match-RLmg3K/dashboard-before.png`
visually reviewed: provisional and included totals clearly separated, legible controls.

Installed via verified staging copy, preserving old application as
`BillNgai-update-2.0.6/BillNgai-2.0.5-original.app` (version verified 2.0.5).
Installed signature valid and CFBundleShortVersionString verified 2.0.6.
Owner profile visibly loads 47 documents / 38 active customers. Dashboard shows
THB 52,100 under รายรับเดิมรอยืนยัน, 7 eligible pairs and 12 other groups; received
total explicitly incomplete, not asserted as zero income. Documents → bulk review
opens, delivery defaults unknown and historical VAT confirmation remains unchecked.
No owner payment match, correction event or issued replacement was submitted.
Normal quit and relaunch verified; documents, clients, reviewEvents (0), recurring,
counters and business data deep-equal the rollback copy. All top-level data values
unchanged after the first launch/quit. App left open on the dashboard.

Rollback: quit normally before restoring the retained app, preserving the current
profile again first. Never automatically restore an older database over new work.
Do not launch the rollback app alongside the current app against the same profile.
Public release/tag, R2, website and other platforms unchanged. No Intel-hardware,
live Drive/two-device or practitioner approval claimed by these local checks.
