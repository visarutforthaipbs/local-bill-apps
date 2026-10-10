---
name: apple-platform-design
description: Apple Human Interface Guidelines and App Review best practice for BillNgai on Mac (Electron), iPhone and iPad (Capacitor). Use before any UI, UX, copy, icon, dialog, settings, accessibility or store-submission change on billing.html, mobile/web/mobile.css or main.js, and when reviewing a screenshot or a rejection from Apple. Contains the HIG text (fetched 2026-10-09), the App Review Guidelines text, the BillNgai token mapping and a verification routine.
---

# Apple platform design for BillNgai

BillNgai is one `billing.html` renderer shipped two ways since 2026-10-09: Electron on macOS (Mac App Store; one final direct DMG),
and Capacitor on iPhone/iPad. The owner decided on 2026-10-09 that the UI follows Apple's
Human Interface Guidelines while keeping the orange accent. `BRAND.md` records the contract;
`review/2026-10-09/design/HIG-RESTYLE-PLAN.md` records the decisions; this skill is the
working reference so every later change stays on the same path.

## 1. Read the source, not memory

- `references/hig/<page>.md` — plain-text copies of the HIG pages (foundations, components,
  patterns, platform pages). Open the page for the component you are touching before editing.
- `references/app-review-guidelines.txt` — App Store Review Guidelines, full text.
- A page that is missing: `scripts/fetch-hig.sh <slug>` (slug = last path segment of the HIG URL).
  Apple revises the HIG; refetch a page if the copy is older than ~3 months or the task is
  store-critical.
- Never assert "Apple requires X" without a line in one of these files to point at.

## 2. The rules that matter most here (with the file to cite)

| Topic | Rule | File |
|---|---|---|
| Typography | System font via `-apple-system`; never embed SF. macOS body 13 pt (min 10), iOS body 17 pt (min 11). Avoid light weights. Thai needs the bundled LINE Seed Sans TH placed first in `--font` with a Thai `unicode-range` (iOS's system font has its own Thai and would otherwise win) and a caption floor of 11 px. | `hig/typography.md` |
| Colour | Semantic colours with light, dark and increased-contrast variants; accent on the prominent action, sidebar icons and selection; don't colour multiple controls; colour never the only signal. | `hig/color.md`, `hig/dark-mode.md` |
| Layout | 44 × 44 pt hit regions; align and group; progressive disclosure; macOS: nothing critical at the bottom of a window; size classes decide layout on iPad, not device type. | `hig/layout.md`, `hig/designing-for-ipados.md` |
| Buttons | One or two prominent buttons per view; style, not size, distinguishes options; default button answers Return; destructive never default; trailing ellipsis when a button opens another view; always a pressed state. | `hig/buttons.md` |
| Toggles | macOS: checkbox for a single setting/attestation, switch for an emphasised group, don't replace existing checkboxes; iOS: switch only in a list row. | `hig/toggles.md` |
| Toolbars / nav bars | Title ≤ 15 chars; leading / centre / trailing groups; one `.prominent` action trailing; no bezels; large title collapses on scroll on iOS. | `hig/toolbars.md` |
| Sidebars / tab bars | Sidebar icons in accent colour, hideable, nothing critical at the bottom; tab bar for the 3–5 top destinations on iPhone, labels short. | `hig/sidebars.md`, `hig/tab-bars.md` |
| Lists & tables | Grouped inset lists; succinct row text; macOS tables may alternate rows and sort by column header. | `hig/lists-and-tables.md` |
| Modality | Sheets for tasks, alerts for decisions; obvious dismiss; never stack modals; confirm before losing user content. | `hig/modality.md`, `hig/sheets.md` |
| Alerts | Title + optional text + ≤ 3 buttons; default trailing, Cancel leading; specific verbs ("Delete", "Issue"), never "OK" for a decision; Esc cancels; no alerts at launch. | `hig/alerts.md` |
| Materials | Liquid Glass / translucency only on the navigation layer (sidebar, toolbar, tab bar), never on content. | `hig/materials.md` |
| Search / fields | Placeholder plus a visible label; validate at the right moment; keyboard type on iOS; clear button on iOS. | `hig/search-fields.md`, `hig/text-fields.md`, `hig/entering-data.md` |
| Settings | Few, grouped, with plain labels; Mac settings window conventions; iOS grouped lists. | `hig/settings.md` |
| Icons / symbols | SF Symbols weight matches text weight; app icon rules (no transparency, no text). | `hig/sf-symbols.md`, `hig/app-icons.md` |
| Accessibility | Dynamic Type, VoiceOver labels on every control, Reduce Motion, Increase Contrast, colour-independent status. | `hig/accessibility.md` |
| Writing | Sentence case for text, title case for buttons in English; short, direct, no jargon. Thai copy stays natural Thai (BRAND.md voice). | `hig/writing.md` |
| Privacy / accounts | Ask only when needed, explain why; no account required for core use; sign-in only for features that need it. | `hig/privacy.md`, `hig/managing-accounts.md` |
| Store review | 2.4.5 sandbox entitlements must be justified (network.server is needed for the OAuth loopback); 3.1.1 no external purchase prompts in the store build; 1.5 working support URL; 5.1.1 data use. | `app-review-guidelines.txt`, `app-store-reject-playbook.md` (repo root) |

## 3. How the guidelines map onto this codebase

- Tokens: `:root` in `billing.html` (light), `@media (prefers-color-scheme: dark)` (dark);
  text styles `--fs-large-title … --fs-caption`; control heights `--control-h`,
  `--control-h-sm`; shapes `--radius-control` (capsule), `--radius-sm` 8, `--radius` 12,
  `--radius-lg` 16. `mobile/web/mobile.css` overrides the scale to iOS values and the
  switch size to 51 × 31. `mobile/scripts/prepare-web.cjs` parses `--bg` and `--accent`
  as literal hex — keep them literal.
- Components to reuse (never invent parallel ones): `.btn` (+`-primary`, `-ghost`,
  `-danger`, `-danger-solid`, `-sm`), `.tabs` (segmented), `.pill-select` (chips),
  `.badge-status`, `.field`, `.toggle` (switch), native `input[type=checkbox]`
  (macOS checkbox; switch row on iOS), `.card-block`, `.doc-list-compact`, `#modal` +
  `openModal()`/`closeModal()` (sheet), `askConfirm()` (alert — always pass `confirmLabel`
  with a verb), `toast()`, `.doc-more-menu` (popover), `ic()` icons (stroke 2).
- Window chrome lives in `main.js createWindow()` (hiddenInset title bar, vibrancy, theme
  background). The renderer marks `html.mac-window` and `html.scheme-dark`.
- The printed `.paper` is exempt from all of this: own light palette, radii and type.
- Accent: `--accent #FF6B00` (light) / `#FF7D26` (dark) with dark `--on-accent` text —
  white on this orange fails contrast, keep the dark text.

## 4. Verification routine for any UI change

1. `node --check` the extracted inline script; `npm test`; `npm run release:check`.
2. Electron screenshots on a synthetic profile in light and dark
   (`test/fintech-ui-electron-smoke.cjs` is the pattern; `nativeTheme.themeSource` +
   `page.emulateMedia` + wait for `html.scheme-dark`). Real-window captures with
   `screencapture -R` show the vibrancy sidebar that Playwright paints white.
3. iPhone/iPad: Chrome preview of `billing.html` + `mobile/web/*.css` at 390 × 844 and
   1024 × 768, both schemes; then the real build on the iOS Simulator
   (`mobile/package.json build:simulator`, needs `sudo xcode-select -s /Applications/Xcode.app`
   and `npm ci` in `mobile/`). Run `mobile/test/mobile-ui-audit.js` for 44 pt targets and overflow.
4. Contrast every new text/background pair (WCAG ≥ 4.5:1 body, ≥ 3:1 large) in both schemes.
5. Check the printed document is unchanged (`.paper` assertions in the fintech smoke).
6. Record the result in a `*-VERIFICATION.md` with screenshots under `review/<date>/design/screens/`.

## 5. Store-submission checklist (from past rejections)

- Keep `com.apple.security.network.server` in the MAS entitlements and explain the OAuth
  loopback in Review Notes (`BillNgai-MAS-Pilot/build/entitlements.mas.plist`).
- No external purchase links, prices or licence-key fields in the App Store build.
- Support URL must load and show contact + privacy; test account notes ≤ 4,000 chars.
- Every window must be reopenable from the Dock and Window menu (Guideline 4 reopen).
- Screenshots in the store must match the current UI after a restyle.
