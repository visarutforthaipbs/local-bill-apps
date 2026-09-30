# Owner-directed 2.0.11 release

**Installed 2026-09-30:** private signed/notarized universal 2.0.11 at `/Applications/BillNgai.app`. Public release remains 2.0.4.

The owner reported a quotation PDF (QT-69-017) that showed the “นำไปออก” lineage link, the “การแบ่งงวด” instalment card and a cream border, and asked for the fix to be built and installed. Same private-release process as 2.0.10. No push/tag, downloads, website change, customer message, MAS or Windows submission.

## Cause and fix

- The print stylesheet hid a fixed list of screen elements; the lineage strip (`.doc-trail`) and instalment progress (`.split-progress`) were never on it, so linked quotations/invoices printed them. Print now hides both and, on the document screen, everything except `.paper`.
- Electron paints `@page` margins with the window background (`#FFF9F3` since 1.4.0). Print, PDF and File → Print now run with a white window background and restore the app color afterwards (`onWhitePage` in `main.js`; renderer prints through `doc:print`).
- Both issues predate 2.0.4, so public 2.0.4 is affected as well. Existing PDFs are unchanged; re-saving from 2.0.11 produces clean output.

## Validation and artifacts

- Source commit `6f465fcd6996f73b448e4b86c2d4ffbd4abfa738` (local only). 211/211 unit tests; inline/main/preload syntax, translation keys, release configuration and whitespace checks pass. Source storage smoke passes.
- New `test/pdf-output-electron-smoke.cjs`: quotation with an instalment invoice, saved through the real `savePDF` → `doc:pdf` path. It failed on the previous code (instalment text in the PDF, cream `#FFF9F3` corners) and passes now: no screen-only text, white corners, one A4 page, app background restored.
- Developer ID team `79QFYKTJMN`, hardened runtime, secure timestamp, universal x86_64 + arm64. App and DMG Gatekeeper: `Notarized Developer ID`.
- Apple submission `9c1ac454-c91a-4192-94e8-4f611773372c`: Accepted, no issues. Stapled and validated.
- Final DMG: `dist/2.0.11/BillNgai-2.0.11-universal.dmg`, 223,523,143 bytes. SHA-256 `37b5064decdc961bf21ed1c6f78949e344858a756b554ea9183ea21ace038210` (after stapling). Identical copy in the update folder.
- All 17 packaged source files match the commit. app.asar SHA-256 `5bb2eef35138a6cc2d2b0c89b5b73ca669a6457e365cc9ebb71631fefea1d75e`.
- Ten suites pass against the exact executable on a read-only mount of the final DMG, isolated synthetic profiles: PDF output, packaged recovery/receipt, corrected receipts, design fixes, fintech UI, legacy review, payment matching, stabilization, seller colors, first-day flow.
- 2.0.10 quit normally before installation. Profile backup verified: 86 files, byte-identical. Installed app matches the mounted final app; signature and Gatekeeper pass. Launch on the owner profile and normal quit left `billing.json` byte-identical; relaunched and left open.
- Backup directory: `/Users/lighthouse-control/BillNgai-update-2.0.11` — `profile-before-update`, `BillNgai-2.0.10-installed.app`, final DMG, `backup-manifest.json`. Evidence: `review/2026-09-30/release-2.0.11/`.
- Tested on this Apple Silicon Mac only; Intel, clean-Mac, Windows, MAS and a physical printer are not claimed.

## Cleanup (owner: keep one rollback)

Moved to `~/.Trash/BillNgai-cleanup-2026-09-30/`: the replaced `/Applications` 2.0.10, the 2.0.9 rollback app and DMG, a duplicate 2.0.10 DMG and the 2.0.11 staging build. Rollback is now 2.0.10: app in the backup directory above, DMG in `dist/2.0.10/`. All customer-data backups kept.

## Rollback

Quit normally, preserve the current profile, restore `BillNgai-2.0.10-installed.app`. 2.0.11 changes no stored data; 2.0.10 reads it unchanged (its PDFs will show the old border and cards).
