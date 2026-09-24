# BillNgai 2.0.4 — stabilization and historical-document recovery

Date: 2026-09-24. Owner: Visarut. Coordinator: Codex.
Status: **authorized implementation; uncommitted working candidate, not released**.
Read [SESSION-HANDOFF-2.0.4.md](SESSION-HANDOFF-2.0.4.md) and
[VERIFICATION-2.0.4.md](VERIFICATION-2.0.4.md) for current evidence and open gates.

## Authority and objective

After reporting the installed 2.0.3 historical-document/void-button failures, the
owner requested a swarm audit and a plan for old documents, then authorized
“implement it all”. This phase implements the audited stabilization and scoped
evidence/recovery workflows as a 2.0.4 candidate. It does not by itself authorize
publication, replacement of the installed app, edits to real documents, customer
messages, refunds, MAS submission or cloud re-enablement.

The owner must be able to read retained historical records without cancelling them.
New supported document actions must save reliably. Historical uncertainty must stay
visible: missing a snapshot is not proof of invalidity, and reconstructing a view
today does not establish what was originally issued.

Inputs: [16-finding audit](review/2026-09-24/POST-RELEASE-AUDIT.md),
[initial recovery proposal](review/2026-09-24/LEGACY-RECOVERY-PLAN.md), and
[incident diagnosis](review/2026-09-24/LEGACY-DOCUMENT-DIAGNOSIS.md). The proposal's
earlier “awaiting implementation authorization” wording is historical; acceptance
and release gates remain open until separately evidenced.

## Audit-to-implementation map

The table defines required behavior and candidate code/test coverage. It is not a
claim that each packaged workflow has passed final acceptance.

| Finding | Required fix / candidate behavior | Primary coverage |
|---|---|---|
| F01 | Replace both unsupported prompts with date/full-payment and reason modals; cancellation changes nothing. | `billing.html`; document/legacy recovery tests |
| F02 | Draft label survives print/PDF; unsupported tax-invoice drafts cannot produce authoritative output. | Document output guards; document stabilization tests; native PDF gate |
| F03 | Quit and window-close wait for renderer transactions and native disk queue; failure/timeout keeps app open. | `main.js`, `preload.js`; main stabilization tests |
| F04 | Imported IDs remain inert handler arguments; validate IPC main-frame identity and block app-window navigation. | Renderer handler encoding; main IPC guard; injection regressions |
| F05 | Retain customer tombstones referenced by retained documents; preserve exact available bytes before migration writes. | Migration; pre-2.0.4 preservation; legacy/main tests |
| F06 | Reject malformed nested imports/recovery before replacing active data; preserve unknown extra legacy fields. | Main/renderer validators; storage/document/main tests |
| F07 | Await settings, customer, recurring and lifecycle saves; roll back failures, retain input and suppress false success. | Renderer mutation paths; recurring/document/legacy regressions |
| F08 | Allow explicit quotation decline while retaining the frozen original. | Lifecycle transition; document stabilization tests |
| F09 | Voided invoices leave collection/overdue actions and totals; actual payment evidence remains retained. | Status/eligibility/report helpers; document/reporting tests |
| F10 | Historical report parties, classification and FX use frozen inputs where available. | Annual/WHT CSV and reporting helpers; reporting tests |
| F11 | Add readable historical review, provenance/context export and separate reversible archive from reasoned void. | Legacy review/actions; legacy recovery tests |
| F12 | Unknown historical currency remains unknown, not implicitly THB/rate 1. | Currency/report completeness helpers; reporting tests |
| F13 | Missing/invalid payment dates stay unallocated, never normalized into an asserted month/year. | Tax-date/report buckets; reporting tests |
| F14 | Deduplicate supported equivalent payment identities; keep ambiguous legacy groups unresolved rather than pick totals. | Payment grouping/projections; reporting tests |
| F15 | Month-end recurrence clamps dates and preserves its anchor; failed generation consumes no schedule/number. | Recurring helpers; recurring stabilization tests |
| F16 | Separate planned drafts, issued billing and actual payment; void/draft children do not imply completed billing/payment. | Split progress; reporting stabilization tests |

## Historical-record policy

Keep issuance, evidence quality, visibility and payment as separate dimensions.
Read-only review shows retained document facts and unknowns. Current linked customer
records may be exported as **reference context**, not falsely labelled original
buyer evidence. Do not silently replace an old issuer, buyer, logo, signature,
currency, VAT rate, number or document title with current settings.

Archive/unarchive changes visibility only. Void requires a reason, retains evidence,
and does not establish a refund or completion of a statutory correction. No bulk
“mark reviewed”, automatic renumbering, mass cancellation, original reconstruction,
or old-tax-invoice-to-ordinary-receipt conversion.

Before migration writes, preserve a verified, non-expiring copy of available source
bytes. This is a first-observed pre-2.0.4 preservation copy, not proof that the exact
pre-2.0.3 history has been recovered. Fail closed if preservation fails.

## Evidence and scoped old-invoice recovery

Attach original evidence only through a native user-selected file. Retain immutable
content-addressed bytes and provenance metadata. Support PDF, PNG and JPEG signatures
up to 20 MiB per file; never inject attached content into the renderer or open it
automatically. A SHA-256 match establishes byte identity, not authenticity, signature,
tax validity or a match to the underlying transaction.

Database JSON holds metadata/events, **not attached binary files**. Provide a separate
evidence bundle export/import. Bundles validate every entry before copying, preserve
existing files, and do not replace the database or automatically link documents.
Current limits: 1,000 entries, 40 MiB decoded aggregate, 64 MiB import file. Missing
or mismatched evidence must remain visibly unavailable and block supported recovery.

For an eligible old unpaid invoice, append separately recorded payment facts and
review notes/evidence without overwriting the original or inventing an issuance
snapshot. Capture reviewed parties, actual payment date, currency, gross, withholding,
net, full-payment confirmation, historical non-VAT confirmation, stable payment ID
and recording timestamp. Revalidate imported events at action time; structural
validity is not proof the facts were confirmed.

Search all retained receipt/payment evidence, including archived/voided/deleted
records, before accepting a payment or creating a receipt. A new ordinary receipt
is a separate explicit action with today's issuance date and supported current
validation. Never present it as a reconstructed original. Reject VAT, unknown/FX
currency, partial/deposit/refund, contradictory amounts, conflicting numbers,
duplicate payment evidence and unsupported issuer status. Report projections must
count a supported reviewed payment once before and after its new receipt, without
mutating the historical invoice.

## Boundaries and acceptance

Cloud connect/sync/restore, e-Tax XML, unsupported PIT payable/refund calculations,
VAT/tax-invoice issuance and unsupported receipt categories remain paused. Being a
freelancer alone does not determine VAT registration or tax-invoice entitlement.
This is engineering work, not external practitioner sign-off, legal certification
or verification of any customer's historical documents. Case-specific correction
and distribution policies still require appropriate professional/owner review.

Acceptance requires clean full regression/configuration/syntax/i18n runs, realistic
legacy migrations, malformed/imported-ID tests, repeated/failed/concurrent saves,
exact native button/cancel/reload/close/quit interactions, and PDF text plus rendered
page checks. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for any later authorized release:
reviewed commit, exact signed/notarized/stapled artifact, packaged-source comparison,
public download hashes, then accurate website publication. Do not reuse 2.0.3 test
or notarization evidence for changed source. Windows/MAS need separate checks.
