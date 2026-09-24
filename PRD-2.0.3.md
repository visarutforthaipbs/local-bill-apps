# BillNgai 2.0.3 — ordinary-receipt safety release

Owner: Visarut. Engineering manager: Codex. Date: 2026-09-23.
Status: Direct macOS released 2026-09-24; artifact/publication evidence in `RELEASE-2.0.3.md`. Windows and MAS pending.

## Owner-directed review decision — 2026-09-23

After the external Thai practitioner gate was explained, the owner instructed:
"you audit and do it", following an explicit request to complete and release 2.0.3.
For this Direct macOS containment release, the owner replaces the proposed external
practitioner prerequisite with an AI-assisted source/legal-source audit. This is a
documented release-risk decision, not practitioner approval, legal certification,
or a finding that all Thai tax obligations are satisfied. External professional
review remains recommended and is not recorded as completed. The historical gate
below is retained to make this change in decision visible.

Authorization covers reviewed release commits, signing/notarization, tag/push,
verified installer publication and the matching `billiong-releases` website update.
All technical/artifact gates in `DEPLOYMENT.md` remain mandatory. No authorization
is inferred for MAS submission, Windows release, customer messages, refunds,
pricing changes, license-key generation, or inspection of customer records.

Resume context and release-practice review: [SESSION-HANDOFF-2.0.3.md](SESSION-HANDOFF-2.0.3.md).

## Objective and legal boundary

Help Thai non-VAT freelancers produce ordinary receipts without accidentally issuing a tax invoice, rewriting history, or receiving unsupported tax-payable advice. Freelancer status alone does not prohibit VAT registration: entitlement depends on registration and the transaction. This release is containment, not certification of Thai tax compliance.

Reference audit: [THAI-FINANCE-AUDIT.md](review/2026-09-23/THAI-FINANCE-AUDIT.md), 12 risk groups, originally `BillNgai-audit-2026-09-23/REVIEW.md`, copied from field HEAD `88ae910b12cc390b305a0bea428e5eda297776b2` plus its existing uncommitted changes. The audited source is the baseline, not a clean Git revision. Preserve that baseline and do not overwrite later field edits.

## Supported product boundary

- Commercial quotations/invoices remain available as drafts and explicitly finalized records.
- New receipts: ordinary non-VAT, THB, full payment, Thai or bilingual particulars. Capture actual receipt date, explicitly confirm full payment and withholding treatment. These are conservative product limits, not assertions that other lawful workflows do not exist.
- New tax invoices, registered-seller receipt workflows, foreign-currency receipts, partial payments/deposits, refunds/credit notes, and statutory e-Tax output are unavailable in 2.0.3 until their full workflows are validated. No fallback from a registered-seller tax invoice to an ordinary receipt.
- Existing documents remain retained in their original type. Unknown historical particulars must not be reconstructed from today's business profile and called original.
- Reports are bookkeeping summaries, not tax returns. Do not show final payable/refund amounts or claim a universal expense deduction.

## Requirements and acceptance criteria

### A. VAT entitlement and deterministic issuance (R01, R07, R09)

1. Fresh profiles default to non-VAT with unconfirmed status. A dedicated acknowledgement establishes `non_registered`, `registered`, or `unknown`; merely loading a legacy true/false flag is not confirmation.
2. Ordinary-receipt issuance requires confirmed non-registration. Registered/unknown users see a clear unsupported/review message. Settings, AI, recurring, duplicate, imported drafts and direct function entry all meet the same guard.
3. Tax invoice creation is denied at the final mutation boundary, not just hidden in a menu. Preserve existing tax invoices; never silently retitle them.
4. Validate issuer name/address/13-digit tax-ID format, buyer name, supported type/currency, real local calendar dates, required item descriptions, finite positive quantities, finite nonnegative prices, positive total, VAT zero and finite withholding rate 0–100. Format checks are not registration verification.
5. A receipt requires an explicitly entered received date and full-payment acknowledgement; no implicit today-as-payment fallback. Reject future payment dates and unsupported partial/deposit use. Bilingual is a product fallback when English-only is chosen for an ordinary receipt.
6. Withholding is an explicit user/payer-confirmed input, not inferred from income category, client nationality or currency. Default zero with a visible review requirement; distinguish expected deductions from verified tax credits. No generic '40(2) means 3%' advice.

### B. Immutable issuance and retention (R02, R08)

1. Freeze issued financial contents, computed amounts, document language, issuer/buyer details, terms, bank/signature/logo and rendered document content. Later business/client changes must not change an issued copy or amount.
2. New draft documents have no legally issued status. Duplicating any record creates a draft, clears receipt/payment/certificate/snapshot/void identity, and never counts as income.
3. Issued documents cannot be edited or deleted. A reasoned void/archive operation preserves their original content and records time/reason. A void is not proof that money was refunded; payment reporting must not disappear merely because a document was voided.
4. Legacy issued documents without snapshots are marked `legacy_review_required`; retain their raw contents, do not invent original issuer/buyer snapshots. Show a warning and block authoritative reprint/export until a separately approved historical-review workflow exists. Existing external PDFs are not replaced.
5. Do not purge document tombstones after 180 days. Retain issued and voided records without an automatic expiry in 2.0.3. Archive is visible/exportable for user review; backup export includes it. No claim that this alone satisfies every retention obligation.
6. Failed persistence must not display successful issuance or consume an in-memory issued record that subsequent actions treat as safely stored. Protect repeated clicks and retry.

### C. Payment identity and honest summaries (R03–R06, R10)

1. Full-payment receipt generation requires a paid source invoice with explicit payment facts. Repeated generation returns the existing receipt; never creates a second acknowledgment for one payment.
2. Use source/payment identity to deduplicate income. A paid invoice without a receipt is represented once. Draft receipts are excluded. Legacy ambiguity and duplicate payment records must produce an incomplete/review indicator, not silently certified totals.
3. Income classification is available to all tiers. Unknown categories are unresolved, not automatically included in PND94. Only 40(5)–(8) enters the half-year category summary; do not imply that this alone establishes a filing obligation.
4. Suppress PIT payable/refund estimates until a dated category-aware engine covers other income, expenses, deductions, actual credits, previous half-year payments and the alternative tax method. Show summary inputs and explicit limitations instead.
5. Suppress unverified filing reminders/extensions. Link official RD instructions and identify the year; no automatic promise of an eight-day extension.
6. Foreign-currency legacy bookkeeping consistently uses pre-VAT income, includes converted categories, and flags missing/invalid FX as incomplete. Currency does not establish income source or withholding exemption. New foreign-currency receipt issuance stays unsupported.

### D. Sync and unsupported export containment (R11, R12)

1. Until durable cross-device history, conflict variants and offline-safe numbering have been independently tested, pause automatic/manual cloud sync and cloud restore in 2.0.3. Keep local backup/export and disconnect available. Do not erase cloud data or credentials. Explain the pause visibly, including for existing Pro accounts.
2. Existing duplicate issued numbers/conflicts block authoritative printing/issuance. Never auto-renumber issued records. New issued numbers must be unique across retained local documents including voids/tombstones; local uniqueness is not global offline allocation.
3. Disable custom e-Tax XML export rather than imply a validated provider integration. Explain that ordinary PDF and the authorized e-Tax workflow are distinct.

### E. Version, compatibility and release

1. Set direct-download package and lockfile root versions to 2.0.3, update changelog and FAQ. Implementation so far covers Direct only. Follow `SKU.md` section 7 and `DEPLOYMENT.md`: deliberately port shared fixes to MAS while preserving StoreKit/sandbox behavior, coordinate the same app SemVer, and increment the MAS build number for each upload after checking its current value. Historical MAS 2.0.6/2.0.7 labels are upload build numbers, not an independent app-version policy. MAS and Windows remain pending until separately built and verified; do not imply they received this candidate. Current Direct release authorization is recorded above; it does not authorize other-channel publication.
2. Preserve existing storage/recovery/release-hardening work; no new framework or runtime dependency. Thai/English UI strings use `tr` plus dictionary entries; printed language follows existing document helpers and brand rules.
3. Never read or mutate live customer records, tokens, signing keys or Drive data during tests. All tests use isolated synthetic profiles. Do not commit, tag, push, publish, sign or submit a release without owner authorization.

## Agent allocation and integration

- Issuance agent: editor/lifecycle guards, explicit payment and VAT-status UX, uniqueness and duplicate-as-draft; own dedicated tests.
- History agent: snapshot/legacy quarantine, compute/render stability, retention/archive and immutable guards; own dedicated tests.
- Reporting agent: payment-deduplicated summaries, category/FX completeness, remove unsupported PIT conclusions and unsafe WHT advice; own dedicated tests.
- External Qwen: bounded validator/edge-case proposal. agy: independent design critique. Claude: independent final diff review. These external adapters propose/review, not edit the shared workspace.
- Manager: PRD, integration contracts, sync/e-Tax containment, version/docs, regression and isolated UI checks; fix reviewer findings before handoff.

Dependencies: issuance calls shared history helpers `isIssuedDocument`, `freezeIssuedDocument`, `documentOutputBlocked`; reporting consumes payment identity and snapshots. Agents coordinate ownership of the single renderer. Manager alone reconciles overlapping changes.

## Test matrix / release gates

- Fresh and legacy profiles, including old default-true, cannot emit tax invoices.
- Missing issuer fields, invalid dates, NaN/Infinity/negative/overflow amounts, unsupported currencies and unconfirmed payment are rejected without mutation.
- Ordinary full-payment receipt works; repeated clicks/retry create one persisted receipt. Draft invoices cannot acknowledge payment through the receipt shortcut.
- Change every business/customer display/tax/payment setting after issuance: output and totals stay equal. Duplicate is draft; edit/delete is denied; void retained and payment is not erased.
- Legacy issued/tombstoned records survive repeated migration with explicit uncertainty; numbering never reuses retained numbers.
- Paid invoice with/without linked receipt counts once; unknown category does not enter PND94; Local tier can classify; no payable/refund estimate; FX totals reconcile and missing rates remain visibly incomplete.
- Sync/restore/e-Tax direct calls fail safely with visible explanation. No live network calls during these tests.
- Existing storage/release tests, inline syntax, translation key check, browser workflow and Electron isolated-profile tests pass. Review output document with Thai/English examples.
- Original proposed gate: Thai tax practitioner reviews sample ordinary receipts, terminology, payment/WHT handling and supported scope before public release. **Superseded for this release by the owner-directed decision above.** Agent consensus and passing tests still do not constitute practitioner sign-off.
- Build/signing/published-artifact checks remain release gates even if source tests pass. No claim of full compliance or complete remediation of historical customer documents.

## Source register (reviewed 2026-09-23)

- VAT authority and invoice particulars: https://www.rd.go.th/5208.html (s86/4,86/13); natural-person registration: https://www.rd.go.th/21166.html.
- Receipt particulars/retention: https://www.rd.go.th/5203.html (s105,105bis); VAT records/penalties: https://www.rd.go.th/5209.html.
- Branch particulars: https://www.rd.go.th/48266.html; correction/language: https://www.rd.go.th/3568.html.
- Withholding: https://www.rd.go.th/5937.html (s50,50bis); currency: https://www.rd.go.th/3581.html.
- Service VAT tax point: https://www.rd.go.th/5205.html; export conditions: https://www.rd.go.th/3288.html.
- PND94 tax year 2569: https://www.rd.go.th/fileadmin/tax_pdf/pit/2569/Ins94_160669.pdf.
- Prior-year annual guidance (not a claim of final 2569 rules): https://www.rd.go.th/fileadmin/tax_pdf/pit/2568/Ins90_241268.pdf.
- VAT threshold: https://www.rd.go.th/7061.html. e-Tax routes: https://www.rd.go.th/region/06/nakhonpathom2/274/3448.html.

## Historical implementation checkpoint

At plan creation, field SSH timed out. The user woke the Mac; remote instructions were re-read and affected source hashes matched the audited baseline. The candidate was integrated into the existing working tree without changing Git history or unrelated edits. Backup: `/Users/visarutsankham/Documents/Personal-Project/BillNgai-pre-2.0.3.iucTpL`. See `VERIFICATION-2.0.3.md` for checks and remaining gates. This is a source update, not a published installer.

Subsequent release: Direct macOS 2.0.3 and aligned website published 2026-09-24.
See `RELEASE-2.0.3.md` for the exact signed artifact and public verification;
the earlier paragraph records implementation history, not current release status.
