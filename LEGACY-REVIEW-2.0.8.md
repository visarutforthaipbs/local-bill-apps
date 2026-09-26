# Old-record review ("ตรวจข้อมูลเดิม") — 2.0.8

2026-09-27. Owner request: after confirming the 7 eligible payment pairs, the
dashboard still showed an empty "รายรับเดิมรอยืนยัน" card for 12 remaining groups.
Owner asked for a cleaner build without many old-document repair buttons, suggesting
a migration. Answered: a silent migration cannot decide these groups (only the owner
knows whether records are one payment; 11 of 12 involve old tax invoices), so 2.0.8
adds a one-time guided review whose answers resolve the groups; repair entry points
disappear once everything is answered. Owner: "DO IT".

## Behaviour

- Unresolved groups = ambiguous historical payment groups not covered by a valid
  `payment_match`. Each can be answered:
  - `same_payment`: count once, using an owner-chosen record that has a valid
    payment date, THB and valid amounts (live records and receipts offered first).
  - `not_income`: excluded from income and no longer flagged as incomplete.
  - `needs_accountant`: stays excluded and flagged incomplete; no to-do line.
- "Separate payments" is intentionally not offered (highest overstatement risk; the
  owner's 12 groups are each one invoice with its receipt/tax-invoice records).
- Answers are `legacy_group_review` review events: group key, full source-record
  snapshot, decision, representative, owner confirmation, note, UTC time. Append-only;
  the latest answer applies only while the group's records are byte-for-byte the same
  (JSON), otherwise the group returns to unanswered.
- Save: explicit confirmation + note; stale check, labelled backup
  (`billing-before-legacy-review-*`), re-check, single persist, rollback on failure,
  busy guard. Desktop only (backup required).
- Main process and renderer validate the same shape (shared validator text, covered by
  the existing parity test); main also validates each source record structurally.
- UI: pair card only when pairs are confirmable; one "ข้อมูลเดิมรอตรวจ N กลุ่ม" to-do
  line; Documents shows "ตรวจข้อมูลเดิม (N)" only while groups are unanswered; the
  tax-invoice correction screen is reached from the old-record screen; Settings →
  ข้อมูลและสำรอง keeps an "ข้อมูลเดิม" card to change answers later.

Unchanged: original documents, issuance snapshots, output/print restrictions,
numbering, `payment_match` behaviour, correction proposals, storage/IPC flow.

## Verification (synthetic data)

| Check | Result |
| --- | --- |
| `npm test` | 190/190 (8 new in `test/legacy-review.test.cjs`) |
| `release:check`, syntax, `git diff --check` | Pass |
| Literal translation scan | 698 keys, none missing |
| `test/legacy-review-electron-smoke.cjs` (new) | Pass — `billngai-legacy-review-DILXeG` |
| Existing native/browser smokes (option-a, stabilization, payment-match, bulk-correction, compliance, storage) | Pass |

New unit tests cover: unanswered state; not-income/one-payment/accountant totals and
unchanged originals; latest answer wins; changed source invalidates; required
confirmation/note/decision/representative; stale preview, failed backup, source
change during backup, failed save; busy guard; main/renderer malformed rejection and
valid native round-trip; dashboard to-do line and received-total explanation.
Updated: `bulk-correction-electron-smoke.cjs` reaches corrections through the hub.

Side effect to know: a group counted as one payment appears in the 50 ทวิ tracker
when it carries withholding, exactly as confirmed payment pairs already do.

Packaging, owner-copy and installation evidence: [INSTALL-2.0.8.md](INSTALL-2.0.8.md).
Not verified: Intel hardware, Windows/MAS, VoiceOver, real-user usability.
