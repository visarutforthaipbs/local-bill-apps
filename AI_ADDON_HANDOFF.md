# BillNgai Offline AI Add-on — archived

The local AI add-on ("TOR → Invoice") was removed from the app in 2.0.15 as part of the
simplification plan; see `PRD-SIMPLIFY-2026-10.md` §2 ("Local AI add-on") and `CHANGELOG.md`.

- No code path in `billing.html`, `main.js` or `preload.js` references the add-on any more.
- Profiles that still carry add-on fields keep loading; `migrate()` ignores unknown keys.
- Add-on folders already installed on disk (`~/Library/Application Support/BillNgai/ai`,
  `/Library/Application Support/BillNgai/ai`) are never deleted by the app; users may remove them by hand.
- The Ed25519 key pair that signed add-ons still signs Pro licence keys for the final direct build
  (`LICENSE_PUBLIC_KEY` in `main.js`, `scripts/make-license.js`); it is retired with that build (PRD §4.2).

The original handoff text remains in the repository history before the 2.0.15 removal commit.
