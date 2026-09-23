# BillNgai 2.0.2 — Thai tax and financial-document risk review

> Historical pre-fix audit, preserved in the repository on 2026-09-23. Its
> findings and final "fixes pending" statement describe the audited 2.0.2
> working copy, not the later 2.0.3 candidate. See
> [the session handoff](../../SESSION-HANDOFF-2.0.3.md) and
> [verification record](../../VERIFICATION-2.0.3.md) for subsequent work.
> Source/probe paths below refer to the original audit folder on
> `lighthouse-control`; those baseline files are not bundled with this archive.
> Legal sources were researched for the original audit, not re-verified during
> this documentation-only archival step.

Research date: 23 September 2026 (Asia/Bangkok). Scope: direct-download working copy on `field`, `/Users/visarutsankham/Documents/Personal-Project/Billiong-App`.

**Assessment: material release-blocking risks exist.** Two critical areas are automatic VAT entitlement and mutable historical documents. Nine additional high-priority areas affect financial correctness or compliance support; one medium-priority area concerns e-Tax export. These priorities are engineering judgments, not findings by a regulator.

This is an evidence-backed product/code audit, not certification of legal compliance or an assessment of any customer's tax liability. A Thai tax practitioner should validate the supported transaction cases and any correction of documents already issued. No customer records, tokens, private keys, live Google Drive workspace, production downloads, or MAS source were accessed or changed during this audit.

## Evidence and limits

The audited working tree is dirty; version `2.0.2` is not sufficiently identified by the current commit alone. HEAD was `88ae910b12cc390b305a0bea428e5eda297776b2`, branch `chore/2026-07-12-team-setup-sku-decisions`.

| Copied source | SHA-256 |
|---|---|
| [billing.html](billing.html) | `b5802648a0d09c906c4f7830ec01354a5001427d323d3df2ab4fb0c91f586d7f` |
| [main.js](main.js) | `9cab2a3df092bf66cfff8d037ba583b56ad5c53ff9c9939016f81cf05d51a415` |
| [preload.js](preload.js) | `0fa79788feba2b731ea4ae3947c2f9253df11203875d8d92d14b0f236667a5d1` |
| [package.json](package.json) | `6004f8702b9a196f95f146ccb711d8ae1deddf75476245521e289577bbd718f6` |

[probe.cjs](probe.cjs) executes the copied renderer in an isolated JavaScript context with synthetic records, boot disabled, and storage/UI effects stubbed. Fourteen assertions passed: thirteen demonstrate risky behavior, one is a rounding control. This is not a desktop/UI, network-sync, PDF-rendering, or tax-calculator certification test.

Reproduce locally:

```sh
node /Users/lighthouse-control/BillNgai-audit-2026-09-23/probe.cjs /Users/lighthouse-control/BillNgai-audit-2026-09-23/billing.html
```

The 26 existing tests passed in the preceding project review; they primarily cover storage safety and packaging, not the legal correctness discussed here. No application fix was implemented in this audit.

## Legal baseline

The following are compact research conclusions. The recommendations in later sections are implementation proposals derived from them.

1. **Freelancer status does not determine VAT entitlement.** Natural persons can register for VAT. Section 86/13 prohibits unauthorized tax-invoice issuance; sections 89(6) and 90/4(3) provide civil/criminal consequences. An ordinary receipt is a different document. [Registration guidance](https://www.rd.go.th/21166.html), [sections 85–86](https://www.rd.go.th/5208.html), [sections 87–90](https://www.rd.go.th/5209.html).
2. **Receipts have content and retention requirements.** Section 105 bis specifies issuer tax ID/name, numbering, date and amount, Thai-language requirements, and at least five years' retention for the covered issuers. Applicability and exceptions must be checked for the supported customer cases. [Sections 103–129](https://www.rd.go.th/5203.html).
3. **Full VAT invoices need prescribed fields.** Section 86/4 sets core content; Notification 196 adds issuer establishment information and buyer information in the applicable cases. A customer's tax ID alone is insufficient. [Section 86/4](https://www.rd.go.th/5208.html), [Notification 196](https://www.rd.go.th/48266.html).
4. **Withholding follows the transaction and payer/payee rules.** Section 50(1) uses an annualized calculation for 40(1)/(2); a generic 3% recommendation is not that method. The payer issues the withholding certificate. [Sections 50 and 50 bis](https://www.rd.go.th/5937.html). Foreign currency does not itself remove withholding obligations. [Order P.71/2541](https://www.rd.go.th/3581.html).
5. **Income categories affect expenses and filing.** PND94 covers 40(5)–(8). The tax-year 2569 instructions specify category-dependent expenses and the alternative gross-income tax calculation. [PND94 instructions, 2569](https://www.rd.go.th/fileadmin/tax_pdf/pit/2569/Ins94_160669.pdf). Annual filing also requires the relevant income, deductions, credits and alternative calculation. [PND90 instructions, 2568](https://www.rd.go.th/fileadmin/tax_pdf/pit/2568/Ins90_241268.pdf). These are year-specific sources; do not silently treat a prior-year form as the next year's final rules.
6. **VAT timing differs from income reporting.** For ordinary services, section 78/1 generally ties liability to payment, with earlier invoice issuance/use of services and other cases affecting the tax point. [Sections 77–79](https://www.rd.go.th/5205.html). Cross-border zero rating has conditions concerning use of the service abroad. [Notification 105](https://www.rd.go.th/3288.html).
7. **Seven percent is not the identified defect.** RD's 2 August 2026 announcement confirms continued 7% VAT and reports the approved extension to 30 September 2027. The app still needs dated rules and exemptions. [RD announcement 19/2569](https://www.rd.go.th/fileadmin/user_upload/news/2569thai/news19_2569.pdf). Registration obligations for taxable activity exceeding THB 1.8 million and the 30-day deadline require separate treatment from exempt activity. [RD registration obligations](https://www.rd.go.th/7061.html).
8. **A PDF/XML file is not by itself the RD e-Tax workflow.** The digital-signature route has signature and data requirements; a separate Time Stamp route exists. [RD signature guidance](https://etax.rd.go.th/etax_staticpage/app/emag/flipbook/06_Digital-Signature.pdf), [RD registration routes](https://www.rd.go.th/region/06/nakhonpathom2/274/3448.html).

Research correction to project assumptions: Order P.86/2542 clause 8 permits Thai or English entries for the covered full tax-invoice particulars, subject to its conditions. The existing bilingual restriction is a conservative product rule, not evidence that every English-language tax invoice is prohibited. Currency permission/conversion requirements are separate. [Order P.86/2542](https://www.rd.go.th/3568.html), [Order P.71/2541](https://www.rd.go.th/3581.html).

## Risk register

### R01 — Critical: VAT entitlement is assumed, and guards are incomplete

**Evidence:** `billing.html:710`, `3104`, `4389`, `4519`, `4850`, `4875`. `blankDB()` defaults `isVatRegistered` to true. The onboarding wizard never establishes VAT status. `createReceipt()` selects a tax invoice from that flag and the buyer's tax ID. The editor filters an option, but save/duplicate paths do not consistently enforce issuer eligibility.

**Reproduced:** default profile with an empty issuer tax ID generated `tax_invoice`; an existing tax invoice could be duplicated after VAT was disabled, creating another tax invoice with VAT zero.

**Risk:** unregistered users can issue tax-labelled documents unintentionally. This maps directly to the entitlement rules above. A Thai ID number, client tax ID, business name, or Pro purchase is not proof of VAT registration.

**Required direction:** default to ordinary receipts; explicitly establish registration status and effective date; validate eligibility at issuance and every alternate entry point, including imported drafts, duplication, AI and recurring flows. Existing true values need confirmation because they may merely reflect the default. Do not silently relabel previously issued documents.

### R02 — Critical: already-issued documents change retrospectively

**Evidence:** `billing.html:2515`, `4255`, `4327`, `4352`, `4559`, `4696`. `compute()` reads the current global VAT flag. `renderPaper()` reads the current business profile and current client record, including identity and signature assets. Issued documents remain editable.

**Reproduced:** for a THB 10,000 receipt with 7% VAT and 3% withholding, toggling VAT off changes the displayed gross from 10,700 to 10,000 and net from 10,400 to 9,700. Changing issuer/customer names changes the old document's rendered contents.

**Risk:** reprints, accounting exports and customer copies can disagree about the same numbered document. Frozen line items alone do not create a faithful historical record. RD provides specific correction/replacement procedures for defective tax invoices. [Order P.86/2542](https://www.rd.go.th/3568.html).

**Required direction:** freeze issuer/buyer particulars, tax treatment, monetary results, relevant terms and document version at issuance; retain an issued rendering or reproducible snapshot. Use linked void/correction/reissue actions. During migration, identify uncertain historical values rather than reconstructing them as fact from today's settings.

### R03 — High: receipts and income totals are not tied to unique payments

**Evidence:** `billing.html:3579`, `3733`, `4580`, `4850`, `4875`. Income reporting counts receipt/tax-invoice records; paid invoices alone are omitted. Receipt creation has no existing-receipt check or payment-status check. The paid-invoice action remains available. Duplicating a receipt creates a new issued record with a new date.

**Reproduced:** invoking the receipt action twice for one THB 10,000 invoice creates two receipts and THB 20,000 reported income. A paid THB 10,000 invoice without a receipt produces zero filing income but appears in the WHT tracker. Calling the receipt function on a draft also creates an issued receipt; the normal UI hides that action, but the underlying function lacks the invariant.

**Risk:** over/understated income, misleading payment acknowledgment and duplicate tax credit. Section 105 addresses receipts at actual payment, including applicable installment cases. [Receipt rules](https://www.rd.go.th/5203.html).

**Required direction:** unique payment records or an equivalent enforced payment identity; partial-payment/deposit amounts and dates; idempotent receipt creation; reprint existing receipt for an already-receipted payment. Distinguish templates from new receipts. Reconcile reporting against actual receipts of money, not document count alone.

### R04 — High: the income-tax estimator uses the wrong model for supported categories

**Evidence:** `billing.html:3761`, `3796`. `pitEstimate(gross, half)` always deducts 50%, capped at 100,000, plus one personal allowance. Categories, actual expenses, outside income, family circumstances and prior half-year tax payments are not inputs. The final figure subtracts computed WHT only; no alternative gross-income method is implemented.

**Reproduced:** annual THB 600,000 tagged 40(2), 40(5), 40(6) or 40(8) always receives a THB 100,000 expense deduction and THB 21,500 tax before credits.

**Comparison:** for a sole house owner eligible for the 30% rental expense deduction, THB 600,000 rent means THB 180,000 expenses. With only the THB 60,000 personal allowance and no other income/credits, the progressive calculation is THB 13,500. This controlled example illustrates an THB 8,000 difference, not an assessment for a real user. [Official annual instructions](https://www.rd.go.th/fileadmin/tax_pdf/pit/2568/Ins90_241268.pdf).

**Required direction:** suppress payable/refund conclusions for unsupported cases until a dated, category-aware engine exists. Include supported credits and the alternative method; distinguish estimated withholding from reconciled amounts. Missing paper certificates alone do not establish that tax was not actually withheld. The current disclaimer is useful, but does not make an inapplicable formula valid. [Half-year/annual credit explanation](https://www.rd.go.th/60580.html).

### R05 — High: unclassified income is treated as PND94 income

**Evidence:** `billing.html:2552`, `3733`, `3774`, `4412`. `only94Cats` excludes a record only when a category is present and outside 40(5)–(8). Empty categories are included. Category editing is Pro-gated. The reminder calls the income function without the half-year category filter.

**Reproduced:** an unclassified THB 10,000 receipt is included in PND94; assigning 40(2) removes it.

**Risk:** Local users can receive a half-year calculation without the classification control needed to correct its basis. A 40(2)-only user can still receive the reminder. The page's own disclaimer acknowledges the category limitation.

**Required direction:** treat unknown categories as unresolved, never as automatically eligible. Make classification needed for correct statutory behavior available independently of paid conveniences. Apply eligibility and filing thresholds consistently to cards and reminders. [Current PND94 scope](https://www.rd.go.th/68191.html).

### R06 — High: withholding is inferred from currency and simplified category defaults

**Evidence:** `billing.html:2515`, `2542`, `4366`, `4438`, `4474`. Non-THB documents forcibly use zero WHT, even when the stored rate is nonzero. Category 40(2) suggests 3%; selecting a category changes the rate. Clients have a default-WHT toggle but no adequate payer/residency/transaction model. Certificate tracking stores receipt status, number and date, not independently reconciled withheld amounts.

**Reproduced:** the same values with `whtRate:3` give WHT 300 in THB and zero in USD.

**Risk:** wrong net-payment/PromptPay requests and tax-credit estimates. Currency is not payer residence or source of income. A displayed suggested rate can be mistaken for a legal determination.

**Required direction:** distinguish expected and actual withholding; capture payer/payee type, relevant transaction classification, jurisdiction and applicable method. Do not automatically prescribe 3% for 40(2), or zero based on USD/EUR. Support accountant override with a recorded reason and independently recorded certificate amounts. [Section 50](https://www.rd.go.th/5937.html), [foreign-currency withholding rules](https://www.rd.go.th/3581.html).

### R07 — High: issuance does not enforce document particulars and currency conditions

**Evidence:** `billing.html:3104`, `4519`, `4696`. Ordinary receipt saving does not require issuer tax ID/name completeness. Tax-invoice saving checks buyer tax ID but not a complete issuer/buyer address, seller registration identity or establishment particulars. There is no structured head-office/branch model. All types can select THB/USD/EUR; the tax-invoice paper uses that currency without a Thai-baht tax block or approval state.

**Risk:** incomplete receipts/full tax invoices; foreign-currency documents lacking applicable conversion/approval handling. Ordinary receipts can also be rendered English-only; review section 105 bis applicability and exemptions before presenting that as universally valid.

**Required direction:** separate validators for ordinary receipt, full tax invoice and commercial quotation/invoice. Add structured issuer/buyer establishment fields, transaction-appropriate currencies and review of required language particulars. A format/checksum check is only a data-quality check, not proof of registration. [Receipt particulars](https://www.rd.go.th/5203.html), [VAT invoice particulars](https://www.rd.go.th/5208.html), [Notification 196](https://www.rd.go.th/48266.html).

### R08 — High: deletion and retention do not preserve an issued-document register

**Evidence:** `billing.html:1451`, `1542`, `4544`, `3579`; `main.js:443`. Deletion hides issued documents immediately. Migration removes tombstones older than 180 days. Automatic backups retain 30 snapshots; labeled backups are retained, and journals may contain older data, but there is no guaranteed, browsable, complete issued-document archive.

**Reproduced:** a deleted receipt is excluded from reports and disappears from the primary DB during migration after the retention cutoff.

**Risk:** missing audit history and unsupported reconstruction of original receipts. Existing backups/journals may help recovery, so this is not a claim that every copy is destroyed. They are not a demonstrated five-year record-retention workflow.

**Required direction:** void issued records with reasons and links; preserve originals, copies and correction history under a defined retention policy. Separate draft cleanup from legal-record retention. Retention obligations can depend on record type and proceedings; confirm the final policy with a Thai practitioner. [Receipt retention](https://www.rd.go.th/5203.html), [VAT record retention](https://www.rd.go.th/5209.html).

### R09 — High: the VAT tax point is conflated with receipt creation

**Evidence:** `billing.html:2533`, `4519`, `4850`, `5030`. The only tax-invoice type is combined receipt/tax invoice, and new such records default to issued/paid. There is no separate tax-point date or VAT-only issuance model. Installments create planned invoice portions, not a general payment ledger.

**Risk:** the app cannot faithfully represent every supported VAT-service case, such as a tax point arising before actual payment. Conversely a registered seller's path falls back to an ordinary receipt when buyer tax ID is missing, without resolving the seller's applicable VAT-document duty. That fallback needs professional review rather than treating buyer-ID presence as the legal switch.

**Required direction:** model payment and tax point separately; support or explicitly exclude advance/deposit, early issuance, partial performance, refund and credit/debit-note scenarios. The income summary is not a validated VAT sales report or PND30 return. [Service tax point](https://www.rd.go.th/5205.html), [issuance duties](https://www.rd.go.th/5208.html).

### R10 — High: foreign-currency reports are inconsistent and incomplete

**Evidence:** `billing.html:3589`, `3701`, `3733`. The foreign-income summary converts `grandTotal` including VAT, while filing income converts the pre-VAT subtotal. Category grouping includes THB records only. Missing FX records are excluded from the calculated amount with a warning, while a payable estimate is still displayed. Currency is labelled foreign income without source/residency evidence.

**Reproduced:** a synthetic USD 10,000 receipt with 7% VAT and FX 35 produces THB 374,500 in the foreign-income summary versus THB 350,000 in filing income.

**Required direction:** distinguish tax base, VAT, gross settlement and net cash in every export; keep category totals consistent across currencies. Record conversion date/source/basis and treat missing rates as incomplete totals. Foreign-currency billing does not itself determine foreign-source income or export-service VAT treatment. [FX rules](https://www.rd.go.th/3581.html), [export-service conditions](https://www.rd.go.th/3288.html).

### R11 — High: unresolved sync conflicts can disappear; issued-number conflicts do not block issuance

**Evidence:** `billing.html:847`, `904`, `934`, `1010`, `4559`; `main.js:933`. Each merge replaces `syncConflicts` with this pull's conflicts. The renderer commits pull cursors even with unresolved conflicts. Conflicts are in memory, not persisted. Issued-number collisions produce a warning but print/PDF actions remain available.

**Reproduced:** a conflicting amount produces one conflict; an empty subsequent merge replaces it with zero while the local amount remains. Network cursor advancement/restart was inspected in code, not exercised against Drive.

**Risk:** another device's conflicting financial edit can cease to be visible before resolution. Two devices can issue the same number before synchronization; warning later cannot undo an already-sent document.

**Required direction:** persist conflicts and both versions before acknowledging events; carry unresolved conflicts across pulls/restarts. Block finalization of unresolved issued-number conflicts and define per-device number allocation or another offline-safe scheme validated for supported document series. These controls are accounting engineering recommendations, not prescribed implementation details in tax law.

### R12 — Medium: e-Tax export is a draft with additional correctness defects

**Evidence:** `billing.html:1353`, `4058`. Export creates custom `ETaxInvoiceBatch` XML, not demonstrated RD schema-compliant signed output. It includes every active tax invoice regardless of period. It uses `business.currency` instead of each document's currency. The UI and XML already label it a draft and explicitly state it is not a direct filing file.

**Risk:** incorrect provider handoff, especially mixed currencies, and mistaken expectations if sold as compliant e-Tax issuance. Existing draft wording reduces this risk; ordinary PDF export is not automatically invalid merely because it is not e-Tax.

**Required direction:** preserve explicit draft status; correct per-document data; validate against the actual selected provider/schema before claiming compatibility. A production e-Tax route needs its full authorized workflow. [RD digital-signature guidance](https://etax.rd.go.th/etax_staticpage/app/emag/flipbook/06_Digital-Signature.pdf).

## Additional matters requiring a defined scope

- **VAT onboarding:** track taxable/exempt activities, relevant turnover and registration effective date. A universal income threshold warning cannot determine entitlement for every profession. No threshold assistant was found in the audited renderer. [RD obligations](https://www.rd.go.th/7061.html).
- **Dated rules:** `filingDeadlines()` hardcodes March 31/September 30 and describes online extensions as approximately eight days. Store source/effective dates and distinguish paper/online calendars, extensions and future unverified periods. Do not present an estimate as an official deadline.
- **Input validation:** `saveDoc()` checks surviving line items and one tax-ID condition, but lacks a comprehensive finite/nonnegative money, rate, date and identity validation layer. Negative adjustments need explicit correction semantics, not accidental negative receipts.
- **AI:** current human review before document saving is a useful control. AI-created client identity, income categories, VAT and withholding must still pass the same deterministic checks. No model inference was run during this review.
- **Privacy/security:** a separate PDPA/security audit remains necessary. Code shows local business JSON and optional user-Drive replication; `main.js:697` falls back to plaintext OAuth tokens when encryption is unavailable. This is a security observation, not a demonstrated PDPA violation. No real token or record was read. MAS/Windows, marketing claims, consent notices and the published installer need separate examination.
- **Already-issued documents:** this audit demonstrates possible paths, not actual customer exposure. Determine exposure through an explicitly scoped review that preserves original evidence. Never mass-edit historical tax invoices or message customers based solely on these synthetic tests.

## Remediation sequence and acceptance criteria

1. **Containment:** stop treating VAT issuance and payable/refund estimates as production-validated. Prioritize the unsafe default and issuance gates. Preserve existing records before any migration. Product containment and release holds are recommendations; no download was removed or release changed here.
2. **Ordinary freelancer workflow:** default to non-VAT; complete receipt particulars; explicit received-payment amount/date; no duplicate acknowledgment. Show expected versus actual WHT distinctly. Test a nonregistered freelancer billing an individual, company and government payer under appropriately verified classifications.
3. **Historical integrity:** freeze issued documents; correction/reissue chain; durable numbering/conflict handling; archive retention. Test that changing any profile setting does not change an issued copy or its reporting values.
4. **Tax summaries:** reconcile payment records; support applicable category rules, unknown-state handling, FX and actual credits. Until covered, show incomplete summaries and explain unsupported inputs instead of supplying an actionable payable/refund number.
5. **Registered/cross-border extensions:** validate VAT timing, invoice particulars, establishment identifiers, foreign currency, exempt versus zero-rated cases, and corrections. Treat e-Tax as its own integration project.
6. **Release gate:** have a Thai tax practitioner review concrete example outputs and independently calculated results. Turn approved examples into regression tests. Recheck the exact signed artifact and each distribution channel, including migration of the existing 2.0.2 user base.

Minimum regression scenarios: fresh nonregistered profile; legacy default-true profile; genuinely registered issuer; missing issuer/buyer particulars; payment without receipt; repeat receipt action; partial payment/deposit; old-document reprint after settings changes; 40(2)-only and unclassified half-year income; mixed categories and salary; actual WHT differing from estimate; THB and foreign currencies; missing FX; void/reissue; backup/restore; unresolved sync conflict across restart; issued-number collision; provider-bound XML with mixed currencies.

## What the audit did not establish

It did not establish that a customer has broken the law, that BillNgai itself is legally liable, that a historical document can be cured by changing its title, or that any feature is fully compliant merely because it passed a code test. The exact marketed/published app may differ from this dirty working copy. All fixes, release decisions and customer remediation remain pending.
