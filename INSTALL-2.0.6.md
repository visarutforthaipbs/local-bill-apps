# Owner-directed 2.0.6 installation

2026-09-24: owner authorizes replacing installed private 2.0.5 with the update
fixing the misleading dashboard and including the bulk correction-review screen.
Retain old app and full current profile for rollback; do not permanently delete
them. This authorizes local installation, not public publication or accepting
customer payment matches/correction proposals on the owner's behalf.

Dashboard now shows an incomplete received total when ambiguous groups exist,
plus provisional historical amounts from eligible pairs only. Eligibility requires
one paid invoice and one issued receipt linked by parent/client, exact matching
amounts/date, THB, zero VAT, no deletion/void/conflict/installment/payment identity.
User selects and explicitly confirms each pair is one payment, adds a note, then
the app backs up and appends payment_match source snapshots. Reporting counts
the selected representative once; changed group membership/source invalidates the
match. No original document, payment ID, issuance snapshot or tax validity is altered.
Deleted and conflicting records remain visible for individual review and are not
silently discarded or automatically accepted. Current data has not been matched.

182 automated tests pass. Isolated payment UI native smoke passes backup/save/reload,
one-payment reporting and retained tax-output restrictions (`billngai-payment-match-HtRmOR`).
Actual restored database copy passes isolated source-runtime preservation test:
44 client records / 78 document entries / 47 non-deleted documents / 12 deletion
markers (`billngai-recovery-check-NYRUBw`). Customer data stays local.

Signed/notarized packaging, exact packaged tests, rollback capture and installation
are pending. Record real completion below. Public version stays 2.0.4.
