# Mobile UI / UX audit — 2026-10-03

The screenshot defects were reproduced in the native iOS host and fixed. The
previous checkpoint checked the document list and a financial fixture; it did
**not** establish that all phone forms or document previews were usable. This
audit expands that coverage. It is not an App Store readiness sign-off.

## Review scope

Three parallel reviewers covered phone forms, document preview/print separation,
and navigation/workflow/capability honesty. Codex reproduced their findings,
implemented the accepted changes, reviewed the resulting source and tested it in
native WebKit. The requested MiMo Pro review returned partial observations but
failed to read its complete packet after mistyping an allowlisted path; it was
rejected as a completed review. No worker patch or alternative model was accepted.

Only `mobile/` source and this audit's documentation were changed. The shared
`billing.html` SHA-256 remains
`459c7c1792270d0d56dd7a025760c7ac07b1a08567813a9c072a1071f8aef018`.
Financial calculations, issued snapshots and canonical A4 document content were
preserved. Existing orange/cream tokens and reusable controls remain the design
system. No installed customer profile, credentials, release identity, SKU,
deployment or App Store submission was changed.

## Findings addressed

| Priority | Defect and user impact | Accepted correction |
| --- | --- | --- |
| P1 | Client form body exceeded the rounded modal; category/notes appeared on the overlay. | Modal is a bounded flex column with its own scrolling body and contained header/footer. |
| P1 | Paper table clipped amounts; bilingual total labels collided. The old `.paper-wrap` rule did not match the real DOM. | Wrap only live previews, reflow narrow previews into labeled item cards, and separate totals. A4 print and measurement clones keep their canonical layout. |
| P1 | Recurring item fields lost their headings on phones; split-payment table kept desktop column widths. | Both editors have visible field labels and contextual accessible names; split installments stack into cards. |
| P1 | Recurring/report tables widened the whole page. | Wide tables have their own labeled, focusable scrolling region; narrow tables still fit normally. |
| P2 | iPad content was squeezed beside its navigation; long titles/identities could overflow. | Content-width container rules stack report cards and paper layouts where needed; long identity/signature strings wrap. |
| P2 | Settings logo/signature/stamp controls overflowed once assets were populated. | Asset columns stack at narrow content widths and actions wrap. Tested with populated synthetic assets. |
| P2 | Native date inputs extended 34px beyond their fields. | Remove WebKit's intrinsic date-control appearance and enforce border-box sizing; preserve `type=date` and the shared date-preview text. |
| P2 | The keyboard could hide Notes, its label and editing actions. | Use the visual viewport for the overlay; observe form resizing and reveal the active field group. During editing in a short viewport, the optional destructive footer action is deferred until focus/space returns. |
| P2 | Close/delete/item/menu/tab targets were too small. | Affected mobile controls use at least 48px hit areas; tested visible buttons meet the 44-point audit floor. |
| P2 | Bottom navigation remained accessible behind a modal; email/phone fields used generic keyboards. | Navigation mirrors modal inert state; labels are associated with controls and contact/tax fields get appropriate input types/modes. |
| P2 | Backup history used incorrect native metadata and asynchronously exposed unsupported Restore buttons. | Adapt dates/byte counts, ignore stale async renders, show truthful on-device copies plus JSON export, and hide unsupported restore/import/location actions. |
| P2 | Bilingual document heading contrast was weak; repeated help displaced the paper. | Reading-view table headings use existing accent tint/ink tokens; the help guide follows the document. |
| P2 | A landscape phone could select the iPad sidebar; secondary destinations had no active navigation indication. | Short viewports retain phone navigation, and secondary destinations highlight More. Landscape behavior has source review only, pending native rotation testing. |

The changes are in [mobile.css](web/mobile.css), [mobile-ui.js](web/mobile-ui.js)
and [mobile-bridge.js](web/mobile-bridge.js). The DEBUG harness waits for the
renderer to be ready, avoiding the earlier startup race.

## Native verification

| Dedicated synthetic simulator | Portrait viewport | Coverage |
| --- | --- | --- |
| iPhone 17 Pro — UI Audit Phone | 402 × 874 | 18 screens × Thai/English = 36 cases |
| iPhone SE 3 — UI Audit Small Phone | 375 × 667 | Same 36 cases; two software-keyboard cases |
| iPad Pro 11 M5 — UI Audit Tablet | 834 × 1210 | Same 36 cases |
| iPhone 17 Pro — UI Audit Finance | 402 × 874 | Two software-keyboard cases and financial/relaunch fixture |

**112 recorded cases pass:** 108 screen cases plus four real software-keyboard
cases. This combines the expanded matrix with targeted retests after fixes; it
is not represented as one uninterrupted run. The two background/hardware-keyboard
phone attempts that did not open a software keyboard were not counted as passes.
The audit uses the anchored overlay for keyboard bounds: native WebKit's root
scroll/visual viewport offset and element rectangles can have different origins.

Screens: client editor, document editor, recurring editor, split installments,
receipt, long bilingual receipt, long English invoice, long Thai quotation,
corrected-receipt preview modal, nested confirmation, Home, Documents, Clients,
More, Settings data/business, income report and withholding. Long fixtures include
six items, large values, unbroken identifiers/names, notes, banking and QR content.

Checks cover whole-page/control/table overflow, modal body/footer containment,
total collisions, item labels, visible button sizes, background navigation and
unsupported native actions. They do not claim exhaustive copy/contrast or assistive
technology coverage. Long document **screen** cases do not establish long-PDF
pagination.

Additional checks passed:

- Seven bridge/packaging tests, 26 native storage assertions and 33 unchanged
  shared financial tests.
- Synthetic invoice → payment → receipt produces two documents, one net-income
  item of ฿970 and native rejection of issued-record edits; backups exist.
- Termination/relaunch preserves issued records and recovers an unfinished
  quotation edit. This is document recovery, not client/recurring form recovery.
- Each portrait device exports the fixture as a one-page A4 ordinary receipt:
  ฿1,000 gross, ฿30 withholding, ฿970 net. Stored snapshot HTML remains unchanged.
  Native PDF rendering was visually inspected.
- Normal Debug simulator and unsigned Release device builds compile. Normal web
  and native bundles exclude both QA scripts. No distributable signed IPA implied.
- The normal bundle was installed and launched on UI Audit Phone; its synthetic
  [Home view](review/ui-audit/normal-phone-home.png) was observed. This preview
  remains available; the other newly created audit simulators are shut down with
  their synthetic profiles retained. Earlier QA simulators were not modified.

Evidence: [case matrix with source hashes](review/ui-audit/matrix.json),
[client before](review/ui-audit/client-before.png),
[client after](review/ui-audit/phone-en-client.png),
[receipt before](review/ui-audit/receipt-before.png),
[receipt after](review/ui-audit/phone-en-receipt.png),
[small-phone keyboard](review/ui-audit/small-en-clientKeyboard.png),
[larger-phone keyboard](review/ui-audit/keyboard-en-clientKeyboard.png),
[A4 receipt](review/ui-audit/receipt-a4.pdf),
[financial first run](review/ui-audit/finance-first.json),
[relaunch](review/ui-audit/finance-relaunch.json).
All evidence records are synthetic.

## Remaining findings and gates

1. **P2 — recoverable work:** client and recurring editors still do not have the
   document editor's acknowledged unsaved-draft recovery. Background/termination
   can lose that unfinished work. Add bounded recovery or an explicit discard
   decision, then exercise interruption/relaunch on physical devices.
2. **P2 — accessibility/keyboard:** actual VoiceOver reading order/focus return,
   Dynamic Type, hardware/third-party keyboards, landscape safe areas and iPad
   split view remain unverified. DOM labels/inert state and portrait geometry are
   only part of acceptance.
3. **P2 — document output:** long-PDF pagination, unusually large amounts and
   wider multilingual fixtures need native PDF tests. Thai shaped-glyph PDF text
   extraction remains imperfect despite the inspected fixture looking correct.
4. **Product implementation gates:** mobile cloud join/sync, unified Apple
   entitlement verification, restore/import, evidence/accountant exports and real
   share-sheet/purchase/restore flows remain unfinished or unverified. The UI
   truthfully labels the prototype and connection capability; these are not
   completed by this layout audit.

Run instructions are in [README.md](README.md). Continue from
[MOBILE-VERIFICATION.md](MOBILE-VERIFICATION.md) and the mobile PRD before shipping.
