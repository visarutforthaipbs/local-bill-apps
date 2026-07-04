# AI Development Rules — BillNgai

Read `BRAND.md` before writing ANY UI, style, icon, or copy. If generated UI
conflicts with BRAND.md, BRAND.md wins.

This is a vanilla-JS, single-file Electron app (`billing.html`) — there is no
React, no Tailwind, no bundler, no build step. Do not introduce them.

## Rules

- Design tokens live in the `:root` block of `billing.html`. **Never hardcode
  hex colors, radii, or shadows in new code** — use `var(--…)`. If a token is
  missing, add it to `:root` and document it in BRAND.md.
- Never create new colors, typography, or spacing outside the BRAND.md scale.
- Always reuse existing components/classes before creating new ones:
  `.btn` (+ `btn-primary` / `btn-sm` / `btn-danger` / `btn-ghost`), `.banner`,
  `.card-block`, `.pill-select`, `.mini-stats`, `.chart-card`, the
  `#modal` + `openModal()`/`closeModal()` dialog pattern, `ic()` icons.
- Every user-facing string: `tr('ไทย…')` with an `I18N_EN` entry. Never name a
  translation helper `t`. Documents render via `L(th,en)` pairs, not `tr()`.
- Accessibility: keep text on `--accent` white/cream and ≥ 4.5:1 where feasible;
  never color as the only signal (badges pair color with a label).
- Prefer composition over duplication; prefer the simplest solution.
- Every screen should feel like Linear or Stripe, but warmer and more human.

## Cross-references

- `BRAND.md` — visual identity, tokens, voice (the brand guardian; it wins).
- `CLAUDE.md` — architecture, i18n system, release routine, how to verify
  changes (extract-script syntax check, i18n cross-check, localhost drive).
