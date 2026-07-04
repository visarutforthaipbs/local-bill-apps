# บิลง่าย / BillNgai — agent hand-off

Local-first quotation / invoice / receipt desktop app with Thai tax handling
(VAT, หัก ณ ที่จ่าย / 50 ทวิ tracking, ภ.ง.ด. 90/94 estimates, e-Tax XML draft, PromptPay QR).
Built for Thai freelancers/small businesses; has real users giving feedback.
Renamed from **Billiong** in 1.2.0 — `main.js` still contains a one-time
`migrateFromBilliong()` that copies data from the old `Billiong` app-support folder;
keep it until the old-name install base is gone.

## Architecture

- **Electron app, essentially one file.** All UI, logic, and document rendering live in
  `billing.html` (~3,000 lines of inline JS — no framework, no bundler, no build step for code).
  `main.js` = Electron main process (storage bridge, backups, PDF export), `preload.js` = IPC bridge.
- The same `billing.html` also runs in a plain browser (File System Access API instead of the
  native bridge). Useful for testing — see below.
- Data is one JSON object (`DB`), persisted to app storage or an external `billing.json`.
  `blankDB()` defines the schema; `migrate()` merges old data files, so **new fields must be
  added to `blankDB()` with safe defaults** — old data then upgrades automatically.

## Languages (added in 1.1.0 — read before touching any user-facing string)

Two independent systems:

1. **App UI language** (`DB.business.uiLang`: `th` | `en`), set in ตั้งค่า → รูปแบบการแสดงผล.
   - Translator is `tr('ไทย…')` — **Thai strings ARE the dictionary keys** in `I18N_EN`;
     missing keys fall back to Thai, so the Thai UI can never break.
   - **Never name a translate helper `t`** — many functions shadow `t` with `const t = compute(d)`.
   - Template keys keep `{x}` placeholders in both languages; call `.replace()` *after* `tr()`.
   - `thEn(th, en)` is the escape hatch for ambiguous words (บันทึก = Save AND Notes) and
     markup-heavy passages.
   - Static sidebar labels use `data-t` attributes, swapped by `applyUiLang()` (called in `render()`).
   - **Any new UI string must be wrapped in `tr()` and added to `I18N_EN`.**

2. **Document language** — what prints on the paper. Resolution in `docLangOf(doc)`:
   per-document `doc.docLang` → per-client `client.docLang` → global `DB.business.lang`;
   values `th` | `bilingual` | `en`.
   - `renderPaper()` deliberately does NOT use `tr()`; it uses inline `L(th, en)` pairs.
   - English docs get English months + Christian year (`fmtDate(ds, true, 'en', true)`),
     English amount-in-words (`bahtTextEn()`), English business name/address/terms with Thai
     fallbacks (`businessNameEn`, `addressEn`, `defaultTermsEn`).
   - **Guardrail: tax invoices (ใบกำกับภาษี) never render English-only** — `docLangOf` downgrades
     `en` → `bilingual` (Revenue Department document). Keep this.
   - English or foreign-currency invoices print the international bank block
     (`bankNameEn`, `swiftCode`, `bankAddress`, `bankAccountNameEn`) instead of PromptPay/Thai bank.
   - `shareText()` (copy-to-LINE summary) follows the client's language, not the UI's.
   - Foreign-currency docs carry optional `fxRate` (THB per unit) — used only by the tax report
     for THB equivalents; never printed on the document.

## Version control & releases

- Repo: https://github.com/visarutforthaipbs/local-bill-apps (remote `origin`, branch `main`).
- `dist/` and generated icons are gitignored; `build/icon_source.png` is the tracked icon source.
- **Release routine (follow in order):**
  1. Make and verify changes
  2. Add a section to `CHANGELOG.md` (Keep-a-Changelog style, ISO dates)
  3. Bump `version` in `package.json` (SemVer — it names the DMG)
  4. `git add -A && git commit` (descriptive message), then `git tag v<version>`
  5. `npm run dist` → `dist/BillNgai-<version>-universal.dmg` (universal, unsigned —
     `identity: null`; users right-click → Open past Gatekeeper)
  6. `git push` (tags too: `git push --tags`)
  7. Optionally attach the DMG to a GitHub Release on the tag (`gh release create`)
- Don't commit without being asked; the owner drives releases.

## How to verify changes (what has worked well)

1. Extract the inline script and syntax-check it:
   `python3` regex out `<script>…</script>` → `node --check`.
2. Cross-check every `tr('…')` literal against `I18N_EN` (missing keys = silent Thai fallback
   in the EN UI — fine for Thai, but find them before shipping).
3. Run the real thing: `python3 -m http.server <port>` in the project root, open
   `billing.html` via localhost in a browser (Chrome tools work; `file://` is blocked),
   drive it with JS (`wizDone(true)`, push test clients/docs, `renderPaper(...)` assertions),
   and screenshot. **Clear `localStorage` afterwards** — the browser origin keeps test data.
4. For the desktop app: `npm start` (data lives in `~/Library/Application Support/BillNgai` —
   that's the user's REAL data; don't inject test records there).

## Conventions & cautions

- **UI/visual work must follow `BRAND.md`** (design tokens, color rules, typography,
  voice — it wins over any request that conflicts). Agent behavior rules in `AGENTS.md`.
- Match the existing code style: compact vanilla JS, template literals, Thai comments where
  they aid the owner. No frameworks, no dependencies beyond what's in package.json.
- Everything renders through `render()` / template literals — re-render is cheap; call it after
  state changes.
- Dates: all calendar math is LOCAL time (`todayISO()`, `isoLocal()`) — never `toISOString()`
  for dates (Thailand is UTC+7). Buddhist/Christian year is a user setting (`yearMode`).
- Money: `round2()` before summing so printed lines always add up; amount-in-words for THB only.
- The owner (Visarut) communicates in Thai/English mix; user-facing Thai copy should stay
  natural Thai — don't machine-translate the existing strings.
