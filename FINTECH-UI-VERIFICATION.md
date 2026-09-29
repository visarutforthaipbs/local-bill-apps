# Modern fintech UI — source verification

2026-09-29 · Owner-authorized style refactor · Unreleased, package version remains 2.0.8

## Before and after

The prior interface relied on compact rows, small money figures, small-radius
controls and warm cream/orange. Financial and supporting information competed
for attention. The approved direction uses the original warm cream light canvas, original orange accents,
larger figures and spacious cards while preserving the six-destination workflow.

- Light canvas `#FFF9F3`, fixed under both OS color preferences; `#FF6B00` accent with dark
  `#231307` foreground. Dark mode follows OS preference, without another app setting.
- Cards 20px, dialogs 24px, inputs 12px, pill buttons 999px; 24px card padding,
  16px gaps, flat borders and restrained floating-action shadows.
- Dashboard received income comes first. Primary figures use bold 28–44px,
  card amounts 24px, supporting labels at least 12px.
- Documents and withholding records use cards. Document number, type, customer,
  project, date, milestone, gross/net values, status and quick actions remain.
  Open buttons and action buttons are separate keyboard-accessible controls.
- Primary page actions float at lower right, with content bottom clearance.
  Settings and modal saves use their own sticky footers. Narrow layouts stack cards.
- Accounting comparison tables stay inside their relevant surfaces; invoice paper
  retains its original layout and seller color. No React/Flutter/framework dependency.

`BRAND.md` and `AGENTS.md` now record the explicit owner revision, which supersedes
old cream/small-radius app rules. The existing product logo is retained.
`applyTheme()` now updates document-brand preview tokens rather than recoloring
application controls. The brand setting describes that behavior. `.paper` has its
own light palette/radii; frozen document snapshots continue to determine branding.
No financial calculations, storage schemas, migration decisions or historical
review answers changed in this style refactor. Earlier uncommitted audit fixes
and the English-address field correction are preserved.

## Checks

- **195/195 unit tests passed.** Two crafted-ID regression tests now target the new
  card button instead of a table row; their injection-safety assertions remain.
- **Six source desktop smoke tests passed:** fintech UI, audit design fixes,
  legacy review, payment matching, stabilization, and Option A.
- New fintech harness: 40 route states across Thai/English and light/dark; app
  overflow checks at 1440/940/600px; card keyboard navigation; floating CTA;
  matching Thai/English address styles; unchanged document/review content and income.
- Orange CTA text contrast is **6.30:1** in both themes. This is the tested primary
  control contrast, not a claim of complete WCAG certification.
- Issued document paper remains white with its frozen orange seller brand in
  both themes and after previewing a different current business color. PDF output
  succeeds. Existing stabilization smoke also exercises frozen paper and PDF.
- Inline script syntax and `git diff --check` passed. The design smoke validates
  translation keys and the earlier recovery/financial safeguards.
- Visually inspected light dashboard, dark document cards and expanded English
  address Settings. Synthetic screenshots cover the other routes and narrow modes.

Evidence: `review/2026-09-29/fintech/` contains test logs, screenshots, contrast
results, a synthetic invoice PDF, source hashes, and a diff against the pre-restyle
working file (so earlier audit fixes remain distinguishable).

## Delegation and boundary

The MiMo worker received only selected app CSS and instructions. Its bounded
180-second attempt timed out with no model response or changed files; stderr
reported `unrecognized_model` for the requested `mimo-v2.6-pro`. Codex rejected
the empty result and implemented/reviewed the UI locally. Worker record:
`/Users/lighthouse-control/.local/state/mimo-worker/20260929-144954-8tkc0h4c/`.
No customer records were sent to the worker.

This is source-only work: no commit, package build, signing, installation or
publication. Native tests use isolated synthetic profiles. Any owner-data preview
uses a separately verified copy; it does not replace the live profile.

## Owner color correction

The owner requested keeping the original main color after the first preview.
Restored `#FF6B00`, with readable dark foreground and orange text variants for
light/dark mode. Card layout, typography, spacing and document branding are
unchanged. Contrast checks were rerun for the CTA and accent text in both themes.
The earlier native screenshots/logs above describe the initial lime preview;
the color correction changes only tokens, documentation and the theme assertion.

The owner also requested the original main background: light-mode `--bg` is
restored to `#FFF9F3`. Earlier native screenshots precede this token correction.
Card layout and dark-mode tokens are unchanged.

## Background correction for dark OS preference

Removed the automatic dark-mode override: the app now retains `#FFF9F3` cream
and the orange accent even when macOS requests dark mode. Earlier screenshots
showing dark surfaces are historical and no longer represent current behavior.

## Compact document follow-up

The owner approved compact document rows and moving primary actions into the
page header. These supersede the earlier floating CTA and main document-card
layout. See `review/2026-09-29/compact-documents/VERIFICATION.md` for current
validation and screenshots. Dashboard and WHT retain cards.
