# Pre-publish fixes — source verification (branch `release/2.0.10`)

2026-09-29 · Base `d74e8b7` (released 2.0.9 source `c1fdd8c` + release records) · Uncommitted, unreleased

Source for the next public release candidate, following the pre-publish audit in
`BillNgai-development/review/2026-09-29/pre-publish/PRE-PUBLISH-AUDIT.md`. Built in a separate
worktree (`../BillNgai-release-2.0.10`) so the uncommitted sync v3 pilot and other work in
`BillNgai-development/` stay untouched. **The sync v3 pilot is intentionally not included**
(audit P1-3). No version bump, commit, build, signing, installation or publication was made.
No customer profile was opened; all tests use temporary synthetic profiles.

## Included

| Audit item | Change |
|---|---|
| Seller color fix | Only the color hunks from the uncommitted work: round presets in 48px targets, HEX validation, former green preserved (`BRAND.md` note included). |
| P1-1 receipt dead end | Setup step 1 asks for VAT status (default stays “not confirmed”). `createReceipt` and the receipt prerequisite screen ask “not VAT-registered?” in place, save it, then continue. A registered business is sent to Settings and never flipped. A failed save restores the previous answer. `applyVatStatus()` is shared with Settings. |
| P1-2 one-at-a-time blockers | `issueBlockers()` lists every missing item at once in the editor with a fix button (business details, WHT switch, VAT answer, price rounding). `issuanceError()` remains the authoritative gate; tests assert the list is never empty when the gate rejects. |
| P2-1 WHT card | Dashboard card shows WHT still waiting for 50 ทวิ certificates after payment, plus the amount unpaid invoices will have withheld. |
| P2-2 line totals | Unit price rounds to 2 decimals when leaving the field (documents and recurring templates); row totals use the same rounding as `compute()`. Drafts with more decimals are blocked at issue with a one-click “round to 2 decimals”. Receipts created from existing issued invoices are not affected. |
| P2-3 tax ID | Setup has the same live check as Settings/client editor; letters, and short numbers on leaving the field, are flagged. Warning only — never blocks or rewrites. |
| P2-4 no payment method | Issuing an invoice with no valid PromptPay and no bank account adds a warning to the confirmation. |
| P3 copy | Payment dialog shows the amount due after withholding; Local is “free” in the plan card (SKU.md); setup color label; English WHT “Rate 3%”; wizard labels linked to inputs. |

## Validation

- `npm test`: **211 passed** (203 existing + 8 new in `test/prepublish-fixes.test.cjs`). `unit-tests.log`.
- Inline script syntax, `npm run release:check`, `git diff --check`: pass. All 757 literal `tr()` keys have English entries.
- Native Electron smokes, source runtime, temporary profiles — **all 11 PASS**: storage, option-a, design-fixes,
  fintech-ui (40 route states, 1440/940/600 px), receipt-reissue, legacy-review, payment-match, stabilization,
  bulk-correction, brand-color, and the new `test/prepublish-electron-smoke.cjs`.
- New first-day smoke (ordinary clicks, empty profile): setup with tax-ID feedback → client → quotation
  (price rounds, checklist, “go to switch”) → invoice (no-payment warning) → payment (amount shown) →
  receipt (inline VAT answer persisted to disk) → dashboard ฿300 pending → English checklist → reload.
- **P1-4 upgrade:** `test/upgrade-2.0.4-electron-smoke.cjs <v2.0.4 checkout>` builds a profile with the real
  2.0.4 source (pre-2.0.3 legacy invoice/tax invoice/unpaid invoice with Buddhist-year counters, plus
  2.0.4-issued invoice, receipt and quotation), opens it with this source, then reopens with 2.0.4.
  PASS: frozen 2.0.4 snapshots byte-identical, legacy originals unchanged, numbering continues without
  duplicates, VAT answer kept, legacy payment and 2.0.4 receipt each counted once (฿31,040), rollback loads.
  Run: `git worktree add --detach <tmp>/bn-2.0.4 v2.0.4`, link `node_modules`, then the command above.

Evidence: `review/2026-09-29/prepublish-fixes/` (logs and screenshots of setup, checklist, VAT prompt,
dashboard, English checklist, upgraded dashboard).

## Not covered / still open

- Packaged, signed build of this branch; Intel hardware; first launch on a clean Mac (P2-5).
- Website/checker still describe 2.0.4 (P1-5); Pro offer and existing-customer messaging (P1-6);
  source backup/visibility (P1-7); Windows 2.0.1 (P2-6) — owner decisions.
- Remaining P2/P3 items from the audit (documents-list performance, broader label association,
  backup pruning, entitlements, stale toasts) are not changed here.
