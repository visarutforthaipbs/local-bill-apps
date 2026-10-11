# AI Development Rules — BillNgai

Read `BRAND.md` before writing ANY UI, style, icon, or copy. If generated UI
conflicts with BRAND.md, BRAND.md wins.

This is a vanilla-JS, single-file Electron app (`billing.html`) — there is no
React, no Tailwind, no bundler, no build step. Do not introduce them.

## Rules

- Current product scope (since 2026-10-09): App Store only, non-VAT ordinary receipts, no AI/sounds/licence screens/e-Tax. Do not reintroduce removed features or copy. Installment invoices get receipts per paid installment (2.1.0).
- After any change to `billing.html` or `mobile/web/*`, build AND launch the iOS simulator app (`cd mobile && npm run build:simulator`, then run it): a successful compile does not prove the iPhone host still boots.
- Fonts: keep `"LINE Seed Sans TH"` first in `--font` with the Thai `unicode-range` in `fonts/fonts.css`; otherwise iOS renders Thai in the system font.
- Never run tests or scripts against the owner's real profile (`~/Library/Application Support/BillNgai`, `~/Library/Containers/com.visarut.billngai`); copy it to a scratch profile first.

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

- `HANDOFF-2026-10-12.md` — **latest checkpoint**: 2.1.0 shipped line, App Review state, data folders, keys, release commands, open items. Read it before anything else.
- `PRD-SIMPLIFY-2026-10.md`, `PRD-INSTALLMENTS.md` — the two plans behind 2.1.0; `review/2026-10-10/SIMPLIFY-VERIFICATION.md` — gates that passed.
- `scripts/asc/` — App Store Connect API scripts. Keys live only in `~/.private_keys`; never commit, print or paste a `.p8`.
- `../handoff.md` — older development checkpoint and sync v3 continuation (historical).

- `INSTALL-2.0.12.md` — latest release (Google Drive sync for Pro); `INSTALL-2.0.11.md` — clean PDF output; `INSTALL-2.0.10.md` — previous private direct-macOS release, artifact verification, cleanup and rollback.

- `RELEASE-2.0.4.md` and `SESSION-HANDOFF-2.0.4.md` — current authorized release
  continuation and stabilization/recovery evidence. Check actual publication state.
- `SESSION-HANDOFF-2.0.3.md` — read first when resuming the September 2026 work:
  released Direct macOS evidence, completed checks, pending other channels and safe next steps.
- `BRAND.md` — visual identity, tokens, voice (the brand guardian; it wins).
- `CLAUDE.md` — architecture, i18n system, release routine, how to verify
  changes (extract-script syntax check, i18n cross-check, localhost drive).
