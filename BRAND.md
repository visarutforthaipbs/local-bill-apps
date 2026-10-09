# BillNgai (บิลง่าย) Brand Identity

This document is the single source of truth for every UI change, icon, animation,
document template, and marketing asset in this project.

**If a generated component conflicts with this document, THIS DOCUMENT WINS.**
Explicit owner requests can revise this contract. The owner approved the fintech UI direction on 2026-09-29 and, on 2026-10-09, the Apple HIG restyle recorded in the design-tokens section below.

Positioning line (for store copy / marketing, not in-app):
> The billing and tax app built for Thai freelancers — not a global SaaS
> translated into Thai. Your data stays on your machine.

---

## Brand personality

BillNgai feels like:

✓ Fast · ✓ Human · ✓ Friendly · ✓ Trustworthy · ✓ Minimal

NOT:

✗ Dense enterprise ERP · ✗ Overly playful · ✗ Gamified

Every screen should communicate: **less work, less friction, more speed, more confidence.**

---

## Product design: 37signals principles

The daily job is to create a document, send it, record payment, and find it later.
Non-VAT freelancers come first. Keep useful capabilities and historical records;
place occasional work beneath its parent task rather than adding sidebar entries.

- Give each screen one clear job, with normal, empty and error states.
- Offer choices that work today; explain prerequisites before users fill a form.
- Keep pending work recoverable. Only explicit confirmation changes financial facts.
- Lead with useful totals and their periods; keep relevant limitations visible.
- Name actions by their result, especially backups, exports and historical review.
- Disclose optional detail without hiding relevant VAT or incomplete records.
- Prefer the existing vanilla-JS components; avoid new modes, settings and dependencies.

Navigation: Dashboard, Documents (including recurring and historical review),
Clients, Income summary (including accounting periods), WHT certificates, Settings.
See `review/2026-09-29/design/AUDIT-37SIGNALS.md` for the source-based rationale.

---

## Design tokens — Apple Human Interface Guidelines (owner revision 2026-10-09)

The owner directed the final UI overhaul to follow Apple's Human Interface Guidelines
(macOS for the desktop app, iOS/iPadOS for the iPhone/iPad build) while keeping the
BillNgai orange accent. The full rationale, HIG sources and component decisions are in
`review/2026-10-09/design/HIG-RESTYLE-PLAN.md`; `HIG-UI-VERIFICATION.md` records the
verification. This supersedes the "Modern Fintech / Neobanking" tokens of 2026-09-29.
The 37signals workflow principles above, the voice rules, printed paper and
illustration rules below are unchanged.

Principles applied: semantic colours with light **and** dark variants following the OS;
colour used sparingly (one prominent action per view, sidebar icons, selection, the
received-income card); system typography scale; 44 pt hit regions; grouped inset
containers; materials only on the navigation layer (sidebar/toolbar), never on content;
no looping motion. No framework or dependency is needed.

Tokens live in `:root` of `billing.html`, dark values under `@media (prefers-color-scheme: dark)`.
`mobile/scripts/prepare-web.cjs` reads `--bg` and `--accent` from the light block as literal hex.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#F5F3EF` | `#1C1C1E` | Window canvas (warm neutral, grouped background) |
| `--surface` | `#FFFFFF` | `#2C2C2E` | Cards, grouped lists, sheets |
| `--surface-2` / `--surface-3` | `#F2F2F7` / `#E5E5EA` | `#3A3A3C` / `#48484A` | Inset fields, secondary surfaces |
| `--fill` … `--fill-4` | rgba(120,120,128,.20/.16/.12/.08) | (.36/.32/.24/.18) | System fills: secondary buttons, segmented tracks, hover |
| `--text` / `--text-dim` / `--text-faint` | `#1D1D1F` / `#515154` / `#6E6E73` | `#F5F5F7` / `#B9B9BE` / `#98989D` | Label / secondary / tertiary (all ≥ 4.5:1 on their surfaces) |
| `--border` / `--border-soft` | rgba(60,60,67,.29/.12) | rgba(84,84,88,.65/.35) | Separators |
| `--accent` / `--accent-fill` | `#FF6B00` | `#FF7D26` | The one prominent action, nav icons, selection, received income |
| `--on-accent` | `#231307` | same | Dark text on orange (white fails contrast) |
| `--accent-ink` | `#A84400` | `#FFA366` | Accent as text |
| `--sys-green/red/yellow/blue/grey` | Apple system colours | dark variants | Status dots and badge fills only |
| `--green/--red/--amber/--blue` (+`-bg`) | AA ink + tint | lighter ink + tint | Status text and banners |
| `--scrim` | rgba(0,0,0,.32) | rgba(0,0,0,.55) | Behind sheets and alerts |

Semantic colours keep their meaning; colour never replaces status text. No gradients
or textures; translucency is limited to the sidebar (Electron `vibrancy:'sidebar'`),
the toolbar and the Settings save bar (`backdrop-filter`). On macOS the window uses a
hidden title bar with inset traffic lights (`html.mac-window` sets `--titlebar-inset`).

The fixed app palette is independent of `DB.business.brandColor`, which continues to
control the seller's document colour through `--document-accent` / `--document-accent-ink`.
`.paper` keeps its own light palette and radii, so OS dark mode never changes
invoice/PDF appearance.

Color settings use circular 32px preset swatches inside fixed 48px targets,
with a checkmark and `aria-pressed` selection. The custom picker is a square
48px control with the input-radius token; the HEX field uses the shared field style.
Saved seller colors, including the former green default, must survive reload.

The owner selected the folded-paper lowercase "b" logo (concept B) on 2026-10-03.
The primary flat mark is `logo.svg`: ivory paper ribbon on the original orange
rounded square. The matching matte-clay render is `build/icon_source.png` for
app icons, with a retained export at `assets/brand/fintech/logo-b-clay.png`.
Use the same silhouette in small flat and large clay forms; no check or arrow.
Source updates do not replace installed app icons or publish marketing changes.

### Typography

- System font for Latin and figures: `-apple-system` (SF Pro on Mac/iOS, Segoe UI on
  Windows), never embedded. Thai: **LINE Seed Sans TH**, bundled in `fonts/` (SF has no
  Thai glyphs, so Thai falls through to it per glyph). Inter is gone.
- Text-style tokens, macOS values on desktop: `--fs-title1 22` · `--fs-title2 17`
  (toolbar titles, sheet titles) · `--fs-title3 15` · `--fs-headline 13/700` ·
  `--fs-body 13` · `--fs-callout 12` · `--fs-subhead 12` · `--fs-caption 11` (floor —
  Thai needs 11 px, not Apple's 10). `mobile.css` swaps in the iOS scale (34/28/22/20/17/17/16/15/13).
- Weights 400 / 600 / 700 only; no light weights. Line-height 1.45 (1.4 on iOS).
- Money figures keep their display sizes: dashboard 28–44 px (container-responsive),
  card amounts 22–24 px, row amounts 15–18 px, always `tabular-nums`.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-control` | 999px | Buttons, segmented controls, search field, chips, badges |
| `--radius-sm` | 8px (10 on iOS) | Text fields, menu items, nav rows, inner rows |
| `--radius` | 12px | Cards, grouped lists, popovers |
| `--radius-lg` | 16px (20 on iOS) | Sheets, command palette, alerts |

Concentric corners: an inner radius equals the outer radius minus the padding.
Printed paper retains its existing geometry.

### Spacing and controls

Base 8px. New UI uses the scale **8 / 16 / 24 / 32 / 48 / 64**.
(Legacy layouts predate this scale — migrate opportunistically when touching them,
don't churn otherwise.)

Controls: desktop 32 px regular / 26 px small (`--control-h`, `--control-h-sm`);
iOS 44 px / 36 px. Every hit region is at least 44 pt on touch. Sidebar 220 px with
32 px rows; toolbar 52 px. Cards use 20–24 px padding and 16 px gaps; grouped lists
use 12–16 px row padding with inset hairline separators. Primary page actions stay in
the toolbar (trailing), one prominent `.btn-primary` per view; modal and Settings
saves stay in their footers with Cancel leading and the default action trailing.
Toggles: macOS uses a checkbox (`accent-color`) for a single attestation and the
`.toggle` switch (30 × 18) for emphasised settings rows; iOS renders attestation
rows as 51 × 31 switch rows and uses switches only inside rows.

### Icons

Outline only, stroke 2px (SF Symbols medium weight), rounded caps/joins (the `ic()` / `ICONS` system in
`billing.html` — add new icons there, same style). No filled icons except the logo.

The owner approved a complete icon refresh on 2026-10-03. Use the bundled
BillNgai rounded outline family on a 24px grid, with balanced inset geometry
and the same 2px stroke at every size. Navigation, actions, statuses, search,
close controls, field hints and swatch checks share `ICONS`; no font glyphs or
raster illustrations for these controls. Selected navigation icons inherit
`--on-accent` from the existing orange selected row. Keep status labels
and accessible control names. Fine-pointer hover may lift button/navigation icons
by 1px over 200ms ease-out; reduced motion disables it. No looping icon motion.

### In-app decorative illustrations — owner revision 2026-10-03

The owner approved a starter set of matte 3D-style objects for the app's empty
Documents / Dashboard and Clients states, plus the first setup-wizard step.
Use bundled local PNG renders: invoice stack, contact cards, freelancer desk.
Keep orange, ivory and charcoal, consistent gentle isometric lighting, and a
white image background on white surfaces. No embedded labels or financial figures.
The owner requested complete in-app illustration replacement on 2026-10-03.
All decorative images now use this family: invoice stack, contact cards,
freelancer desk, certificate envelope and document folder. Dashboard promotional
art and income-summary empty states reuse the desk; WHT uses the envelope;
recurring and historical-review empty states use the folder. The runtime registry
and packaged file list must contain no former character/object illustration paths.
Archived source artwork is retained outside the shipped asset list.

The marketing illustration guidance below remains unchanged. The approved logo and printed documents retain their styles; app controls use
the coordinated outline icon family above.

Decorative art may enter once over 240ms with up to 8px movement, and lift/tilt
slightly on fine-pointer hover over 200ms. No persistent loops, bounce or spin.
Disable these animations and transforms under prefers-reduced-motion. This finite
entrance is an explicit exception to the general ~200ms animation guidance.

### Task and panel motion — owner revision 2026-10-03

Confirmed document saves/issuance, manual payment recording, native PDF exports
and desktop backups may display a compact paper/check or folder/document/check
illustration inside the existing status toast. Trigger only after the operation
confirms success; never on cancellation, failed persistence, startup or automatic
background work. Payment feedback means the user's record was saved, not bank
verification. Browser download initiation cannot confirm file completion and gets
no completion artwork. Preserve message text, live-region semantics and undo actions.

Use the local outline SVG family with 200ms ease-out settling/check movement;
no loops, bounce, blocking overlays or animated financial amounts. Navigation,
Settings tabs, wizard steps and optional detail panels may reveal over 200ms with
up to 4px vertical movement. Preserve focus, controls and layout. Reduced motion
keeps static outcome artwork and text, and disables these animations/transitions.
Existing setup clay artwork retains its approved single entrance.

### Animation

Fast: ~200ms, ease-out. No bounce, no spinning loaders — prefer skeleton loading.
Use ease-out; avoid bouncing or counting financial amounts through intermediate values.

---

## In-app audio — owner revision 2026-10-03 (removed in 2.0.15)

> Removed by PRD-SIMPLIFY-2026-10 §2: no voice guides, sound effects, audio assets or Sounds
> tab remain in any build. Feedback is visual only. The rules below are kept as history.

Use the approved female Onnie Thai voice only. Six bundled Thai guides provide
optional, contextual help with visible translated transcripts. English UI labels
must explicitly say that spoken audio is Thai. Never autoplay a guide. Stop it
when its section closes, the modal closes, or the screen changes. One clip at a
time; effects must not interrupt a voice explanation.

Task effects are off by default, with a device-local preference and explicit
preview controls in Settings → Sounds. Use the approved original
issued/payment/export cues and a gentle attention cue on explicit failed actions.
Play completion sounds only after persistence/export confirms success. Manual
payment recording never means bank verification. Owner-approved tiny taps acknowledge
intentional button, summary and toggle activation (including keyboard use), using
the same opt-in switch. Throttle rapid clicks; skip disabled/programmatic clicks,
audio controls and actions with their own completion cue. Taps never interrupt
voice or another cue. Keep typing, scrolling, autosave, startup and background sync
quiet. Playback failure must never change or block financial work. Bundle local files; no runtime ElevenLabs calls.

## Voice & copy

Thai-first, plain and human. Existing Thai copy is written naturally — **never
machine-translate it, never rewrite it into officialese.**

Say (style, not literal strings): สร้างบิล · ส่งบิล · รับเงิน · เสร็จแล้ว
Avoid: ดำเนินการออกเอกสารทางการเงิน-style jargon, "Generate Invoice",
"Receivable", "Financial Statement" vocabulary.

- Max ~12 words per sentence in new copy. Active voice. No exclamation marks.
- Every user-facing string goes through `tr()` with a Thai key + `I18N_EN` entry
  (see CLAUDE.md). Printed documents use `L(th,en)` pairs and keep their formal
  legal-document register — tone rules apply to the app UI, not tax paperwork.

---

## Documents (the printed paper)

- Paper stays white with neutral grays (intentional print neutrals in `.paper` CSS).
- Paper-scoped accents follow the seller’s saved color (orange by default), including frozen issued snapshots. The app palette never replaces that color.
- ใบกำกับภาษี rules in CLAUDE.md still apply (never English-only, etc.).

---

## Illustration & imagery (marketing, store, Canva)

Style: hand-drawn, rough outlines, minimal shading, off-white background,
orange accent, friendly characters. Inspired by old Dropbox, Notion, Linear,
Pablo Stanley. No gradients, no 3D, no glossy effects.

Photos: warm, human, real freelancers, coffee shops, small businesses.
Never: corporate stock photos, skyscrapers, people in suits, blue backgrounds.

---

## AI instructions

Whenever generating UI or assets:

1. Check the request against this guide **before** writing code.
2. Follow an explicit owner design revision, then update this guide to record it.
   Otherwise keep generated UI within this contract.
3. Never invent another design language.
4. Always reuse existing components/classes (`.btn`, `.banner`, `.card-block`,
   `.pill-select`, `.mini-stats`, the modal pattern, `.chart-card`) before
   creating new ones.
5. If unsure, choose the simplest solution.

Agent behavior rules: see `AGENTS.md`. Architecture & verification: see `CLAUDE.md`.


## Native mobile accessibility presentation

The existing orange accent and warm cream background remain unchanged. Native
text preferences enlarge the readable baseline without changing financial data.
`--mobile-text-scale` follows iOS body text metrics, with a baseline of 1 and an
upper defensive limit of 4. `--mobile-inline-font-size` retains authored UI sizes
before scaling. `--mobile-nav-height` measures the phone bottom bar; it is zero
for the tablet sidebar. Larger text reflows item cards and allows the whole dialog
to scroll so fields and actions remain reachable. Reduce Motion suppresses animated
feedback while retaining its text status. These rules apply to screen presentation
only. The document preview keeps a fixed A4-width layout with uniform viewport
scaling; it never becomes item cards or enlarged/wrapped paper type. Native PDFKit
opens the actual print PDF for zoom/share. Canonical print and frozen snapshots
retain their approved layout. Navigation labels stay short, with compact text
scaling; financial/form content follows the full native text preference.

Native mobile omits built-in voice guides and SFX (including audio assets and
the Sounds settings tab). OS VoiceOver, accessible icon labels and live feedback
remain supported. Use familiar icons for utility actions, retain visible words
on Save/Issue/destructive actions, and disclose optional contact/default fields
without disconnecting them from draft recovery.

At native accessibility text sizes, dashboard balance figures retain the existing
28–44px container-responsive range so the complete amount fits its card. Labels
and forms still follow the full native preference; very long figures wrap instead
of being cropped. This exception affects screen figures only, never print/PDF.
