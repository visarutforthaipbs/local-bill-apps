# UX audit fixes — implementation and verification

2026-09-25. Local source candidate on top of the uncommitted Option A work; version
remains 2.0.6. Owner asked for a modern UI/UX audit, then "fix it all" and to use
judgment on the remaining items. Implemented by Claude Code; no worker delegation.
No accounting calculation, issuance rule, payment grouping, storage/IPC or
`renderPaper()` template changed. `main.js` and `preload.js` are unchanged.

## Delivered

- **Sample data:** sample documents are frozen through the normal issuance path
  (non-VAT, THB, `DEMO-*` numbers, one payment ID shared by invoice and receipt).
  They open as printable papers and count once, instead of legacy-review screens.
- **Dashboard:** money cards first; one "สิ่งที่ต้องทำ" list (overdue, recurring due,
  pending 50 ทวิ, backup) replaces stacked banners, including a duplicated one.
  "รับแล้ว" always shows the known amount; when historical groups are unresolved it
  adds the `ยอดยังไม่ครบ` tag and "ยังไม่รวมรายการเก่ารอตรวจ N ชุด" (DESIGN.md wording).
  Promotional card only for users with customers but no documents.
- **Issuing:** editor has `บันทึกร่าง` and `ออกเอกสาร`; issuing shows a type/customer/
  amount summary to confirm. `saveDoc()` still honours `issueConfirmed`. The required
  withholding confirmation moved out of the collapsed tax section.
- **Confirmations:** all native `confirm()` calls replaced by an in-app Thai dialog
  naming the action; destructive actions are red with Cancel focused; Escape cancels
  only the dialog. Harnesses without a DOM fall back to their stubbed `confirm`.
  Closing an unsaved new document keeps a recovery copy and offers `เปิดกลับ`;
  clearing VAT on a draft acts immediately with Undo.
- **Safety nets:** Undo for draft/client/recurring deletion and archive; error toasts
  stay 10 s and dismiss on click; Settings shows unsaved state, keeps Save visible and
  saves before navigating away; interrupted new documents can be restored.
- **Accessibility:** WCAG AA text contrast (`--text-faint` 4.7–5.2:1); primary
  buttons/badges/selected pills use `--accent-fill`, computed per brand color for
  ≥4.5:1 white text (default orange → `#C45200`, 4.61:1). Dialog role/labels, focus
  in/out and inert background; label linking; keyboard rows/cards; `aria-current`;
  live toast; focusable hint icons; switches were `display:none` and are now
  keyboard/screen-reader operable. App UI text ≥ 12px; Thai headings not uppercased
  or letter-spaced.
- **Layout:** sidebar collapses to icons below 1100px; KPI numbers scale instead of
  clipping; tables scroll rather than wrap numbers; top actions spaced; Cmd+K uses
  the icon set, translated, with a visible sidebar search button; void action label
  restored to `ยกเลิกและเก็บเอกสาร` (was ambiguous `ยกเลิก`); breadcrumb shows the
  issued buyer; Buddhist-year preview under native date pickers.
- **Policy alignment:** client default income category no longer Pro-gated
  (PRD-2.0.3 §C.3: classification available to all tiers).
- **Docs:** BRAND.md documents `--accent-fill`, border tokens, banner classes and
  the Thai typography rule.

## Verification

All on isolated synthetic profiles/ephemeral browser contexts. Playwright from
`~/.config/billngai/test-tools/node_modules`.

| Check | Result |
| --- | --- |
| `npm test` | 182/182 pass, 0 skipped |
| `npm run release:check` | Pass (OAuth configuration valid; contents not printed) |
| `node --check main.js preload.js`, `git diff --check` | Pass |
| Literal translation scan | 678 `tr()` keys, none missing |
| `test/option-a-electron-smoke.cjs` | Pass — `billngai-option-a-YRmgrp` |
| `test/stabilization-electron-smoke.cjs` | Pass — `billngai-204-native-G8NG15` |
| `test/payment-match-electron-smoke.cjs` | Pass — `billngai-payment-match-lY36bU` |
| `test/bulk-correction-electron-smoke.cjs` | Pass — `billngai-bulk-review-Gwuj2d` |
| `test/compliance-browser-smoke.cjs` | Pass (artifacts removed after run) |
| `test/electron-storage-smoke.cjs` | Pass — `billngai-electron-smoke-hZfL6a` |
| Session end-to-end script (scratchpad) | Pass: keyboard switch, issue/Escape/confirm, draft, delete + Undo, reopen closed draft, crash-draft restore, settings save on leave, 940px layout, no unlabeled fields, no page errors |

Temporary fixtures are under `/var/folders/tb/619_zw050jd0m07bpqrll38r0000gn/T/`.

Test changes, reflecting new UI rather than silencing failures:
- `compliance-browser-smoke.cjs`: issues via `ออกเอกสาร` + in-app confirm; opens the
  collapsed tax section before choosing a category; keeps the typed receipt aside
  while changing Settings.
- `stabilization-electron-smoke.cjs`: void is reached through the "⋯" menu.
- `option-a-electron-smoke.cjs`: license deactivation confirms in-app.
The stabilization and compliance smokes already failed before this work (baseline
copy of the pre-fix `billing.html`), because Option A had moved the void action and
tax details; they now pass.

Source SHA-256 (uncommitted, base `e6a95d5`):

```text
221658faea18186b2d59625c59274f7b25fc07379c76509390de272130bab2a0  billing.html
e0d1e88865bdc91f0d98b7a7fd5d2d8ab8f56694fb1bc5f83b9888f5b5b2d349  main.js (unchanged)
f7e35bd193495792902336233aa5bb587f31e9e368058a63c877c148d3388284  preload.js (unchanged)
b5fcad9dc1a4432e1654dbd043afac70e1d50436e208c070eeba575919ec0b49  BRAND.md
```

## Not verified / open

- No signed/notarized package, packaged smoke, Intel hardware, Windows or MAS run.
- Owner-data preservation check (as done for 2.0.6 on a copy of the real profile)
  not run; needs owner authorization.
- No usability session with real users; screen-reader behaviour checked by
  attributes, not with VoiceOver.
- Native date pickers still display the OS (Christian) calendar; the app adds a
  Buddhist-year reading beneath them.
- At release time: FAQ.md, DELIVERY.md LINE template, website support page and
  LINE auto-reply guide still say "ตั้งค่า → พื้นที่ทำงาน" (correct for public 2.0.4;
  Pro activation is now under "ข้อมูลและสำรอง"). Website buttons still use the
  bright orange; align with `--accent-fill` if desired.

## Delivery state

Superseded: released privately as **2.0.7** (commit `ba1f5a1`), signed, notarized,
installed and verified on lighthouse-control — see [INSTALL-2.0.7.md](INSTALL-2.0.7.md).
The source hashes above are from before the version bump; `package.json`,
`package-lock.json` and CHANGELOG changed for 2.0.7, `billing.html` did not.
No public release, push, tag or website change.
