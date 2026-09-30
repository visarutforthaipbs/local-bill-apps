# BillNgai (บิลง่าย) Brand Identity

This document is the single source of truth for every UI change, icon, animation,
document template, and marketing asset in this project.

**If a generated component conflicts with this document, THIS DOCUMENT WINS.**
Explicit owner requests can revise this contract. The owner approved the fintech UI direction below on 2026-09-29.

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

## Design tokens — Modern Fintech / Neobanking

The owner approved a minimalist fintech layout, then explicitly retained the
original BillNgai orange and warm cream light canvas. Use white cards, orange accents, generous
rounded cards, large money figures and pill actions. Lime is not the app accent.
This supersedes the older small-radius and app-wide corporate-color rules. Keep the 37signals workflow principles above.
No framework or dependency is needed for this style change.

Tokens live in `:root` in `billing.html`. New components use these tokens.

| Token | Value | Role |
|---|---|---|
| `--bg` | `#FFF9F3` | App canvas |
| `--surface` | `#FFFFFF` | Cards and dialogs |
| `--surface-2` | `#F2F4F5` | Form controls |
| `--surface-3` | `#E8ECEF` | Secondary surfaces |
| `--text` | `#141A22` | Primary text and amounts |
| `--text-dim` | `#485360` | Secondary labels |
| `--text-faint` | `#596572` | Supporting text, still readable |
| `--accent` / `--accent-fill` | `#FF6B00` | Primary actions and received-income highlight |
| `--on-accent` | `#231307` | Dark text on orange fills |
| `--accent-ink` | `#A84400` | Readable accent text/focus on neutral surfaces |
| `--border` / `--border-soft` | `#DDE2E6` / `#ECF0F2` | Flat card and internal borders |

The app keeps this light palette under both light and dark OS preferences.

Semantic green, red, amber and blue tokens retain their meaning. `--on-danger` provides contrast on solid destructive buttons. Color
never replaces status text. Use restrained derived accent tints; no gradients,
glass effects, textured canvas, or heavy shadows.

The fixed app palette is independent of `DB.business.brandColor`. That field
continues to control the seller's document color and its preview through
`--document-accent` / `--document-accent-ink`. Issued snapshots keep their frozen
brand. `.paper` defines its own light palette and original radius values, so OS
dark mode and the app restyle do not change invoice/PDF appearance.

Color settings use circular 32px preset swatches inside fixed 48px targets,
with a checkmark and `aria-pressed` selection. The custom picker is a square
48px control with the input-radius token; the HEX field uses the shared field style.
Saved seller colors, including the former green default, must survive reload.

The existing orange BillNgai logo remains the product mark; this change does
not replace installed icons or marketing artwork.

### Typography

- English: **Inter** · Thai: **LINE Seed Sans TH** (both bundled in `fonts/`, offline).
- Weights: Regular (400), Semibold (600, Inter only), Bold (700). Main money figures use 700 at 28–44px; card amounts use 24px and compact document-row amounts use 18px. Labels stay at least 12px. **Never thin/light fonts.**
- `--font` is the only family stack; `--font-display` is the same stack at display weight.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 12px | Inputs and compact controls |
| `--radius` | 20px | Cards and panels |
| `--radius-lg` | 24px | Dialogs / modals |
| `--radius-pill` | 999px | Buttons, tabs, navigation |

Cards stay within 16–24px. Use token radii, not ad-hoc values. Printed paper retains its existing geometry.

### Spacing

Base 8px. New UI uses the scale **8 / 16 / 24 / 32 / 48 / 64**.
(Legacy layouts predate this scale — migrate opportunistically when touching them,
don't churn otherwise.)

Cards use 24px padding and 16px gaps. The main Documents page uses aligned rows
with 16px padding inside a rounded panel; narrow windows stack each row. Dashboard
and WHT lists retain cards. Each document has a keyboard-accessible open button
and separate actions. Keep dense accounting tables inside their relevant cards
when tabular comparison matters. Primary page actions stay in the page header,
which wraps at narrow widths; modal and Settings save actions stay in their footers.

### Icons

Outline only, stroke 2.5px, rounded caps/joins (the `ic()` / `ICONS` system in
`billing.html` — add new icons there, same style). No filled icons except the logo.

### Animation

Fast: ~200ms, ease-out. No bounce, no spinning loaders — prefer skeleton loading.
Use ease-out; avoid bouncing or counting financial amounts through intermediate values.

---

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
