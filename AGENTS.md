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
- Accessibility: use `--on-accent` dark text on orange and maintain ≥ 4.5:1;
  never color as the only signal (badges pair color with a label).
- Prefer composition over duplication; prefer the simplest solution.
- Follow the 37signals product principles in BRAND.md: one clear job, achievable
  next actions, recoverable work, and contextual optional detail. Keep the existing
  approved fintech visual identity and reusable components.

## Cross-references

- `../handoff.md` — latest development checkpoint and sync v3 continuation.

- `INSTALL-2.0.12.md` — latest release (Google Drive sync for Pro); `INSTALL-2.0.11.md` — clean PDF output; `INSTALL-2.0.10.md` — previous private direct-macOS release, artifact verification, cleanup and rollback.

- `RELEASE-2.0.4.md` and `SESSION-HANDOFF-2.0.4.md` — current authorized release
  continuation and stabilization/recovery evidence. Check actual publication state.
- `SESSION-HANDOFF-2.0.3.md` — read first when resuming the September 2026 work:
  released Direct macOS evidence, completed checks, pending other channels and safe next steps.
- `BRAND.md` — visual identity, tokens, voice (the brand guardian; it wins).
- `CLAUDE.md` — architecture, i18n system, release routine, how to verify
  changes (extract-script syntax check, i18n cross-check, localhost drive).
