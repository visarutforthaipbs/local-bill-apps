# BillNgai (บิลง่าย) Brand Identity

This document is the single source of truth for every UI change, icon, animation,
document template, and marketing asset in this project.

**If a generated component conflicts with this document, THIS DOCUMENT WINS.**
Never invent another style.

Positioning line (for store copy / marketing, not in-app):
> The billing and tax app built for Thai freelancers — not a global SaaS
> translated into Thai. Your data stays on your machine.

---

## Brand personality

BillNgai feels like:

✓ Fast · ✓ Human · ✓ Friendly · ✓ Trustworthy · ✓ Minimal

NOT:

✗ Corporate · ✗ Banking · ✗ Enterprise ERP · ✗ Overly playful · ✗ Gamified

Every screen should communicate: **less work, less friction, more speed, more confidence.**

---

## Design tokens

Tokens live in the `:root` block of `billing.html` — that IS the design-token file
(this app is vanilla JS; there is no Tailwind/JS token module).
Never hardcode a color, radius, or shadow in new code — use `var(--…)`.
If a token is genuinely missing, add it to `:root` AND document it here.

### Color

| Token | Value | Use for | Never for |
|---|---|---|---|
| `--accent` | `#FF6B00` | FILLS: buttons, primary CTA, active states, table heads, bars | Text on light backgrounds |
| `--accent-ink` | derived (accent + 30% black) | TEXT in the brand color on light/white backgrounds (doc titles, totals, links, amounts) — #FF6B00 text on white is only 2.9:1 contrast and fades on B/W printing | Fills |
| `--accent-fill` | derived (accent darkened just enough for white text ≥ 4.5:1 — computed by `applyTheme()`; default orange → `#C45200`) | FILLS that carry white text: primary buttons, selected pills, nav badges, active steps | Decorative fills without text (bars, dots, rules keep `--accent`) |
| `--text` | `#2D3436` | Body text (charcoal) | |
| `--bg` | `#FFF9F3` | App background (warm cream) | |
| `--surface` / `-2` / `-3` | white → warm ramp | Cards, panels, inputs | |
| `--green` / `--green-bg` | green | **Paid / completed / approved ONLY** | Branding, decoration |
| `--red` / `--red-bg` | red | **Errors / overdue ONLY** | Emphasis |
| `--amber` / `--amber-bg` | amber | Reminders / warnings | |
| `--blue` / `--blue-bg` | muted blue | Informational notes only | Buttons — **never blue buttons** |
| `--text-dim` / `--text-faint` | warm greys | Secondary and hint text — both keep ≥ 4.5:1 on `--bg`, `--surface`, `--surface-2` | Changing them below AA contrast |
| `--red-bd` / `--blue-bd` / `--amber-bd` | borders | Borders of `.banner.danger` / `.banner.info` / default `.banner` and matching badges | Fills |

All accent tints (`--accent-bright`, `--accent-tint`, `--accent-soft`, …) are
derived from `--accent` via `color-mix` — never set them directly.
Users may override the accent per-business (`DB.business.brandColor`); the
default is the brand orange.

Hard rules:
- Brand-orange **text** on light backgrounds always uses `--accent-ink`, never raw `--accent`.
- White text on a brand fill uses `--accent-fill` (AA contrast for any user brand color); raw `--accent` stays for
  text-free fills — bars, dots, header rules, switches.
- **Never** blue buttons. **Never** gradients. **Never** glassmorphism.
- **Never** neon. **Never** colors outside the tokens above.
- Status banners use classes, not inline colors: `.banner` (reminder, amber), `.banner.info` (blue), `.banner.danger` (red).
- Thai text is never set in uppercase or with extra letter-spacing (Thai has no case; tracking splits vowel/tone marks). App UI text stays ≥ 12px.
- The logo (`logo.svg`) keeps its own orange `#FC4C02` — do not "correct" it to `--accent`.

### Typography

- English: **Inter** · Thai: **LINE Seed Sans TH** (both bundled in `fonts/`, offline).
- Weights: Regular (400), Semibold (600, Inter only), Bold (700). **Never thin/light fonts.**
- `--font` is the only family stack; `--font-display` is the same stack at display weight.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Buttons, inputs |
| `--radius` | 8px | Cards, panels |
| `--radius-lg` | 12px | Dialogs / modals |

No new ad-hoc radii.

### Spacing

Base 8px. New UI uses the scale **8 / 16 / 24 / 32 / 48 / 64**.
(Legacy layouts predate this scale — migrate opportunistically when touching them,
don't churn otherwise.)

### Icons

Outline only, stroke 2.5px, rounded caps/joins (the `ic()` / `ICONS` system in
`billing.html` — add new icons there, same style). No filled icons except the logo.

### Animation

Fast: ~200ms, ease-out. No bounce, no spinning loaders — prefer skeleton loading.
Existing `--spring` easing is acceptable for micro-interactions.

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
- The accent (header rule, table head, totals) follows `--accent` → brand orange
  by default, user-overridable.
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
2. If a request violates the guide, politely explain why, then produce the
   closest compliant solution.
3. Never invent another design language.
4. Always reuse existing components/classes (`.btn`, `.banner`, `.card-block`,
   `.pill-select`, `.mini-stats`, the modal pattern, `.chart-card`) before
   creating new ones.
5. If unsure, choose the simplest solution.

Agent behavior rules: see `AGENTS.md`. Architecture & verification: see `CLAUDE.md`.
