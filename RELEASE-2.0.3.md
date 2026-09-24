# BillNgai 2.0.3 — Direct macOS release evidence

Built/verified: 2026-09-23, Asia/Bangkok. Publication resumed 2026-09-24.
Current status: **Direct macOS 2.0.3 released on 2026-09-24**. Public installer
bytes and production website verified. Windows and MAS remain pending.
Follow `DEPLOYMENT.md` and `mac_signing_notarization_plan.md`.

## Scope and authority

Owner authorized audit and release, including an owner-directed AI-assisted audit
instead of the proposed outside-practitioner prerequisite. This is not external
practitioner sign-off, legal certification, or validation of customer documents.
See `PRD-2.0.3.md`, `review/2026-09-23/THAI-FINANCE-AUDIT.md` and
`review/2026-09-23/FINAL-AUDIT-2.0.3.md` for official sources and limitations.

Direct macOS only, macOS 12+, Universal x86_64 and arm64. Native execution tested
on Apple Silicon, not Intel hardware. Windows remains 2.0.1 Beta; MAS remains
pending. No MAS submission, customer messages, price/refund changes, customer
records access, certificate export, or cloud credential replacement performed.

## Build identity

- Source commit: `49595e0567d397a7d334178615205ba41deb8748`.
- Isolated field worktree:
  `/Users/visarutsankham/Documents/Personal-Project/BillNgai-release-2.0.3`.
- Original dirty `Billiong-App` worktree preserved. Do not reset or mass-stage it.
- The final certificate fix and issuance regression were also synchronized into
  the original development tree after exact old-source hash checks and backups.
  Backup: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-final-fix-backup-DufSic`.
  Full original-tree tests then passed 81/81; unrelated changes were untouched.
- Electron 43.7.3; electron-builder 26.15.3.
- Developer ID Application: Visarut Sankham, team `79QFYKTJMN`.
- Hardened runtime and deep/strict signature verification passed.
- Packaged `billing.html`, `main.js`, `preload.js` matched the source commit;
  embedded package version was 2.0.3. Repeated successfully against final mounted DMG.

| Packaged source | SHA-256 |
|---|---|
| billing.html | d671a40a0f630a18b4662fa9e552a89dc644ba06712c7daed2ad7c74eea92f39 |
| main.js | 0e8ef215637afdd75510d4fbac3590592bfba5e35081aac997b33de89a2ad767 |
| preload.js | 0fa79788feba2b731ea4ae3947c2f9253df11203875d8d92d14b0f236667a5d1 |

## Verification

- Final source suite: 81/81 passed on field. Configuration, syntax and whitespace
  checks passed. Native source storage smoke passed with an isolated profile.
- Independent final focused audit: 55/55 passed. The missing withholding
  certificate carry-forward finding was fixed, with CSV/pending-count regression.
- Packaged smoke harness was corrected to wait for asynchronous DB loading after
  reload, including its initially null state. This test is not packaged application
  code; it does not change the signed source above.
- First signing attempt failed with `errSecInternalComponent` and unavailable
  keychain interaction over SSH. Login-keychain unlock succeeded; a fresh full
  build then completed. No password is stored in project files or this evidence.
- Apple notarization: **Accepted**, submission
  `e34ff452-a5b4-4d19-9e7c-7cb8fdeb0a99`, `issues: null`. Result and detailed log
  are saved under `review/2026-09-23/`. Apple's log hashes pre-staple bytes;
  the final distributed hash below is intentionally different after stapling.
- Stapling and validation passed. Gatekeeper accepted both final DMG and mounted
  app as `Notarized Developer ID`; mounted app deep/strict signature passed.
- Exact read-only mounted installer passed packaged storage recovery, sync IPC
  containment, ordinary receipt/frozen rendering, PDF, English summary and reload.
  Isolated fixture: `/var/folders/4_/yy75nyfs02544ssmwvlgvz980000gn/T/billngai-packaged-smoke-uM5Zr9`.
- PDF skill workflow: inspected the packaged-app PDF's text and rendered A4 page;
  Thai ordinary-receipt/non-tax-invoice wording, issuer/buyer, dates, 10,000 gross,
  300 withholding and 9,700 net all visible, no clipping. Synthetic fixture only;
  not verification of the sample tax ID or a prescription of a 3% rate.
- Final DMG: **223,450,345 bytes**, SHA-256
  `c0ba00307457f9e4db8540bbc3bbfde2d67850a46e4219acf6cb5080a4a7dc36`.

## Upgrade impact and public claims

Ordinary receipts only for confirmed non-VAT issuers, full-payment THB cases.
Tax invoices, VAT-registered issuer receipts, FX receipts, partial/deposit/refund
flows remain unsupported. WHT requires transaction-specific review. PIT payable/
refund estimates, cloud connect/sync/restore and e-Tax remain paused, including Pro.
Income classification is free. Being a freelancer does not prohibit VAT registration.

Back up data and retain original PDFs. All historical issued document types without
issuance snapshots remain review data, but authoritative reprint/share and status
changes are blocked, including marking old invoices paid and creating linked
receipts. Users with unpaid old invoices should contact support before upgrading.
The website and release notes were expanded to disclose this broader impact.

## Publication — verified 2026-09-24

- App source `49595e0567d397a7d334178615205ba41deb8748` pushed to app `main` and
  annotated `v2.0.3`. Tag remains the exact built source, not later evidence-only commits.
- [Public GitHub release](https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.3)
  published at `2026-09-24T05:20:23Z`, not draft. Both assets uploaded; GitHub's
  installer size and SHA-256 match the final artifact above.
- [Primary R2 installer](https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.3-universal.dmg)
  and [checksum](https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.3-SHA256SUMS.txt)
  uploaded through the authenticated existing dashboard after the owner enabled
  Chrome extension file-URL access. Upload reported 2/2 successful.
- Both public R2 and GitHub installers downloaded anonymously on field and passed
  byte-for-byte comparison and SHA-256 against the final stapled original.
  Files: `dist/2.0.3/r2-public-check.dmg` and `github-public-check.dmg`.
  A separate local R2 diagnostic download timed out after 600 seconds at 25,821,184
  bytes on the travel connection. That partial diagnostic is not a verified artifact
  and was never uploaded. The completed local publishing DMG itself passed SHA and staple validation.
- Website content commit `2af067cb2543880d19447795aa07acf20d2fb6e1` pushed to
  [billiong-releases](https://github.com/visarutforthaipbs/billiong-releases).
  Clean build and generated release assertions passed. Git push did not yield a
  new Pages deployment during the check, so the documented Wrangler fallback
  deployed tested `dist` to the existing project/production `main`.
- Production deployment: `8d125ac5-1c5f-43ba-be70-f5f47e4409f9`, source `2af067c`;
  [live website](https://billiong-landing.pages.dev/) and
  [deployment URL](https://8d125ac5.billiong-landing.pages.dev).
- Live landing, support and retired-demo HTML match the tested local build exactly.
  Chrome confirmed the 2.0.3 landing/download disclosure, correct primary URL,
  Windows 2.0.1 Beta separation, legacy-invoice warning and signed/notarized support
  guidance. Prior desktop/390px preview checks passed; no claim of Intel hardware testing.
- Pages CLI OAuth was renewed in the existing account, restricted to this account
  with Account Read, User Read, Background Access and Pages Write. R2 used the
  browser; no new API token, bucket, project or signing credential was created.
- No auto-updater metadata or pre-staple blockmap published. Previous 2.0.2
  installer retained. Website rollback reference: `7cd5b0981f2c077f161184d3cd2a37b374228da8`,
  deployment `559939d7-96ff-49d0-a39e-615db2b903b8`. Rolling back restores old risk
  behavior and requires a separate data-compatibility assessment.

## Historical publication preparation (superseded by verification above)

- R2 bucket: `billiong-releases`, account `7b6e1c302155d21e6cc1d807cc01f010`.
  Browser login verified; existing public bucket retained. R2 CLI lacks the
  required API token, so use the existing authenticated dashboard.
- Website repo: `visarutforthaipbs/billiong-releases`, prepared local commit
  `121e102f98894124bed30e5b7dd84aa7e9f0d741`, not yet pushed. This includes
  generated-page regression assertions for the broader historical-document warning.
- Website: `https://billiong-landing.pages.dev/`, project `billiong-landing`.
- Binary GitHub fallback: `visarutforthaipbs/local-bill-apps`, tag `v2.0.3` pending.
- Installer and checksum must be uploaded and their public bytes checked before
  publishing website links or signed/notarized claims. No in-app auto-updater;
  do not publish pre-staple blockmap/latest-mac metadata.
- Transfer was interrupted before completion. The partial local copy correctly
  failed its checksum and was NOT uploaded. Resume via SFTP `reget`, then require
  the complete final SHA-256 match before any publication. Remote final artifact
  remains intact at 223,450,345 bytes.

### Resumed transfer checkpoint — 2026-09-24

The complete installer is now at
`/Users/lighthouse-control/BillNgai-release-artifacts-2.0.3/BillNgai-2.0.3-universal.dmg`
on the authenticated publishing Mac. Its size and SHA-256 match the final remote
artifact exactly. Resuming with four SFTP requests and SSH keepalives completed
the interrupted download; no partial file was published. GitHub `v2.0.3` was still
absent and website upstream main remained `7cd5b0981f2c077f161184d3cd2a37b374228da8`.
Chrome file selection via extension returned `Not allowed`; owner was asked to
enable the documented file-URL permission. Do not claim R2 upload or website
deployment until those steps are visibly verified.
- Prior 2.0.2 artifact preserved; previous website commit
  `7cd5b098` retained as rollback reference. Reverting links would restore the old
  app's behavior, not provide the 2.0.3 safeguards; assess that risk before rollback.

## Remaining separate work

MAS and Windows ports/testing; practitioner review of wider workflows; reviewed
historical correction/payment workflow; customer support/refund decisions; full
security/PDPA audit and build-dependency update. Website's existing Astro dependency
advisories are tracked in its `RELEASE-2.0.3.md`; no affected public runtime path was
identified for this static build, not a claim of vulnerability-free dependencies.
