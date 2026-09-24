# BillNgai 2.0.4 — release record

Updated 2026-09-24. Publication in progress; do not treat pending items as passed.

## Authority and source

Owner explicitly authorized finishing the signed/notarized installer and publication,
using `ssh field` and the successful 2.0.3 release setup. This supersedes the earlier
implementation-only authority checkpoint. No customer profile, installed app, or
original dirty checkout is authorized for test mutation.

Source checkout: `/Users/lighthouse-control/BillNgai-publish-2.0.3`.
Remote candidate: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-2.0.4-candidate`.
Application hashes remain those in `VERIFICATION-2.0.4.md`; final commit pending.
165/165 tests passed again during release preparation; `git diff --check` passed.

## Recovered build setup and corrections

- Approved OAuth JSON recovered on field from the previous release. Remote
  `npm run release:check` passes. Credentials remain excluded from Git/logs.
- Existing Developer ID Application / team `79QFYKTJMN` is used. Existing Apple
  API signing key and its non-secret identifiers were found in the original
  checkout's `secrets/build.sh`; the old script's key path is stale, so use the
  existing key file under `Personal-Project/apple-notorious-key`. Do not source
  a historical build script blindly or export private key material.
- Earlier unsigned/adhoc and manually deep-signed diagnostic outputs were not
  accepted for release. They also lacked the generated branded icon. Preserved
  for diagnosis, never publish their DMG/hash.
- Reused the prior release's `build/icon.icns` after verifying the source PNG
  SHA-256 matches exactly (`7881995adbfb4f086e15780119e3be85c2138a7ceddaa9c281de96d3deeed1a0`).
- A fresh electron-builder universal build uses `dist/2.0.4-final-stage` and
  identity `Visarut Sankham (79QFYKTJMN)`. Builder rejects a full identity name
  containing the `Developer ID Application:` prefix; corrected that option.
- Await every build/transfer process to exit. Initial packaging output is not a
  completed signed build. Never substitute manual recursive signing for this gate.
- Native stabilization harness now accepts an explicit packaged executable,
  while still asserting its fresh synthetic profile before touching fixture data.

## Remaining gates

Signed universal build completion; signed DMG; Apple Accepted; staple and Gatekeeper;
exact read-only mounted package source comparison and both native smoke tests;
final checksum; immutable R2 and GitHub downloads with anonymous hash verification;
website build, truthful disclosures, production deployment and live verification.

Cloudflare Pages authentication works on lighthouse-control (existing account,
Pages scope). Field has no Wrangler login. GitHub authentication works on both.
R2 upload follows the authenticated dashboard route used for 2.0.3.

## Boundaries

AI-assisted software audit is not practitioner/legal certification. Intel hardware,
Windows and Mac App Store verification remain separate. Receipt/tax/cloud/e-Tax
restrictions remain; see PRD and changelog. Preserve original documents and PDFs;
database JSON and evidence bundles are separate backups. No silent customer-data
migration, automatic app replacement, new customer messages or refund promises.
