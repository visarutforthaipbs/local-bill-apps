# Review: desktop 2.0.13 renderer/UI merge (static, read-only)

**Scope reviewed:** `changes.diff` (BRAND.md, billing.html, make-icon.js, package.json) against `baseline-contract.md` (direct 2.0.12 baseline c303ac3 contract), `AGENTS.md`, `BRAND.md`. No source modified; no tests run. This review is **not** release acceptance — packaged verification and final sign-off remain manager-owned.

---

## P1 — must resolve before packaging 2.0.13

### P1-1. Asset bundle: runtime now references binaries that do not appear anywhere in the diff
`BRAND_ASSET` (billing.html, diff 628–644) drops all seven legacy paths and registers five new ones, and the audio system (diff 457–490) references 6 guide MP3s + 5 SFX MP3s:

```
assets/brand/fintech/invoice-stack.png
assets/brand/fintech/contact-cards.png
assets/brand/fintech/freelancer-desk.png
assets/brand/fintech/certificate-envelope.png
assets/brand/fintech/document-folder.png
assets/audio/voice/help-{first-bill,send-bill,wht,backup,draft-issued,payment}-th.mp3
assets/audio/sfx/{button-tap,document-issued,payment-recorded,export-complete,needs-attention}.mp3
```

`package.json` `build.files` (diff 1099–1118) adds these paths (`assets/brand/fintech/*.png`, `assets/audio/**/*.mp3`), but **the diff contains no binary additions at all** (no `new file mode` / "Binary files differ" entries). If the merge commit is the same, the DMG ships with:
- broken `<img>` on every empty state, dashboard promo, and wizard step 1 (`brandImg` emits `src="assets/brand/fintech/…"`, diff 645–647),
- silent audio failure at runtime (`startAppAudio` → `media.onerror` → error toast "เล่นเสียงไม่ได้…", diff 512), plus SFX that never fire.

Additionally, BRAND.md requires "The runtime registry and packaged file list must contain no former character/object illustration paths." All *visible* usages were migrated (`characterInvoice→assetInvoice`, `objectEnvelope→assetEnvelope`, `objectFolder→assetFolder`, `objectLaptop→assetDesk`, `characterReview→assetContacts`, `characterReady→assetDesk`), but a diff-only view cannot prove no residual `character*`/`object*`/`set-1-*` references remain elsewhere in the 7k+ line `billing.html`.

**Exact fix if binaries are missing:** add the 11 files at the listed paths (or re-point `BRAND_ASSET`/`APP_AUDIO_GUIDES`/`APP_SFX` to the real paths and keep `build.files` in sync — the existing comment at diff 629–630 requires every `BRAND_ASSET` path to exist in `build.files`). Then confirm zero legacy paths via a full-file grep (commands below).

---

## P2 — should fix / verify before release

### P2-1. Accessible names removed from every modal close and item-delete button
`ic()` wraps all icons in `aria-hidden="true"` (diff 420). The merge replaces the `×` text glyph with `${ic('close')}` in all `.x` modal-close buttons and `.del` row-delete buttons — e.g. diff 285–286 (`openConflictsModal`), 710–712 (`drawWizard`), 802–803 (`drawRecItems`), 914–915 / 923–924 (`drawDocEditor`), 944–945 (`drawItems`), 974–975 (`openDocumentArchive`), 1031–1032 (`drawSplitDialog`), and 228–229 CSS keeps `.x` at 32px with no label. Result: `<button class="x" onclick="closeModal()">` and `<button class="del" onclick="delItem(i)">` have **no accessible name** (the only content is aria-hidden SVG), a regression from the previous `×` text. Violates BRAND.md "Keep status labels and accessible control names."
**Exact fix:** add `aria-label="${attr(tr('ปิด'))}"` (and a `tr('ลบรายการ')` label for `.del`) or keep visible text alongside the icon. Contrast: `hintIcon()` (diff 1061) and the LINE link (diff 304) correctly retained their text/label.

### P2-2. `stopAppAudio()` fires on same-screen re-renders, exceeding contract stop conditions
Contract (BRAND.md): "Stop it when its section closes, the modal closes, or the screen changes." The merge calls `stopAppAudio()` unconditionally at the top of `render()` (diff 623–624), plus `drawDocEditor()` (diff 908–909), `openModal()`/`closeModal()` (diff 1039, 1047). `render()` runs on actions that are *not* screen changes, so a playing guide is cut mid-sentence when e.g. `elExport` calls `render()` on the same Settings screen (diff 312–313), `makeManualSnapshot` finishes (diff 887–892), or `setStatus` re-renders the same Documents list (diff 1012). Background/automatic re-renders also stop audio with no user action.
**Exact fix:** gate the `render()` call on the actual view/screen identity (e.g. only stop when `currentView` changed or content is replaced by a different section), keeping stop-on `openModal`/`closeModal`/guide-collapse as-is (`audioGuideCollapsed`, diff 548–550, already handles section close correctly).

### P2-3. Audio guides inserted into high-focus financial flows and above the draft-recovery banner
- `renderAudioGuide('payment')` is embedded in `openPaymentDialog` **between the amount confirmation line and the payment-date field** (diff 965–966), adding a collapsible help block inside an explicit financial-confirmation dialog ("one clear job", "Only explicit confirmation changes financial facts").
- `renderAudioGuide('draft-issued')` in `drawDocEditor` sits **above the recoverable-draft banner** (`พบเอกสารที่พิมพ์ค้างไว้…`, diff 926–929), pushing recoverable-work recovery below optional help — against "Keep pending work recoverable" / "place occasional work beneath its parent task".
- `renderAudioGuide('first-bill')` renders unconditionally at the top of the Documents list (diff 730) for all users, not just the empty/first-run state — density regression on the primary daily screen (baseline explicitly flags 37signals density).

**Exact fix:** move the payment guide below the form/into the footer hint area or behind the existing hint pattern; move `draft-issued` below the draft-recovery banner; render `first-bill` only when `!activeDocs().filter(d=>!d.archivedAt).length` (matching the empty-state branch in `drawDocList`, diff 736–741).

### P2-4. Completion-cue inconsistency for backups (and tap-sound double-up)
`savePDF` pairs outcome artwork with the export cue: `toast(...,'ok',null,'export');playAppSfx('export')` (diff 1002). But `elExport` (diff 312–313) and `makeManualSnapshot` (diff 892) show `'backup'` outcome artwork **without** `playAppSfx('export')`, and neither `elExport`/`makeManualSnapshot` is in the tap-skip regex (diff 537: only `issueDoc|saveDoc|saveDraft|submitPaymentDialog|createReceipt|savePDF`), so a backup gets a generic tap + artwork instead of the approved export cue. Not a financial change, but the "approved … export cues" contract reads as one cue per confirmed export.
**Exact fix:** add `playAppSfx('export')` after each confirmed backup success and extend the regex with `elExport|makeManualSnapshot`.

### P2-5. Minor brand/layout deviations to verify against live CSS
- `.brand-snapshot .brand-art` loses `border-radius:var(--radius)` and `border:1px solid var(--border)` (diff 160–170) — a panel now sits square/flat where BRAND.md keeps cards/panels at 16–24px token radii; `object-fit:cover` at 240×160 (and 216×136 at diff 202–207) can crop the centered renders.
- Settings content is wrapped in a new `<div class="settings-panel">` (diff 883) with **no CSS rule positioning it** (only the `panelEnter` animation, diff 244). If `.settings-grid` styles target child cards directly, the wrapper changes layout/save-bar placement.
- `make-icon.js` now scales the source: `x.drawImage(img, 0, 0, S, S)` (diff 1083). Verify `build/icon_source.png` is square or the icon silhouette distorts; per BRAND.md, running this tool **does** touch icon outputs, which the contract says source updates must not replace — keep regeneration a deliberate manager step.

---

## Confirmed safe / unchanged (no issue found)

- **Financials untouched:** no changes to `priceInput`, `round2`, `lineTotal`, `applyVatStatus`, `compute`, issue checklist, or the payment-amount confirmation line (`openPaymentDialog` amount line retained verbatim, diff 964–966). Audio/toast changes wrap *after* `persistDocumentMutation` success only (diff 955–957, 1012, 1022–1023) — "financials must not change merely to play audio" holds in this diff.
- **main.js / preload.js / `lib/*.cjs` untouched** — matches the "preserve unchanged" baseline clause.
- **Google Drive connect/disconnect UI and translated production errors retained** (only close-button/icon glyphs changed in `openConflictsModal` / `openUpgradeModal`, diff 285–305).
- **Audio safety:** SFX off by default, device-local `localStorage` key (diff 491–500); guides never autoplay (play only via `toggleAudioGuide` click); one clip at a time with epoch guard (diff 492, 509–522); taps suppressed for disabled/programmatic clicks, audio controls, and actions with their own cue (diff 531–541); `@media print` hides `.audio-guide/.audio-settings` (diff 277); playback failure surfaces only a toast and never blocks work (diff 512); reduced-motion coverage present for all new animations (diff 142, 214–218, 250–255).
- **i18n:** every new visible string goes through `tr()` with a matching `I18N_EN` entry (new keys at diff 321, 329, 337, 345, 430–456, 1070), including the new payment toast `'บันทึกรับเงินแล้ว'`. No helper named `t` introduced.
- **Version** bumped only in `package.json` (2.0.12 → 2.0.13, diff 1094); no cloud/auth/Store changes present.

---

## Assumptions

1. The supplied `changes.diff` is the complete text-file delta of the merge; binary assets are excluded from the review copy (hence P1-1 is stated conditionally on the merge commit).
2. Full `billing.html` is not in the working directory (only the four listed files), so "no residual legacy asset keys" and ".settings-grid CSS compatibility" are stated as verification items, not claims.
3. `assets/audio/**` files are mono/stereo MP3 matching the `.mp3` glob in `build.files` (a non-mp3 extension would silently drop from the package).

## Suggested validation commands (manager-owned; I did not run these)

```bash
# 1. Binaries actually tracked in the merge commit (P1-1)
git ls-tree -r --name-only HEAD | grep -E 'assets/(brand/fintech|audio)'
# 2. No legacy illustration paths in runtime registry or package list (P1-1)
grep -nE "character[A-Z]|object(Laptop|Envelope|Folder)|set-1-[0-9]" billing.html package.json
# 3. Accessible names restored (P2-1)
grep -n 'class="x"\|class="del"' billing.html | grep -v 'aria-label'
# 4. Syntax + i18n cross-check per CLAUDE.md extract-script routine
node --check <extracted-billing-script.js>
# 5. Packaged file list actually contains the assets (P1-1)
npx electron-builder --dir && find dist/mac*/BillNgai.app/Contents/Resources -name '*.mp3' -o -name 'invoice-stack.png'
# 6. Audio stop behavior + cue smoke (P2-2/P2-4): play guide on Documents, trigger a backup export from Settings, confirm guide is not cut; confirm backup success plays the export cue
# 7. Layout smoke (P2-5): Settings tabs with new .settings-panel wrapper; dashboard/wizard art aspect; icon silhouette from build/icon_source.png
```

## Unresolved issues (need manager input / full tree)

- Existence and licensing of the 11 new binary assets (5 PNG renders, 11 MP3s — count paths above; the PNG renders' "no embedded labels or financial figures" requirement can't be checked from the diff).
- Whether `docQuickAction` (diff 743+) or any other caller of `setStatus(id,'paid',…)` already shows its own success toast — the new toast in `setStatus` (diff 1012) could double up.
- Whether an `issueDoc` function exists at all (the tap-skip regex, diff 537, names it); if the real entry point is `saveDoc(true)`, the regex is fine, otherwise adjust.
- Residual `BRAND_ASSET` legacy-key call sites outside the diff hunks (see P1-1).

**Bottom line:** the merge keeps 2.0.12 financial and Drive behavior intact in the visible delta, and the audio system is largely contract-compliant (opt-in, local, non-blocking). It is **not** release-ready on this evidence: P1-1 (asset bundle presence) must be confirmed against the merge commit, and P2-1/P2-2 are concrete, small fixes. Final acceptance requires the manager's packaged 2.0.13 verification per the baseline contract.