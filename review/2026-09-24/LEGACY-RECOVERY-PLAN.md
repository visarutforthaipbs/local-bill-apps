# Proposed 2.0.4 stabilization and historical-document recovery

Date: 2026-09-24. **Proposal, not implemented or release-approved.**
Companion: [post-release audit](POST-RELEASE-AUDIT.md).

## Outcome we want

Owners can find and read every retained record without cancelling it. New supported
documents work reliably. Historical uncertainty remains explicit; the app never
pretends today's reconstructed view is what was originally sent.

Important correction to 2.0.3: blocking authoritative output should not also block
ordinary read access. Missing a new-format snapshot is not proof an old document
was invalid, nor is creating a snapshot today proof the old document was valid.

## Phase A — urgent stabilization, proposed 2.0.4 scope

1. **Preservation first.** Before any migration write, make a verified non-expiring
   copy of currently available source bytes, relevant referenced records and existing
   artifacts. Fail closed on backup failure. This is a pre-2.0.4 backup, not a claim
   to recover the exact original pre-2.0.3 history. Retain referenced client tombstones.
2. **Fix all P1 paths together.** Replace both prompt calls with the existing HTML
   modal components; fix draft print policy (including old tax-invoice drafts),
   transaction drain on quit, and imported-ID handler injection. No new framework.
3. **Durable UI actions.** Await saves across settings, customers, recurring and
   lifecycle actions; preserve user input and show failure without claiming success.
   Serialize double clicks, and do not let failed staged state leak into later saves.
4. **Read-only historical details.** Show stored type/number, dates, items, rates,
   state and relationships. Explicitly label fields as stored, attached-original,
   current reference, user-confirmed later, or unknown. Do not inject today's logo,
   signature, issuer or buyer into an apparent historical original.
5. **Separate actions.** Primary action is “ดูข้อมูลที่เก็บไว้”; review never requires
   voiding. “เก็บเข้าคลัง” only changes visibility; “ยกเลิกเอกสาร” is separate and
   requires an explicit reason and warning. Archive/unarchive must not change
   amounts, payment evidence, document type or financial totals.
6. **Consistent state and reports.** Fix F08–F16: decline transition, void/overdue
   eligibility, frozen buyer identity, unknown currency/date buckets, ambiguous
   payment groups, month-end recurrence and planned-versus-issued split progress.
7. **Conservative output.** For now, historical read-only details and labelled data
   review export only; no reconstructed authoritative PDF/share. Drafts must remain
   unmistakably drafts in printed/PDF output, or that output stays disabled. Old
   tax-invoice drafts cannot bypass the current unsupported-output boundary.

The first patch can restore readable access without inventing a historical approval
workflow. Implementing original-file attachment/export or legacy payment recovery
requires the scoped Phase B checks below; don't silently bundle an unreviewed path.

## State/action policy

Keep four separate dimensions: issuance/lifecycle, evidence quality, visibility,
and actual payment. A single `legacy_review_required` or “reviewed” flag is inadequate.

| Record | Read access | Original mutation / output | Safe next step |
|---|---|---|---|
| Explicit supported draft | Editable draft, clearly marked | No issued output before validation | Finalize once with current checks |
| Newly issued frozen document | Snapshot-derived view | Content immutable; existing allowed copies | Supported lifecycle/payment events |
| Old issued record without original artifact | Read stored facts and unknowns | No rewriting or reconstructed original | Gather evidence; retain unresolved status |
| Old record with attached original PDF | Inspect original bytes and provenance | Attachment is not validity certification or a reissue | Reconcile against retained data |
| Old unpaid invoice | Read original facts and recorded balance uncertainty | Do not mark paid merely to clear warning | Separate reviewed payment event in Phase B |
| Old tax invoice, whether issued or uncertain | Preserve title, VAT and evidence | No silent conversion to ordinary receipt | Case-specific professional correction review |
| Voided issued record | Read with clear cancellation state/reason | No current-valid output | Retain payment evidence; refund is separate |
| Deleted draft / old tombstone | Read from archive with deletion label | No automatic resurrection or inference of void | Classify retained evidence |
| Conflicting numbers/versions | Inspect all variants | No automatic renumber/merge | Resolve with evidence, keep audit trail |

“Archive” should be reversible. “Void” should not be a reversible UI hide toggle:
any later correction must itself be recorded, not silently erase cancellation history.
Legacy historical tax-invoice cancellation should not imply the app completed the
required legal correction process; keep automatic correction/reissue unsupported.

## Phase B — evidence and old unpaid invoices

Use append-only review/payment events linked to the immutable old record, with
recording timestamp, actual event date, source/evidence, review notes and stable ID.
Do not write newly asserted history into `issuedSnapshot` as if captured at issuance.

Original evidence attachment needs safe file-type/size handling, immutable local
copy/hash, provenance, duplicate handling, backup/export round-trip and missing-file
behavior. A hash proves byte identity only, not authenticity, signature or validity.
Earlier backups may supply missing evidence; compare selected records with provenance
instead of restoring an entire older DB over newer issued records.

For an old unpaid invoice, an explicit recovery workflow must:

1. Review original invoice/artifacts, issuer/customer, currency, billed amount and
   VAT treatment. Missing or conflicting facts remain unresolved.
2. Search retained receipts and payment evidence, including archived/voided/deleted
   records, to avoid recording an already-received payment twice.
3. Capture actual payment date, gross, withheld amount, net, method/evidence and a
   unique payment ID separately from document issuance and date.
4. Derive settlement from reconciled payment events. Do not overwrite the original
   invoice or backdate a new document; retain an audit trail for corrections.
5. Permit a new ordinary receipt only after confirming this particular transaction
   satisfies the supported non-VAT/THB/full-payment scope and is not already receipted.
   Confirmed contemporary parties belong to the new receipt, not the old original.
6. Stop for VAT, mixed/unknown currency, partial/deposit/refund, ambiguous duplicates,
   prior tax-invoice issuance or changed totals. No automatic 7%-to-0% conversion.

Partial/ambiguous old payment groups must not be collapsed merely because they share
an invoice, nor all counted as distinct merely because IDs differ. Show candidate
representations and unresolved totals until evidence establishes the relationship.
Equal customer/amount/date alone is not proof of duplication.

## Print/export policy requiring explicit choice

The safest first patch is on-screen historical details plus clearly labelled review
data, not a tax-document-shaped reconstructed PDF. A later reference-sheet export
may show retained facts with an embedded “เพื่อทบทวนข้อมูล — ไม่ใช่เอกสารออกใหม่”
label on every page, no signature/issuance appearance and explicit unknown fields.
Test the final PDF text and rendered pages; screen-only banners are insufficient.
This must not be sold as satisfying all statutory copy/replacement requirements.

Original PDF access preserves bytes; any copy/replacement distribution policy is
separate. No “mark all reviewed”, bulk void, automatic retitling or unqualified
“legally compliant” badge. Frozen data is not independently verified revenue.

## Acceptance gates

- Migrate synthetic old quotation/invoice/receipt/tax invoice, draft, missing-status,
  void, deletion and conflict fixtures; retained record/reference counts never fall.
- Unknown issuer/buyer/currency/payment date stay unknown; changing current settings
  cannot alter original evidence. Repeated migration is idempotent.
- Exact packaged Electron clicks for every lifecycle button; both modals support
  cancel/escape/validation/save failure/retry/reload with no unintended mutation.
- Draft receipt and old tax-invoice draft cannot produce apparently issued output;
  inspect PDF text and page render, not only source HTML.
- Delayed save + immediate quit waits for durable completion; failure prevents silent
  loss. Repeated/concurrent actions produce one coherent record and number.
- Main and renderer reject malformed nested imports before replacing active data;
  crafted IDs render as inert data, not code. Test all handler/template entry paths.
- Voided unpaid invoices leave collection totals; actual payments survive void/archive.
  Frozen buyer details match across PDF/WHT/annual CSV. Unknown dates/currencies and
  ambiguous payments stay outside asserted buckets and remain visibly unallocated.
- Recurring January 31, leap day, quarterly/yearly boundaries and local time zones;
  failed schedule saves roll back and remain retryable. Split planned/issued/paid
  amounts reconcile without treating drafts or voided children as actual billing.
- Clean dependencies, full regressions, source/native/PDF checks, versioned reviewed
  commit, signed/notarized exact installer, public SHA and truthful website claims.
  Do not reuse 2.0.3's test evidence for a changed binary or imply Windows/MAS parity.

## Legal limits and owner decisions

Official sections [105/105 bis](https://www.rd.go.th/5203.html),
[86/12–86/13](https://www.rd.go.th/5208.html) and
[P.86/2542 clauses 25–26](https://www.rd.go.th/3568.html) were rechecked. They
inform preservation and careful correction boundaries; the state model above is
our engineering proposal, not statutory certification. In particular, the registered
operator correction procedure is not a generic cure for unauthorized tax invoices.

Before implementation, owner should approve Phase A scope. Before Phase B release,
settle receipt/copy/correction policy with case-specific Thai tax review, and approve
any customer-data review or customer communication separately. Current authorization
does not include sending warnings/refunds, editing actual documents or changing
public distribution. The coordinator recommends prioritizing Phase A promptly.
