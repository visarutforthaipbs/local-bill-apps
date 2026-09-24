# BillNgai 2.0.3 — session handoff

Last updated: 2026-09-24. Owner: Visarut. Engineering manager: Codex.

## Read this first

**Superseding implementation session:** owner subsequently said “implement it all”.
The local 2.0.4 candidate now implements the audited fixes and supported legacy
review/recovery workflow. Read `SESSION-HANDOFF-2.0.4.md` and
`VERIFICATION-2.0.4.md` for current work/test evidence. The incident below describes
the unchanged installed/public 2.0.3 binary, not the modified candidate source.
No customer records or installed app were changed, and 2.0.4 is not released.

### Post-release incident — 2026-09-24 (unresolved)

Owner subsequently requested a swarm audit and legacy-handling design. Completed
three native parallel audits plus an external agy design critique (accepted only in
part; unsupported conclusions rejected). Coordinator independently reproduced 19
defect/risk scenarios. Read `review/2026-09-24/POST-RELEASE-AUDIT.md` and
`review/2026-09-24/LEGACY-RECOVERY-PLAN.md` before further work. Critical additions
include a second unsupported payment prompt, disappearing draft print labels,
quit-before-save completion, imported-ID handler execution and referenced-customer
purge. No application changes, customer-data mutations, Git publication or 2.0.4
release performed. Audit/proposals remain local uncommitted files pending direction.

Owner reports old documents show only the historical-review warning, and the
void/archive button does nothing in the installed 2.0.3 Mac app. Diagnosis confirms
the released code uses unsupported Electron `prompt()` and fails before persistence.
Legacy previews are deliberately suppressed by the current rendering guard; retained
records are still present. No real document was changed. See
`review/2026-09-24/LEGACY-DOCUMENT-DIAGNOSIS.md` for evidence and the missing test.
Implementation/new patch release awaits owner authorization; do not treat the
published release's earlier passing tests as covering this broken UI interaction.

**Current state: Direct macOS 2.0.3 released; public binaries and website verified.**

### Final publication checkpoint — 2026-09-24

- Source/tag `49595e0567d397a7d334178615205ba41deb8748` / `v2.0.3` is published at
  https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.3.
- Website https://billiong-landing.pages.dev/ now serves 2.0.3 from website repo
  `visarutforthaipbs/billiong-releases`, content commit `2af067cb2543880d19447795aa07acf20d2fb6e1`.
  Production deployment `8d125ac5-1c5f-43ba-be70-f5f47e4409f9`.
- R2 and GitHub public downloads both passed full byte/SHA checks on field.
  Live landing/support/retired-demo pages match the tested build; Chrome checked
  the production download dialog, restrictions and support guidance.
- Read `RELEASE-2.0.3.md` for exact artifact identity, Apple verification, public
  URLs, tests and rollback limitations. Later docs/test-harness commits do not
  alter the signed app or move its release tag.
- Local publishing repositories: `/Users/lighthouse-control/BillNgai-publish-2.0.3`
  and `/Users/lighthouse-control/BillNgai-site-publish-2.0.3`.
  Original dirty field `Billiong-App` remains preserved; final billing/certificate
  fix was hash-guarded, backed up and passed 81/81 there. Do not mass-stage/reset it.
- MAS/Windows, external practitioner review, customer policy, historical corrections
  and full security/PDPA review remain separate pending work. No certification claimed.
- All preparation/no-publication checkpoints below are historical, not current gates.

### Latest verified artifact

Read `RELEASE-2.0.3.md` for build source, hashes, notarization and isolated smoke
evidence. The keychain issue below was resolved and a fresh signed build succeeded.
Apple accepted notarization without issues; stapling, Gatekeeper for DMG/app,
mounted packaged smoke, source comparison and receipt PDF inspection all passed.
Final DMG is 223,450,345 bytes, SHA-256
`c0ba00307457f9e4db8540bbc3bbfde2d67850a46e4219acf6cb5080a4a7dc36`.
The installer transfer, R2/GitHub byte checks and live Pages checks have passed.

Final review also broadened the upgrade warning: all historical issued document
types without snapshots are retained for review but cannot be reprinted/shared or
have status changed, including old unpaid invoice/payment/linked-receipt actions.
This is now explicit in release notes, FAQ and the website. No historical evidence
was fabricated and no customer records were examined.

### Historical operational checkpoint — 2026-09-23 20:40 Asia/Bangkok

- Final reviewed app source is committed as `49595e0567d397a7d334178615205ba41deb8748`
  on `codex/release-2.0.3` in the isolated field worktree
  `/Users/visarutsankham/Documents/Personal-Project/BillNgai-release-2.0.3`.
  The original dirty `Billiong-App` checkout is preserved, not the authoritative
  final build source; do not reset or mass-stage it.
- Universal packaging reached signing but failed with `errSecInternalComponent`.
  Developer ID identity is present and valid. `security show-keychain-info`
  returned `User interaction is not allowed` over SSH. Owner was asked to unlock
  the login keychain locally on field. Do not bypass signing or export credentials.
- Notarization, stapling, packaged-app smoke and public artifact verification have
  NOT passed. No 2.0.3 binary, tag, source push or website deployment was published.
- Local GitHub authentication works. Cloudflare browser login is now verified in
  account `7b6e1c302155d21e6cc1d807cc01f010`; `billiong-releases` R2 bucket is
  accessible. R2 CLI still lacks its required API token; use authenticated dashboard.
- Website candidate was copied into the real local Git checkout
  `/Users/lighthouse-control/BillNgai-site-publish-2.0.3`; clean build and generated
  release assertions pass. Manager inspected mobile download and desktop support
  screenshots. Do not push/deploy its signed/notarized claims until artifact gates pass.
- Resume signing in the isolated worktree, then notarize/staple, test the exact
  mounted DMG, publish and verify R2/GitHub hashes, then publish website. Record
  final identifiers and replace this checkpoint with verified outcomes, retaining
  the failed attempt as history.

### Latest owner authorization — 2026-09-23

The owner requested completion and publication of 2.0.3, then said "you audit and
do it" after being told that external practitioner review had been proposed as a
gate. The owner directs an AI-assisted audit instead for this containment release.
This is **not external practitioner sign-off or legal certification**. Do not claim
that all Thai tax obligations or historical customer documents have been validated.

Current authority covers Direct macOS reviewed commits, signing/notarization,
tag/push, verified installer publication, and the corresponding website update in
`visarutforthaipbs/billiong-releases`. Windows and MAS remain pending; no MAS
submission is authorized by this scope. Customer messages, price/refund decisions,
license-key generation and access to actual customer records remain out of scope.
The owner reports GitHub login completed on "this MAC". The release manager verified
the local Mac login as `visarutforthaipbs`; field's GitHub login is still expired.
Use the authenticated local Mac for GitHub publication; do not print or copy tokens.

The prior 80/80 suite and source-smoke results below are historical evidence, not
proof of the final updated candidate. A later certificate-preservation audit fix
has a passing 15-test issuance regression suite. The release manager then verified
**81/81 full tests** and native Electron 43.7.3 source smoke on field's clean
`BillNgai-release-2.0.3` checkout; fixture location is in `VERIFICATION-2.0.3.md`.
The final checkpoint and `RELEASE-2.0.3.md` now record the separately verified
packaged-smoke, signing/notarization, public checksum and live website gates.
Source tests alone do not establish those results.

The earlier handoff and its no-publication state are preserved below as history.

Read in order:

1. This file, then [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md), and [BRAND.md](BRAND.md).
2. [PRD-2.0.3.md](PRD-2.0.3.md) and [VERIFICATION-2.0.3.md](VERIFICATION-2.0.3.md).
3. [Original finance audit](review/2026-09-23/THAI-FINANCE-AUDIT.md), including limits and official sources.
4. [DEPLOYMENT.md](DEPLOYMENT.md), [signing runbook](mac_signing_notarization_plan.md),
   [SKU.md](SKU.md) section 7, [DELIVERY.md](DELIVERY.md), and [TEAM.md](TEAM.md).
5. September release evidence in `review/2026-09-22/`; MAS-specific history in
   `EXTERNAL-REVIEW-2.0.7.md`, `RESUBMISSION-2.0.6.md` and the rejection playbook.
   Older drafts are history, not instructions to submit their old artifacts.

## User intent and sequence completed

- User asked to connect to their Mac over Tailscale using `ssh field`, understand
  the existing 2.0.2 app, research Thai finance law, audit risks, write a 2.0.3 PRD,
  use an agent swarm to implement, and have the manager review/fix the result.
- SSH temporarily timed out. Research, audit and candidate work used preserved
  source copies. After the user woke the Mac, source hashes were checked before
  integration into the existing dirty working tree.
- Research identified 12 risk groups. Important correction: being a freelancer
  does not itself prohibit VAT registration. The receipt/tax-invoice distinction
  depends on issuer status and the transaction. Do not claim all freelancers are
  legally barred from tax invoices, or that these code changes certify compliance.
- Three native agents implemented issuance, history and reporting; the manager
  integrated changes, fixed review findings and ran verification. See the detailed
  verification record for credited work and failed external-review attempts.
- User then requested review of every Markdown file and existing release practice.
  All 39 project-owned Markdown files were read, including hidden role guidance,
  drafts and historical audits; dependencies, `.git` and generated `dist` excluded.
  That review changed no project files and performed no release actions.
- This documentation follow-up adds the handoff and archived audit, links the
  handoff from both agent entry points, and corrects the PRD/verification wording
  about MAS version coordination. It does not implement the remaining tasks below.

## Delivered candidate scope

- New receipts limited to ordinary non-VAT, THB, full-payment cases, with explicit
  registration-status, actual payment-date and withholding review. Shared guards
  block tax invoices and unsupported issuance paths; finite/date/identity checks.
- Issued documents freeze particulars, financial values and rendering inputs.
  Editing/deletion is blocked; reasoned void/archive preserves evidence. No automatic
  180-day purge of document tombstones. Voiding is not proof of a refund.
- Legacy issued documents lacking snapshots remain retained but quarantined from
  authoritative reprint/export. No invented history or silent relabelling.
- Receipt creation uses payment identity/idempotency; duplicates are drafts.
  Reports avoid counting a paid invoice and its receipt twice. Classification is
  available without Pro; unknown categories are not treated as PND94 income.
- Unsupported PIT payable/refund estimates and unverified deadline extensions are
  suppressed. FX summaries use consistent pre-VAT bases with completeness warnings.
  Withholding is not automatically prescribed from category or currency.
- Cloud connect/sync/restore and custom e-Tax XML are paused in relevant UI/IPC.
  Local backup/export and disconnect remain; no cloud data or credentials erased.
- Manager also fixed CSV formula handling, missing-payment-date export behavior,
  snapshot buyer use, dashboard chart deduplication, translation gaps and explicit
  clearing of VAT on legacy drafts. Version/lockfile are 2.0.3; changelog/FAQ updated.

Containment is not completion of VAT, partial-payment/deposit/refund, foreign-currency
receipt, e-Tax, validated PIT, historical correction or multi-device workflows.
Existing customer documents are not legally cured by this update.

## Evidence and environment

Remote repo: `/Users/visarutsankham/Documents/Personal-Project/Billiong-App` on `field`.
Branch at handoff: `chore/2026-07-12-team-setup-sku-decisions`.
HEAD: `88ae910b12cc390b305a0bea428e5eda297776b2`.
The candidate includes uncommitted changes; HEAD alone does not identify it.
The dirty tree also contains earlier storage/release work and unrelated team docs.
Preserve them. Do not reset, clean, mass-stage, or copy an old snapshot over this tree.

Source SHA-256 rechecked during this handoff (before documentation-only updates):

| File | SHA-256 |
|---|---|
| `billing.html` | `b250c9fd2da5682c9f330a3459e17bcbe456afed85167b38459ba8d7a8313dc5` |
| `main.js` | `0e8ef215637afdd75510d4fbac3590592bfba5e35081aac997b33de89a2ad767` |
| `package.json` | `211bc6f2b92c000c200891200529cc47962bad9a1479096f68cb7360b7a60d24` |
| `package-lock.json` | `cff941601d7859e0c10b45c6833378c1b4bcc320796dfe47af28f376ba6b8a9e` |

Prior implementation evidence (not newly rerun for this doc update):

- `npm test`: **80/80 passed locally and on field** after final manager fixes.
- `release:check`, main/preload/inline syntax and `git diff --check` passed.
- Literal translation scan: zero missing keys after correction.
- Isolated Chrome workflow, Thai receipt/PDF and English summary visually checked.
- Final native Electron 43.7.3 source smoke passed using synthetic temporary data:
  storage locking/recovery/save/reload, frozen finalized receipt and PDF output.
  Expected `DATA_MISSING` / `DATA_CHANGED_ON_DISK` logs were test assertions.
- No 2.0.3 signed/notarized installer, packaged-executable smoke, public-download
  checksum verification, Intel hardware pass, Windows pass or MAS pass established.
- No real customer records, cloud workspaces, tokens or signing keys were used in tests.

Recovery/evidence locations (check existence before relying on them):

- On field, pre-change archive:
  `/Users/visarutsankham/Documents/Personal-Project/BillNgai-pre-2.0.3.iucTpL/source-before.tgz`.
  Same directory contains `electron-storage-smoke.cjs.before`.
- Remote implementation stage:
  `/Users/visarutsankham/Documents/Personal-Project/BillNgai-2.0.3-stage.LPIRhN`.
- On lighthouse-control: `/Users/lighthouse-control/BillNgai-2.0.3-candidate`,
  `BillNgai-2.0.3-baseline`, and `BillNgai-audit-2026-09-23` under the same home.
  Candidate `test-artifacts/` holds browser/PDF evidence. These are supporting
  copies, not authority to overwrite later remote work.
- The final native temporary fixture is recorded in `VERIFICATION-2.0.3.md`.
  Temporary folders may disappear; this repo handoff does not depend on them.

## Release-practice review: original findings and follow-up

Current follow-up: FAQ Gatekeeper guidance and current SKU/DELIVERY/TEAM feature
claims are corrected in this documentation candidate. Older drafts remain
historical and must not be published without review. BACKLOG records MAS/Windows,
historical/security review and existing-Pro-customer handling still pending.

1. **Channel coordination:** the original 2.0.3 PRD misleadingly described MAS
   2.0.6/2.0.7 as a separate version stream. Corrected in this doc update: they were
   upload build numbers. Policy is coordinated app SemVer plus a fresh MAS build
   number. Port shared fixes deliberately; do not copy Direct purchase/license UI
   into MAS. September records list MAS app 2.0.1/build 2.0.8 and Windows 2.0.1;
   these are historical records, not a live App Store Connect status check.
2. **Artifact evidence:** create an owner-authorized reviewed release commit before
   building. Signed universal build, notarization Accepted, staple validation,
   signatures/Gatekeeper, exact packaged smoke and source-to-commit comparison are
   gates. Notarization and source tests do not establish feature correctness.
3. **Product promises:** SKU/DELIVERY/TEAM, old PRD and support/marketing drafts still
   promise full tax features, sync and/or Pro-only classification. Reconcile current
   claims with containment and obtain the owner's decision on existing Pro customer
   handling. Do not invent refund/pricing policy or send messages.
4. **Unsafe support guidance:** FAQ and support draft call an "app damaged" warning
   normal and suggest opening anyway. This conflicts with the current deployment
   guidance. Correct before release; never disable Gatekeeper/remove quarantine or
   restore an explicitly blocked runtime to proceed.
5. **MAS reviewer path:** old review notes justify `network.server` through Drive
   sign-in. If containment is ported, re-audit the entitlement's actual usage and
   revise notes/metadata. Do not reuse disabled-feature walkthroughs or blindly
   remove entitlements required for Electron startup/sandbox behavior.
6. **Historical documents:** old pricing/parity rules, pending owner decisions,
   AI model examples, signing setup and superseded/rejected build instructions
   coexist with newer decisions. Mark/link superseded guidance rather than silently
   rewriting history. Current SKU decisions take precedence over old draft prices.
7. **Standing QA:** include legacy migration/retention, supported TH/EN documents,
   native window/menu behavior and per-channel pass/pending evidence. If Drive is
   ever re-enabled, test fresh-account granular consent and multi-device conflicts;
   prior authorizations mask failures. Do not enable it merely to satisfy old notes.

## Historical pre-publication checklist (superseded; see final checkpoint)

### Owner follow-up: website and release repository

During this handoff the owner asked why 2.0.3 is absent from
`https://billiong-landing.pages.dev/`, said it should be in
`https://github.com/visarutforthaipbs/billiong-releases`, and referenced `release.md`.
Read-only verification on 2026-09-23 established:

- The live landing page still labels Mac 2.0.2 and links the R2 2.0.2 DMG;
  its Windows download still points to 2.0.1. No 2.0.3 publication was performed.
- Website checkout: `/Users/visarutsankham/Documents/Personal-Project/promote-billiong`.
  `origin` is `https://github.com/visarutforthaipbs/billiong-releases.git`.
  It was clean at commit `7cd5b09` (`Update macOS download to 2.0.2 and refresh installation guidance`).
- Its `src/config/product.ts` still specifies Mac 2.0.2 and Windows 2.0.1.
  R2 hosts the primary installers; the configured GitHub fallback currently points
  to `visarutforthaipbs/local-bill-apps` release assets, not `billiong-releases` assets.
  Do not silently change that architecture or point to nonexistent assets.
- No file named `release.md` was found in the project-owned Markdown inventory of
  either checkout; the known current runbook is `Billiong-App/DEPLOYMENT.md` plus
  `SKU.md` section 7. Ask for the referenced file's path if it is a different document.
- The unauthenticated GitHub API latest-release request for `billiong-releases`
  returned 404; this alone does not establish repository visibility or release absence.

The owner expects the distribution/website workflow to be completed, not merely
local code. At this earlier handoff the installer/publication checks and proposed
practitioner gate were open; the latest owner decision above now changes the latter.
No website edits, GitHub pushes, release creation or deployment occurred in this
documentation follow-up. New agents must not describe this as a published 2.0.3.

### Checklist

- [ ] Reconnect with `ssh field`; inspect `git status`, branch, HEAD and current
  hashes/diffs. Read this handoff and applicable instructions before modifying files.
- [ ] Reconcile remaining release/customer-facing docs and add tracked backlog items.
  This follow-up logged the findings but did not fix all stale docs or port code.
- [ ] Complete and record the owner-directed AI-assisted audit of supported receipt/
  payment/withholding cases. External practitioner review remains recommended,
  but the owner removed it as a prerequisite for this release; do not mark it passed.
- [ ] Define owner-approved scope for any historical exposure/correction assessment;
  do not inspect customer data, mass-edit documents or infer actual legal violations.
- [ ] Prepare deliberate MAS/Windows port and verification plans, checking current
  checkout instructions and MAS upload number. No claim of three-channel completion.
- [ ] Under the latest authorization above, commit reviewed release files from a reproducible
  release checkout; preserve unrelated dirty work. Build and verify per DEPLOYMENT.
- [ ] Before an authorized publication, verify live deployment targets, upload the
  versioned installer/checksum, download and compare final SHA-256 after stapling,
  and verify any GitHub fallback before website link changes. Verify the live Pages
  deployment ID and downloads; a Git push did not trigger Pages during 2.0.2.
- [ ] Retain prior verified artifacts and document rollback. A rollback to 2.0.2
  would also restore its finance-risk behavior; practitioner/owner review must weigh
  that tradeoff. Do not assume binary rollback makes newer issued records safe to
  edit with an old client; data compatibility/recovery needs its own validation.
- [ ] Keep channel status explicit. SKU policy bars new-feature announcements until
  MAS approval; any proposed safety communication must be drafted for owner approval.

After further work, append what changed, exact tests/results, remaining gates and
source/artifact identifiers here and in the verification record. Do not turn a
previous pass into evidence for subsequently changed source or an untested binary.
