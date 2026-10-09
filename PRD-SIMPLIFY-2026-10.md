# PRD — BillNgai Simplification (App Store only, fewer features, better UX)

Status: approved direction by the owner on 2026-10-09 ("agree"), this document is the plan of record.
Branch: `codex/simplify-2.0.15` (from `codex/hig-restyle` @ 32cd1f7). Target release: 2.0.15 on the
Mac App Store + iOS App Store (owner may rename to 2.1.0 before submission; nothing else changes).
Companion docs: `SKU.md` (superseded by §4 of this file), `TEAM.md`, `BRAND.md`, `CLAUDE.md`,
`.claude/skills/apple-platform-design/`, `HIG-UI-VERIFICATION.md`.

## 0. Decision summary

| Decision | Choice | Why |
|---|---|---|
| Product promise | One job: a Thai freelancer issues a quotation, invoice or receipt in under two minutes and never loses it. | Everything that does not serve that job is removed. |
| Channels | **App Store only** — Mac App Store (Electron MAS build), iPhone/iPad (Capacitor). Same bundle id `com.visarut.billngai` on both, so Pro is one universal purchase. | One signing path, one review path, no R2/Pages/licence-key/notarisation/Windows upkeep. |
| Direct DMG / Windows | One final direct macOS build whose only new feature is the guided export; then retired. Windows beta ends now (never left beta). | Existing direct users keep working and get a path into the store build. |
| Pro | In-app purchase `com.visarut.billngai.pro`, non-consumable, universal. Price unchanged (฿599 Early Bird → ฿1,900). | Already live on the Mac App Store record. |
| Existing lifetime-key holders | Owner issues free IAP Pro offer codes after approval (2026-10-10 correction). No refunds, no second payment. | Small base; one code per verified buyer. |
| Removed | Local AI add-on, sound effects, direct-purchase/licence screens, paused e-Tax and new-tax-invoice remnants. | §2. |
| Kept | Quotation/invoice/receipt, WHT 50 ทวิ, income summary, corrected historical receipts, backups, Google Drive sync (Pro), foreign-currency/English documents, recurring (watch). | §3. |

## 1. Goals and non-goals

Goals
1. Fewer screens, fewer settings, fewer words. Sidebar ≤ 6 items, Settings ≤ 3 tabs, setup in ≤ 3 steps.
2. One source tree builds every shipped target; no per-channel code stripping needed.
3. A direct user can move to the store build in two clicks without losing a record.
4. `npm test`, `release:check`, the Electron smoke suite and the iOS build stay green throughout.

Non-goals (this cycle)
- No new features. No data-model changes beyond removing dead fields with safe defaults.
- No change to the printed `.paper` document, numbering, tax logic or review-event semantics.
- No iCloud sync rewrite (candidate for a later cycle).

## 2. What is removed

| Feature | User-visible today | Code to remove (owner of the stream) | Data / compatibility rule |
|---|---|---|---|
| **Local AI add-on** ("TOR → Invoice") | Sidebar item, `ai` view, AI settings, add-on install/verify, draft cards | `billing.html`: `setView('ai')`, `renderAi`, `renderAiDraftCard`, `openAiSettings`, `data-t="TOR → Invoice"`, every `ai*` IPC call and string; `main.js`: `USER_AI_DIR`, `SYSTEM_AI_DIR`, `AI_DIRS`, `AI_PUBLIC_KEY`, `verifyAiDir`, all `ai:*` IPC; `preload.js` exposure; `AI_ADDON_HANDOFF.md` → archive note; release validator entries | Any `DB.business.ai*` or add-on fields keep loading silently (migrate() ignores unknown keys). Installed add-on folders are left on disk, never deleted by the app. |
| **Sound effects** | Settings tab "เสียง", `playAppSfx`, `new Audio(...)` | `billing.html`: Sounds tab + `playAppSfx` + preferences; bundled audio assets; `test/audio*.cjs`, `test/motion.test.cjs` parts that assert sounds | `DB.business.sounds*` prefs ignored on load. Keep Reduce Motion handling (HIG). |
| **Direct purchase & licence UI** | "ซื้อ Pro" modal (PromptPay, LINE, Early Bird), "มีรหัส Pro แล้ว?" field | `billing.html` region between `function openDirectUpgradeModal(){` and `async function activateLicense(){` plus `registerDirectPurchaseCopy()`; `scripts/channel-renderer.cjs` and `test/channel-renderer.test.cjs` become unnecessary once the region is gone — delete both and the mobile `prepare-web` call site | **Keep licence validation in `main.js` (`parseLicenseKey`, `licenseKey` in config.json) for the final direct build only**; remove it in the retirement release (§4.3). MAS/iOS builds already ignore it (`IS_MAS`). |
| **e-Tax / new tax invoice remnants** | Paused banners, XML menu stubs, "ใบกำกับภาษีใหม่" paths | `billing.html` strings and dead branches for e-Tax XML and new `tax_invoice` creation; keep `tax_invoice` as a *historical* type for existing records and the correction workflow | Existing `tax_invoice` records, review events and `documentOutputBlocked` rules stay exactly as they are. |

Rule for every removal: delete the code, its i18n keys, its tests, its docs mention and its release-validator check in the same commit, and add a CHANGELOG "Removed" line. If a Thai string is still referenced anywhere, the removal is not done.

## 3. What stays (do not touch in this cycle)

Quotation → invoice → receipt lifecycle and milestones; withholding tax (50 ทวิ) list; income summary (สรุปรายรับ) and CSV; corrected historical receipts (`receipt_reissue`) and the legacy review; backups, export, import, SQLite store and recovery; Google Drive sync v3 (Pro); foreign-currency and English/bilingual documents; recurring invoices (kept, usage to be reviewed after release); the HIG restyle and dark mode; the printed `.paper`.

## 4. Channels and SKU (replaces `SKU.md` §2–§6)

### 4.1 SKUs after this cycle

| SKU | Product | Where | Price | Unlock |
|---|---|---|---|---|
| `BN-LOCAL-AS` | BillNgai (free tier) | Mac App Store, iOS App Store | Free | Download |
| `BN-PRO-AS` | BillNgai Pro | In-app purchase, universal across Mac/iPhone/iPad | ฿599 → ฿1,900 (Apple tier) | StoreKit, restore on any device with the same Apple ID |

Retired: `BN-LOCAL-MAC` (DMG), `BN-LOCAL-WIN`, `BN-PRO-KEY`, `BN-AI-ADDON`.

### 4.2 Transition timeline

1. **2.0.15 store release** — simplified app, HIG restyle. Submitted to Mac App Store and TestFlight → App Store for iOS.
2. **2.0.15 final direct DMG** (same source, direct target) — contains the guided export (§5) and a one-line notice "รุ่นต่อไปจะมีใน App Store เท่านั้น" in Settings → ข้อมูลและสำรอง. Published once to the existing R2/Pages link; no further direct builds.
3. **Retirement release (2.0.16 or later, store only)** — remove `licenseKey` validation, `dist`, `dist:unsigned`, `dist:win`, notarisation scripts, `DELIVERY.md`/`WINDOWS-*.md` moved to `review/archive/`. Landing page keeps a single "Download on the App Store" button.

### 4.3 Owner-only actions (agents prepare, never execute)
Create IAP offer codes after approval; publish the landing-page change; final DMG signing/notarisation/upload; MAS and iOS submission; App Store Connect metadata and screenshots; customer messages.

**Implementation correction (2026-10-10):** Apple stopped creating promo codes for in-app purchases on 2026-03-26. The existing-customer promise is fulfilled with free IAP Pro Offer Codes after the app is Ready for Distribution and the IAP is Approved. See the corrected owner checklist and `SKU.md`; the original promo-code route is obsolete.

## 5. Migration path: direct → App Store build

Existing pieces: `data:export` (writes a JSON backup via save dialog, sync binding stripped) and `data:import` (open dialog → renderer merge). Both already work inside the macOS sandbox through the system file dialogs.

Required for this cycle
1. Direct build: Settings → ข้อมูลและสำรอง gets a first-class card "ย้ายไป App Store" with one button that runs the existing export and then opens the App Store link. Copy must say what is and is not carried (documents, clients, review events, counters, settings yes; Drive sync binding and licence no).
2. Store build: on first launch with an empty store, the setup sheet offers "นำเข้าจากเวอร์ชันเดิม" which calls the existing import. Import of a full export into an empty store must be a replace, not a merge, and must preserve review events (append-only rules), counters and the migration origin.
3. Acceptance: a synthetic direct profile with ≥ 50 documents, 10 corrections and WHT entries exports; a fresh MAS-flavoured profile (`BILLNGAI_FAKE_MAS=1` in dev) imports; `paymentReview()`, document list, counters and `receiptReissues()` are identical before and after; PDFs of a corrected receipt match.

## 6. UX simplification (after the removals land)

- Sidebar: แดชบอร์ด · เอกสาร · ลูกค้า · สรุปรายรับ · หัก ณ ที่จ่าย · ตั้งค่า. Nothing else.
- Settings: ธุรกิจของฉัน · เอกสารและภาษี · ข้อมูลและสำรอง (sync lives here for Pro).
- Setup: business name + tax id → address + logo → done. Everything else has defaults.
- Dashboard "สิ่งที่ต้องทำ" stays the single list of next actions; no second banner for the same item.
- Copy pass: remove paused-feature banners and any sentence that explains a feature that no longer exists.
- Every change follows the `apple-platform-design` skill and is verified light + dark + iPhone + iPad.

## 7. Work breakdown and agent assignments

Agents run in isolated worktrees off `codex/simplify-2.0.15`, never on the owner's live profile, never with network side effects. Each agent returns: files changed, tests run with output, open questions. The manager (Claude session) reviews the diff, reruns tests, merges in the order below and resolves conflicts in `billing.html`.

| Stream | Agent task | Files | Must not touch | Acceptance |
|---|---|---|---|---|
| A | Remove the local AI add-on | `billing.html`, `main.js`, `preload.js`, `scripts/validate-release-config.cjs`, docs, tests | Sounds code, licence code, `.paper`, mobile/ | `npm test`, `release:check` green; no `ai` strings in renderer/i18n; `option-a` + `design-fixes` smokes pass |
| B | Remove sound effects | `billing.html` (Sounds tab, `playAppSfx`), audio assets, `test/audio*`, `test/motion.test.cjs` | AI code, licence code, mobile/ | Settings shows 3 tabs; Reduce Motion still honoured; `npm test` green; `option-a` smoke tab count updated |
| C | Remove direct-purchase UI and channel renderer | `billing.html` purchase region, `scripts/channel-renderer.cjs`, its test, `mobile/scripts/prepare-web.cjs` call site, `package.json` scripts | Licence validation in `main.js` (keep for the final DMG), IAP code | No `lin.ee`, "Early Bird", "ซื้อ Pro" strings in the tree; iOS `build:simulator` passes; `npm test` green |
| D | Remove e-Tax / new tax invoice remnants | `billing.html` strings and dead branches; `FAQ.md` | `tax_invoice` historical handling, corrections, review events | All existing tests on legacy/corrections pass unchanged; no "e-Tax" strings remain |
| E | Migration path (§5) | `billing.html` settings card + setup sheet, `main.js` import semantics if needed, new `test/migration-electron-smoke.cjs` | Sync code, SQLite store internals | §5.3 acceptance script passes on this Mac |
| F | UX simplification (§6) and copy pass | `billing.html`, `mobile/web/mobile.css` | Anything A–E are still editing (runs after merge) | HIG skill checklist; screenshots light/dark/iPhone/iPad in `review/2026-10-10/design/screens/` |
| G | Docs, SKU, CHANGELOG, release notes, store listing draft | `SKU.md` (pointer to this PRD), `CHANGELOG.md`, `review/.../RELEASE-NOTES-2.0.15-UI.md`, `TEAM.md` override note, `FAQ.md` | Code | Owner can submit with the drafted Review Notes (2.4.5 entitlement, reopen rule, test account) |

Merge order: A and B in parallel → merge → C and D in parallel → merge → E → F → G. Phase gates: after each merge the manager runs `npm test`, `npm run release:check`, the maintained smoke list from `HIG-UI-VERIFICATION.md`, and `npm run build:simulator` in `mobile/`.

## 8. Verification gates for the release

1. `npm test` and `npm run release:check` green; `node --check` on the extracted renderer script.
2. Electron smokes: fintech-ui, pdf-output, brand-color, payment-match, bulk-correction, design-fixes, stabilization, option-a, receipt-reissue, prepublish, packaged (against the MAS `.pkg` contents), migration (new).
3. `npm run dist:mas` builds; `codesign`/entitlements show sandbox + `network.server`; packaged bundle contains none of the retired strings.
4. iOS `build:simulator` and `build:device` succeed; simulator pass on iPhone 17 (light + dark) and iPad Pro 11-inch.
5. Store screenshots retaken on the final UI.

## 9. Open questions (owner)

- Rename 2.0.15 → 2.1.0 for the store? (Removals justify a minor bump; cost is one more round of version edits.)
- Keep recurring invoices? Default: keep this cycle, decide after one release of usage feedback.
- Date for retiring the direct download link after the final DMG (suggest 60 days after the store release).
