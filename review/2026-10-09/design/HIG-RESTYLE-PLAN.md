# BillNgai UI restyle — Apple Human Interface Guidelines, orange kept

Owner decision 2026-10-09: the final UI overhaul follows Apple's Human Interface
Guidelines (macOS for the desktop app, iOS/iPadOS for the phone/tablet build) while
keeping the BillNgai orange accent. Decided with the owner:

- Scope: Mac desktop **and** iPhone/iPad (same `billing.html`; `mobile/web/mobile.css`
  carries the iOS layer). Windows inherits the desktop look.
- Typography: system font (SF Pro via `-apple-system`) for Latin and figures, bundled
  **LINE Seed Sans TH** for Thai. Inter is removed.
- Appearance: full light **and** dark, following the OS. Printed paper stays light.
- Shape/material: macOS 26 / iOS 26 — capsule controls, grouped inset containers at
  12 px, translucent sidebar/toolbar (Electron vibrancy), colour used sparingly.

This file supersedes the "Modern Fintech / Neobanking" token section of `BRAND.md`;
the 37signals workflow principles, voice, printed-paper and illustration rules there
are unchanged.

## 1. HIG rules we are applying (source: developer.apple.com HIG, read 2026-10-09)

| Area | Rule | Where it bites |
|---|---|---|
| Typography | System font, never embedded. macOS text styles: Large Title 26, Title 1 22, Title 2 17, Title 3 15, Headline 13 bold, Body 13, Callout 12, Subhead 11, Footnote/Caption 10 (min 10). iOS: Large Title 34, Title 1 28, Title 2 22, Title 3 20, Headline 17 semibold, Body 17, Callout 16, Subhead 15, Footnote 13, Caption 12/11 (min 11). Avoid light weights. | Replace the ad-hoc 10–15.5 px sizes with a text-style scale. |
| Colour | Semantic colours (label / secondary / tertiary, separator, grouped backgrounds, fills); light + dark + increased-contrast variants; accent on the one prominent action per view, sidebar icons and selection; never colour alone for status. | New token set; orange only on primary action, nav icons, selection, received-income card. |
| Layout | 44 × 44 pt hit regions; align and group; progressive disclosure; macOS: nothing critical at the bottom of a window; controls differentiated from content by material, not solid colour. | Control heights, grouped lists, sticky save bar review. |
| Buttons | Prominent (filled accent) for the most likely action, 1–2 per view; style not size distinguishes choices; default button answers Return; destructive never default; trailing ellipsis when a button opens another view; always a pressed state. | `.btn` family, modal footers, `#topActions`. |
| Toggles | macOS: checkbox for a single setting/attestation, switch for an emphasised group; iOS: switch only inside a list row. Don't replace existing checkboxes with switches. | Attestation checkboxes become real macOS checkboxes; Settings rows keep switches; iOS renders attestation rows as switch rows. |
| Toolbar | Title ≤ 15 chars, leading / centre / trailing groups, one prominent action trailing, no bezels on items, integrated with the title bar on macOS. | `.topbar` becomes the window toolbar; traffic lights inset. |
| Sidebar | Icons in accent colour, selection highlight, small/medium row sizes, can be hidden, nothing critical at the bottom. | `.sidebar`/`.nav`; move `.file-status` into the toolbar area. |
| Lists & tables | Grouped inset lists; headers short; macOS multi-column tables may alternate rows; selection feedback. | Documents list, settings groups, review dialogs. |
| Modality & alerts | Sheets for tasks, alerts for decisions: title + short text + ≤ 3 buttons, default trailing, Cancel leading, specific verbs not "OK", Esc cancels. | `.modal`, `.confirm-box`. |
| Materials | Liquid Glass only on the navigation/control layer (sidebar, toolbar), never on content; regular variant where there is text. | Electron `vibrancy:'sidebar'` + transparent sidebar; toolbar gets a scroll-edge blur; content stays opaque. |

## 2. Token contract (replaces BRAND.md "Design tokens")

All tokens live in `:root` of `billing.html`; dark values under
`@media (prefers-color-scheme: dark)`. `.paper` keeps its own light palette and
`color-scheme:light` (unchanged).

Backgrounds and surfaces (light / dark):
`--bg` window & grouped background `#F5F3EF` / `#1C1C1E` ·
`--surface` cards, sheets `#FFFFFF` / `#2C2C2E` ·
`--surface-2` controls, inset fields `#F2F2F7` / `#3A3A3C` ·
`--surface-3` secondary fill `#E5E5EA` / `#48484A` ·
`--fill`, `--fill-2`, `--fill-3` = rgba(120,120,128,.20/.16/.12) light, (.36/.32/.24) dark (iOS system fills, used for secondary buttons, segmented tracks, hover).

Labels: `--text` `#1D1D1F` / `#F5F5F7` · `--text-dim` (secondary) rgba(60,60,67,.60) / rgba(235,235,245,.60) · `--text-faint` (tertiary) rgba(60,60,67,.30) → but Thai body copy needs ≥ 4.5:1, so tertiary is used only for metadata ≥ 12 px; `--text-faint` resolves to `#6E6E73` / `#98989D`.

Separators: `--border` rgba(60,60,67,.29) / rgba(84,84,88,.65) · `--border-soft` rgba(60,60,67,.12) / rgba(84,84,88,.35).

Accent: `--accent` `#FF6B00` light, `#FF7D26` dark · `--on-accent` `#231307` (kept: dark text on orange passes contrast; white does not) · `--accent-ink` `#A84400` / `#FFA366` (accent as text) · derived `--accent-tint`, `--accent-soft`, `--accent-sel` via `color-mix` as today.

Semantic: dots/badges use Apple system colours (green `#34C759`/`#30D158`, red `#FF3B30`/`#FF453A`, yellow `#FFCC00`/`#FFD60A`, blue `#007AFF`/`#0A84FF`); text uses ink variants that pass AA (existing `--green #197044`, `--red #AD302C`, `--amber #7E570E`, `--blue #315C80` light; lighter inks dark).

Shape: `--radius-control: 999px` (capsule buttons, segmented, search, chips) ·
`--radius-sm: 8px` (text fields, menu items, inner rows) ·
`--radius: 12px` (cards, grouped lists, popovers) ·
`--radius-lg: 16px` (sheets, command palette). Concentric: inner radius = outer − padding.

Type scale tokens (desktop defaults, macOS): `--fs-large-title 26` · `--fs-title1 22` · `--fs-title2 17` · `--fs-title3 15` · `--fs-headline 13/700` · `--fs-body 13` · `--fs-callout 12` · `--fs-subhead 11` · `--fs-caption 11` (floor for Thai). Money figures keep their larger display sizes (dashboard 28–44 px, cards 24 px, rows 18 px) with `font-variant-numeric: tabular-nums`. Line-height 1.45 body (Thai needs more than SF's 16/13). `mobile.css` overrides the scale with the iOS values above.

Font stack: `--font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "LINE Seed Sans TH", "Segoe UI", system-ui, sans-serif`. Latin/figures come from SF (or Segoe on Windows); Thai falls through to LINE Seed. `fonts/fonts.css` keeps only the two LINE Seed faces; Inter files are deleted from `fonts/` (packaging glob `fonts/**/*` needs no change).

Spacing: 8-pt grid unchanged (8/16/24/32). Control heights: desktop 32 px (large macOS control), mobile 44 px minimum; hit regions ≥ 44 pt everywhere via padding when the visual is smaller.

Motion: 200 ms ease-out as today; no translateY hover lifts on buttons (macOS buttons don't move); pressed state = darken 8 %. Reduced motion already honoured.

## 3. Component changes

- **Window chrome (main.js)**: `titleBarStyle:'hiddenInset'`, `trafficLightPosition:{x:16,y:18}`, `vibrancy:'sidebar'` on macOS; `backgroundColor` follows `nativeTheme.shouldUseDarkColors` and updates on `nativeTheme.on('updated')`; `printOnWhitePage` restores the current theme colour. Renderer: `html.platform-darwin` class from `navigator.platform`; `.sidebar` becomes transparent (vibrancy shows through) with `-webkit-app-region: drag` and 52 px top inset for the traffic lights; interactive children `no-drag`.
- **Sidebar**: 220 px, brand row = app name only (Headline), nav rows 32 px with 18 px accent-coloured icons, selected row = accent fill + on-accent text, no dot; badge = secondary pill; search hint = a macOS search field look (capsule, fill); `.file-status` moves to the toolbar's trailing group as a small status item; sidebar collapses to icons < 1100 px as now.
- **Toolbar (`.topbar`)**: 52 px, title Title 2 (17/600) leading, page actions trailing, one `.btn-primary`; translucent with `backdrop-filter` and a hairline bottom separator only when content is scrolled (scroll-edge effect); not sticky-opaque.
- **Buttons**: capsule; primary = accent fill; secondary (`.btn`) = `--fill-2`, no border; `.btn-ghost` = plain/tinted label; `.btn-danger` = red label, `.btn-danger-solid` red fill; sizes regular 32 px / `.btn-sm` 26 px; pressed darkens; primary in a modal responds to Return (add in `openModal` keydown if missing).
- **Segmented / pills**: `.tabs` and `.pill-select` (≤ 5 options) become a segmented control: capsule track `--fill-3`, selected segment `--surface` with shadow in light / `--surface-3` in dark, 28 px; `#docStatusChips` stay chips (capsules, fill, accent when on).
- **Fields**: `.field label` = Subhead secondary; inputs 32 px, radius 8, `--surface-2` fill, 1 px separator, focus ring accent; `.field input[type=checkbox]` excluded from the text-field rule (the bug from the reissue dialog) and rendered as a native checkbox with `accent-color: var(--accent)`; `.toggle` switch kept for Settings rows at 26 × 15 (macOS) / 51 × 31 (iOS).
- **Cards / grouped containers**: `.pillar`, `.card-block`, `.chart-card`, `.client-card`, `.report-cards .rc`, `.doc-list-compact`, `.filing-card`, `.empty` → 12 px radius, `--surface`, hairline border in light, none in dark, no entrance translate on every card (opacity fade only). Received-income pillar keeps the orange fill. Section headers = Subhead uppercase secondary (iOS grouped) / Headline (macOS).
- **Lists**: Documents compact list = inset grouped list, 44 px rows, hairline separators inset from the leading text, hover `--fill-3`, selection accent tint; status badges = small capsules with system-colour dot + ink text.
- **Modals**: sheet 16 px radius, no border, `--shadow` only; header Title 2; footer right-aligned Cancel → primary; `.x` close = circular fill button (iOS) / none on macOS (Esc + Cancel). `.confirm-box` = macOS alert: 300–420 px, app icon optional, Headline title, Callout text, buttons trailing with Cancel leading; Esc cancels (exists).
- **Toast / cmdk / menus / tooltips**: toast = regular-material capsule bottom-centre; cmdk = 16 px sheet with search field; `.doc-more-menu` = popover 12 px with 8 px items; tooltips keep dark bubble.
- **Icons**: keep the `ICONS` outline family, stroke 2 (was 2.5) to sit with 13 px semibold text like SF Symbols medium; nav icons 18 px, button icons 16 px.
- **Mobile layer (`mobile.css`)**: iOS type scale; Large Title 28/700 in the top bar collapsing to 17 on scroll (CSS only: keep static 28); bottom tab bar = translucent (`backdrop-filter`) with 10 px labels and 24 px icons, safe-area aware (exists); sheets slide from bottom with 16 px top radius (exists, adjust radius); grouped inset lists 10 px; 44 px rows and 48 px buttons retained (mobile audit asserts targets); attestation checkboxes rendered as switch rows.

## 4. Files

- `billing.html` — `<style>` lines 8–874 (tokens, every component rule, media queries) and three script touch-points: `ic()` stroke, `openModal` Return handling, `html` platform class at boot.
- `fonts/fonts.css`, `fonts/Inter-*.woff2` (delete).
- `main.js` — `createWindow()`, `WINDOW_BACKGROUND`, `printOnWhitePage` restore.
- `mobile/web/mobile.css` — iOS scale and components.
- `BRAND.md` — replace the token/typography/radius/spacing sections with §2–3 and record this owner revision; `CLAUDE.md` — point UI work here.
- New `HIG-UI-VERIFICATION.md` with light/dark/mobile screenshots (same pattern as `FINTECH-UI-VERIFICATION.md`).

## 5. Verification

1. `python3` extract inline script → `node --check`.
2. `npm test` and `npm run release:check` (packaging test lists fonts via glob).
3. Electron smoke tests in `test/*-electron-smoke.cjs` on a synthetic profile (brand colour, legacy review, sync UI); update any assertion that checked the old pill radius / Inter.
4. Screenshot pass with Playwright-driven Electron on a synthetic `--user-data-dir`: Dashboard, Documents, document editor modal, Settings, old-records review, confirm alert — light and dark (`nativeTheme.themeSource`), 1280 × 860 and 980 × 640.
5. Mobile: `mobile/test/mobile-ui-audit.js` (tap targets, overflow, keyboard) plus Chrome screenshots at 390 × 844 and 1024 × 768 with `mobile.css`.
6. Print/PDF: export one document before and after; `.paper` must be byte-identical in layout (it is scoped and untouched).
7. Contrast check of every text/background pair in both modes (script over the token table; AA for body, 3:1 for large figures).
