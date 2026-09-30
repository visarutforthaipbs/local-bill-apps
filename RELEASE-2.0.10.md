# BillNgai 2.0.10 — private macOS release

Released locally on 2026-09-30. [Installation and verification](INSTALL-2.0.10.md) records the source commit, notarization, installer checksum, tests, cleanup and rollback. Public downloads remain at 2.0.4. This build is the candidate for the next public release once the website, Pro offer and source-hosting decisions are made.

## Changes

- Setup asks for your VAT status, and the first receipt asks for it in place instead of stopping — no trip to Settings.
- When a document can't be issued yet, one checklist shows everything missing, each with a way to fix it.
- Unit prices keep two decimals, so printed lines always add up.
- The dashboard shows withholding tax still waiting for 50 ทวิ certificates after you're paid.
- Tax-ID check in setup; a warning before issuing an invoice with no payment details; the payment dialog shows the amount due.
- Seller color presets are round, accessible targets with HEX validation; Local is described as free.

Universal macOS 12+ installer, signed and notarized. New VAT invoices, e-Tax XML and cloud sync remain paused. No public deployment, Windows build or App Store submission.
