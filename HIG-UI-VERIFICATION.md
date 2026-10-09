# Apple HIG restyle — source verification

2026-10-09 · Owner-authorized UI overhaul · Unreleased, package version remains 2.0.14 · branch `codex/hig-restyle`

Decision and token contract: `review/2026-10-09/design/HIG-RESTYLE-PLAN.md` (HIG sources read on
2026-10-09) and the revised `BRAND.md` design-tokens section. Screenshots: `review/2026-10-09/design/screens/`.

## What changed

- **Typography**: system font (`-apple-system` → SF Pro on Mac/iOS, Segoe UI on Windows) for Latin and
  figures; bundled LINE Seed Sans TH for Thai. Inter removed from `fonts/`. Text-style tokens
  `--fs-*` on the macOS scale (body 13 px, title 2 17 px, caption floor 11 px for Thai); `mobile.css`
  swaps in the iOS scale (body 17 px).
- **Colour**: semantic tokens with light and dark values following the OS (`color-scheme: light dark`);
  Apple system colours for status dots, AA inks for status text; orange only on the one prominent action
  per view, sidebar icons, selection and the received-income card. `.paper` unchanged (own light palette).
- **Shape**: capsule buttons / segmented controls / search / chips; 8 px fields; 12 px cards and grouped
  lists; 16 px sheets. Concentric corners.
- **Shell**: macOS window uses `titleBarStyle:'hiddenInset'`, inset traffic lights and `vibrancy:'sidebar'`
  (`main.js`); the renderer marks `html.mac-window`, makes the sidebar transparent and a drag region, and
  insets it 52 px. Toolbar is 52 px, translucent, with a scroll-edge hairline. Window background follows
  `nativeTheme` (transparent on macOS, `#F5F3EF` / `#1C1C1E` elsewhere); print still forces white.
- **Controls**: 32 px desktop / 44 px iOS; secondary buttons are system fills without borders; attestation
  checkboxes are native macOS checkboxes (`accent-color`) and 51 × 31 switch rows on iOS; Settings rows
  keep the `.toggle` switch (30 × 18 desktop). Icons stroke 2 px.
- **Containers**: inset grouped document list (56 px rows, inset separators), cards without borders in dark,
  alert-style confirm box (Cancel leading, default trailing), popover menus, capsule toast.
- **Motion**: no looping pulse on the overdue card; 200 ms ease-out entrances only.
- Fixed in passing: the receipt-correction dialog's three confirmation checkboxes no longer inherit the
  text-field styling (`<p><label>` like the sibling dialogs).

## Verified

| Check | Result |
|---|---|
| Inline script syntax (`node --check` on the extracted `<script>` blocks) | OK |
| `npm test` | 342 / 342 pass |
| `npm run release:check` | PASS |
| `git diff --check` | clean |
| `mobile/test/accessibility.test.cjs` (mobile.css contract) | 9 / 9 pass |
| Contrast, every text/background token pair, light and dark (WCAG, script in the session log) | all ≥ 4.5:1 (lowest: tertiary text on canvas 4.58 light / 4.85 dark; dark text on orange 6.30 / 7.03) |
| `test/fintech-ui-electron-smoke.cjs` (updated: canvas follows the OS scheme; macOS body is transparent so `.main` is asserted) | PASS — see note on scheme switching below |
| `test/brand-color`, `payment-match`, `bulk-correction` smokes (fixtures now declare `reviewSemanticsVersion:3`) | PASS |
| `test/pdf-output-electron-smoke.cjs` (updated: window background restored to the theme value; Electron reports the transparent macOS window as `#000000`) | PASS |
| `test/legacy-review-electron-smoke.cjs`, `test/sync-v3-electron-smoke.cjs` | PASS |
| Real macOS window captures (`screencapture` of the Playwright-driven Electron window) in light and dark | vibrancy sidebar, inset traffic lights, dark canvas — `screens/real-*.png` |
| Playwright screenshots: dashboard, documents, clients, report, WHT, settings, editor sheet, old-records review, confirm alert, document view — light and dark | no page errors — `screens/*.png` |
| Chrome previews of the iOS layer at 390 × 844 and 1024 × 768, light and dark | tab bar, sheets, switch rows, segmented tabs — `screens/phone-*.png`, `screens/tablet-*.png` |
| Printed paper | `.paper` rules unchanged; `.paper` assertions in the fintech smoke (white background, `--accent #ff6b00`, ink `rgb(31, 28, 23)`) pass in both schemes |

### Electron smoke suite status

- Four tests had fixtures that predate 2.0.14's data-upgrade review gate (`meta.reviewSemanticsVersion`
  missing → "Review the data upgrade" blocks the old-records view). Declaring
  `reviewSemanticsVersion:3` in the synthetic fixtures fixed `brand-color`, `payment-match`,
  `bulk-correction` and the gate step of the others.
- `prepublish` force-checked the 1 px hidden switch input after convert-to-invoice, which Playwright
  rejects as "outside of the viewport"; it now clicks the visible switch track like a person and gets
  past that step. It then stops at its confirm-dialog helper (line 71) — the same place it stops on the
  untouched `HEAD`.
- Five still fail, **identically on the unmodified `HEAD` with the same fixture fix** (checked in a
  clean worktree, same failing line numbers): `stabilization` (void reason not persisted),
  `option-a` (expects settings to save on tab switch; 2.0.14 saves explicitly), `receipt-reissue`
  (no `receipt_reissue` events written), `design-fixes` (client-save wait). These are behaviour
  changes in 2.0.14 that the tests never caught up with (plus `prepublish` at line 71) — a separate test-maintenance pass.
- `audio` needs a dev Electron at `~/.local/share/billngai-dev/43.7.3` (not installed here);
  `upgrade-2.0.4` needs a 2.0.4 checkout argument.

### Scheme switching note

Under CDP colour-scheme emulation, Chromium left `.main` painted with the previous scheme's `var(--bg)`
after several viewport changes even though the token had updated. The renderer now mirrors
`prefers-color-scheme` onto `html.scheme-dark` on change, which forces a full style recompute; the
smoke test waits for that class. A real OS appearance switch goes through the same media-query change.

## Not done / follow-ups

- Done after the first pass: Return answers the default button in alerts (never a destructive one) and in
  sheets with a single prominent button when a text field has focus — except the document editor, where
  Enter never issues or saves (verified with a Playwright probe). Every `askConfirm` call already passes a
  verb `confirmLabel`; only the generic fallback is ยืนยัน.
- Illustrations sit on white plates in dark mode (the PNGs have white backgrounds); re-export with
  transparent backgrounds when convenient.
- Windows has no vibrancy or hidden title bar; it gets the opaque `--surface-2` sidebar and the native frame.
- The installed TestFlight/App Store builds are unchanged; this is source only.
