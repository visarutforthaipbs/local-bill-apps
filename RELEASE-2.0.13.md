# BillNgai 2.0.13 desktop release candidate

Owner authorized desktop publication before mobile sync work on 2026-10-03.
Base: public 2.0.12 checkout commit c303ac33a05f91a438ac4c4beb52c79bc3db79bb.
The clay UI was ported from the development checkout; production main.js,
preload.js and lib/*.cjs remain unchanged. Mobile and MAS are separate channels.

## Scope and validation

Folded-paper b icon, five local clay illustrations, coordinated outline icons,
reduced-motion support, optional local Sounds/Thai guides with transcripts.
App orange/cream palette and frozen document branding are retained.
Windows packaging retains the existing per-user unsigned-beta policy.

264 automated tests pass. Source native checks pass for storage/recovery,
first-use quotation/invoice/payment/receipt, layout/translation, A4 PDF,
sync conflict UI and offline audio. Tests use isolated synthetic profiles.
A renamed icon button required a smoke selector update; monetary assertions
remain intact. Windows failure injection uses a portable path basename.

Installer signing, notarization, packaged checks and publication evidence are
pending; this file does not claim either installer is live.
