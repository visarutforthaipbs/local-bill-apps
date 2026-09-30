# Sync v3 — first live two-Mac test (2026-09-30, 15:36–15:52 BKK)

Source: uncommitted sync v3 pilot in `BillNgai-development/` (2.0.9 base), run from source with
isolated synthetic profiles: A = lighthouse-control `~/BillNgai-sync-test/profile-A`,
B = lighthouse-field `~/BillNgai-sync-test/profile-B` (started empty). Staging coordinator
`billngai-sync-coordinator-staging` on the owner's Cloudflare account (workers.dev, deny-by-default,
one allow-listed Google subject). Google account chosen by the owner for testing; a new
“BillNgai Workspace v3” folder was created in that Drive. Both Macs used the same Desktop OAuth
client. A 1-month test Pro licence (`sync-test@billngai.invalid`) was issued for the test profiles only.
lighthouse-field's installed BillNgai 2.0.2 and all real profiles were not touched.
Driver scripts and redacted results (`results.jsonl`) are in this folder.

## Results

| # | Scenario | Result |
|---|---|---|
| 0 | Deny by default | No token / invalid token → 401; first real sign-in → ACCOUNT_NOT_ENABLED until allow-listed. |
| 1 | Fresh consent + join | A connected and bootstrapped; B (empty) joined and received identical clients and draft. PASS |
| 2 | Same draft edited on both Macs before syncing | One commit won (B); A kept both versions as a conflict; resolving on A (“keep mine”) converged both Macs. No silent loss. PASS, with finding F1 |
| 3 | Both Macs issue an invoice at the same moment | INV-69-001 (A) and INV-69-002 (B); no duplicate numbers. PASS |
| 4 | Payment + receipt on A | B received paid invoice and RC-69-001 after one sync. PASS |
| 5 | B force-killed during issuance at 0.25 s, 0.9 s, 1.8 s | After restart the unfinished issuance was pending and invisible; next sync published it once (INV-69-003/004/005); no loss, no duplicate, no reused number; both Macs identical. PASS |
| 6 | Both Macs record payment + receipt for the same invoice at once | B won; one receipt RC-69-002; income counted once; A held a payment conflict until resolved, then both identical (net ฿5,000). PASS, with findings F1/F2 |

## Findings

- **F1 — spurious conflicts (P1 before release).** Records with no real change get included in a
  commit and raise conflicts: `business:main` after B's Settings view auto-saved (it refreshes
  `vatStatusConfirmedAt` on every save; test seed also used a non-canonical `yearMode`), and an
  invoice whose local and remote content were identical. Users would be asked to resolve conflicts
  that show the same values. Fix: don't stamp unchanged settings; don't include unchanged records
  in commits; auto-resolve conflicts whose content hashes match.
- **F2 — confusing half-state after a refused payment (P2).** Safe (income not double counted),
  but A showed the receipt while the invoice still looked unpaid until the conflict was resolved.
  The conflict dialog should explain “the other Mac already recorded this payment”.
- **F3 — silent skip (P2).** `runSyncV3` returns without syncing when a dialog/editor is open;
  the user gets no indication that sync is waiting.

## Fixes and live retest (same day, about 16:10 BKK)

Changes (uncommitted, in `lib/sync-v3*.cjs`, `main.js`, `billing.html`, `test/sync-v3-live-findings.test.cjs`):
- Settings no longer creates a new business version when nothing changed; the VAT confirmation
  time only changes when the answer changes. Connect saves the normalized data before bootstrap.
- A conflict clears itself (recorded as `identical` in the resolution history) when both Macs hold
  the same content; identical members of a held transaction are not flagged.
- A record that depends on one under review (receipt → invoice, review event → document) waits in
  the same review group, so a Mac never shows half of a payment.
- Sync shows “waiting for the open window” instead of skipping silently, and retries every 15 s.
- The payment-conflict card explains that the other Mac already recorded the payment.
- Backups/imports/exports never carry the sync binding; import/restore/storage moves are refused
  while connected (fixes audit P1-3; the original reproduction now saves normally).

Validation: 241/241 unit tests (7 new), sync UI smoke, and a live retest on both Macs (`retest.cjs`):
R1 Settings visits → business revision unchanged; R2 concurrent draft edit → only the draft conflicts,
resolved and identical; R3 concurrent payment → losing Mac shows neither receipt nor paid state until
resolved, payment note shown, one receipt and income once afterwards; R4 open window → waiting shown,
sync resumed automatically.

## Not tested yet

Token refresh after one hour; account-mismatch rejection with a second account; network loss
(as opposed to process kill); a UI to disconnect a Mac (import/restore stay refused until then);
more than 512 records; evidence files; Windows; the 2.0.10/2.0.11 fixes on top of sync code.
Staging server remains deployed with `LOG_REJECTED_SUBJECT=1`; the test workspace and Drive
folder remain until reset.
