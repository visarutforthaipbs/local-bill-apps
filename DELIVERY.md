# BillNgai 2.0 — Delivery & Fulfillment

## Current override — 2026-09-23, Direct macOS 2.0.3 preparation

The current release is a containment candidate, not yet a verified public artifact.
Use `DEPLOYMENT.md` for build/sign/notarize/staple, exact packaged smoke, immutable
versioned R2 upload, public checksum, GitHub fallback and live Pages verification.
Old version URLs, hashes and launch checkboxes below are historical evidence only.
Do not send the old LINE template without replacing links with verified artifacts
and disclosing the current restrictions; sending still requires owner authorization.

Local is free. Pro prices stay ฿599 Early Bird → ฿1,900; no refund or new license
policy is created. Both tiers can classify income and use limited bookkeeping
summaries. Both tiers pause cloud connect/sync/restore, PIT payable/refund estimates
and custom e-Tax XML. New receipts are ordinary non-VAT THB full-payment only;
tax-invoice/registered-seller, partial/deposit/refund and FX-receipt issuance are
unavailable. Local backup/export remains. Pro retains its existing AI add-on
entitlement, not a new AI compatibility guarantee. See `SKU.md` and `FAQ.md`.

The owner authorized reviewed Direct macOS commits/signing/publication and matching
website changes. Windows and MAS stay pending; no customer broadcasts, MAS submit,
pricing changes, refunds or key generation are included. Existing Pro customer
handling is tracked in `BACKLOG.md`. AI-assisted audit is owner-directed, not
practitioner approval or legal certification. All installer gates remain required.

How the two packages reach customers. Companion to `PRD-2.0-LOCAL-PRO.md`
(§8 packaging, §25 entitlement) — this file is the operational side.

Core principle: **one DMG, one codebase — the license key decides the tier.**
Never ship separate Local/Pro builds; Local→Pro is "paste a key", not a reinstall.

---

## 1. The two products

| | BillNgai Local | BillNgai Pro |
|---|---|---|
| Price | **ฟรี** (ตัดสินใจแล้ว 2026-07-12 — เดิม ฿59 Early Bird honor system, ดู SKU.md §6.A) | ฿599 Early Bird → ฿1,900 one-time (ตัดสินใจแล้ว 2026-07-12, ดู SKU.md §6.B) |
| Buyer receives | DMG download link | DMG link + **Pro key** + **AI add-on PKG link** |
| License key | none (soft enforcement — the download *is* the product) | Ed25519 signed key, verified offline in-app |
| Unlocks (Direct 2.0.3 candidate) | supported ordinary billing, local backup/export, income classification and limited summaries | + existing TOR → Quotation AI entitlement; sync remains paused |
| Upgrade path | — | buy Pro → paste key in ตั้งค่า → Workspace. No reinstall |

Rationale: Local is free with no key at all (decided 2026-07-12 — was a ฿59
Early Bird honor-system charge before). Historically AI and sync were
gated behind Pro (sync is paused in 2.0.3), so free Local removes the "why is App Store free but
web costs ฿59" friction entirely and makes the website one funnel into Pro.
Revisit only if sharing becomes a real problem (plan `'local'` fits the
existing license format if ever needed).

---

## 2. What gets built and hosted

1. **`BillNgai-<version>-universal.dmg`** — `npm run dist` (production, signed & notarized) or `npm run dist:unsigned` (local testing). One file for both tiers.
2. **AI add-on PKG** (~2GB, Typhoon2-3B) — `npm run ai:addon:build -- --source <folder> --pkg …`
   Signed manifest; the app only activates verified modules.
3. **Pro keys** — generated per-buyer, never pre-generated in bulk:

   ```bash
   npm run pro:license -- --email buyer@example.com          # pro-lifetime (default)
   ```

Hosting & storefront (**decided 2026-07-08**): the existing stack — the
marketing site (`promote-billiong`, Cloudflare Pages) + **Cloudflare R2** for
the DMG/AI PKG downloads + **PromptPay** for payment + **LINE OA** for
fulfillment. No Gumroad/Stripe at launch (see §6 for the Phase-2 trigger).

- **BillNgai Local (ฟรี)** — website: direct download from R2, no payment
  dialog, no key. (Decided 2026-07-12 — was ฿59 Early Bird honor system.)
- **BillNgai Pro (฿599 Early Bird)** — website "จองสิทธิ์" dialog: PromptPay
  QR ฿599 → buyer sends **slip + email** via LINE OA → you reply with the key.
  The site and the in-app upgrade modal both state the flow, and promise
  **"รับรหัสทาง LINE ปกติไม่กี่นาที ไม่เกิน 24 ชม."** (Decided 2026-07-12 — was ฿590.)

Why LINE, not a cart: PromptPay transfers carry no buyer identity — LINE is
the identity + delivery + support channel in one, and it's the channel Thai
freelancers already trust for exactly this kind of purchase.

---

### Uploading large files to R2 (AI PKG is 1.9 GB)

The Cloudflare **dashboard** caps uploads at 300 MB, but R2 itself takes
multi-GB objects via the S3 API (multipart). Use `rclone` (already installed):

1. Dashboard → R2 → **Manage R2 API Tokens** → create token with
   *Object Read & Write* on the bucket. Note the Access Key ID / Secret and
   the account endpoint (`https://<accountid>.r2.cloudflarestorage.com`).
2. One-time: `rclone config` → new remote `r2` → type `s3` → provider
   `Cloudflare` → paste keys + endpoint.
3. Upload:

   ```bash
   rclone copy "dist/ai-addons/BillNgai-AI-AddOn-typhoon2-3b-instruct-1.0.0.pkg" \
     r2:<bucket-name>/ --s3-chunk-size 100M --progress
   ```

4. Verify: download URL is
   `https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-AI-AddOn-typhoon2-3b-instruct-1.0.0.pkg`
   and the file's SHA-256 must be
   `77f9b7ba222a4a1eabb8c4a29394aedd1f615cff955a99fc4189a871729e1255`.

R2 egress is free, so 1.9 GB per Pro buyer costs nothing. Do **not** upload
the `qwen-tor-recommended` PKG — that model's license is research-only.

Uploaded artifacts (2026-07-09):

- macOS PKG — SHA-256 `77f9b7ba222a4a1eabb8c4a29394aedd1f615cff955a99fc4189a871729e1255`
- Windows ZIP (`…-1.0.0-win.zip`, llama-cli.exe + pdftotext.exe + install.cmd,
  manifest signature verified against the app's embedded key) —
  SHA-256 `c4bcd8c1e25c62a0c72fb4d87e938f21669ba7d18009a329ab14271760c33033`
- Windows caveat for the selling page: TOR import supports **PDF/TXT only**
  (DOC/DOCX conversion uses macOS `textutil`).

## 3. Per-sale fulfillment (Pro — via LINE)

When a buyer sends a payment slip in LINE:

1. Check the slip amount (฿599) against your bank/PromptPay notification.
2. Ask for their **email** if not included with the slip.
3. Generate the key:

   ```bash
   npm run pro:license -- --email <buyer email>
   ```

4. Reply in the same LINE chat (template below).
5. Log the sale in the **BillNgai Sales Log** Notion database — this **is**
   the customer database (keys are offline-verified and cannot be revoked
   remotely). Migrated from a Google Sheet on 2026-07-12; the sheet is no
   longer updated. Columns: Name (title) · Date · Email · Product
   (Local Early Bird / Pro Early Bird / Local / Pro) · Amount THB ·
   License Key · Key Prefix · Sale Status · Notes.

LINE reply template (Thai):

```text
ขอบคุณที่สนับสนุน BillNgai Pro ครับ 🙏

รหัส Pro ของคุณ (คัดลอกทั้งบรรทัด):
<KEY>

วิธีเปิดใช้งาน:
1. เปิด BillNgai → ตั้งค่า → พื้นที่ทำงาน
2. กด "ดูแพ็กเกจ Pro" → วางรหัส → เปิดใช้งานรหัส

ดาวน์โหลด (ถ้ายังไม่มี):
- ตัวแอป macOS: https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.0-universal.dmg
- ตัวแอป Windows: https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai%20Setup%202.0.0.exe
- โมดูล AI (macOS, 1.9 GB — เปิดไฟล์ .pkg แล้วติดตั้งได้เลย):
  https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-AI-AddOn-typhoon2-3b-instruct-1.0.0.pkg
- โมดูล AI (Windows, 1.9 GB — แตก zip แล้วดับเบิลคลิก install.cmd):
  https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-AI-AddOn-typhoon2-3b-instruct-1.0.0-win.zip

รหัสผูกกับอีเมลคุณ ใช้ได้ทุกเครื่องของคุณเอง
มีปัญหาอะไรทักมาในแชทนี้ได้เลยครับ
```

Consider a LINE OA **auto-reply / rich menu** entry ("ซื้อ Pro") that repeats
the 3 steps + QR, so buyers who arrive outside your waking hours aren't stuck.

Local sales need no action — the website serves the DMG from R2 directly.

---

## 4. Historical 2.0 launch checklist (not the current 2.0.3 release checklist)

- [x] **Google OAuth app published to Production** — done, verified 2026-07-15 in
      the console: Publishing status **In production**, User type **External**,
      zero sensitive and zero restricted scopes registered. App requests only
      `drive.file` + `email` (`main.js:641,697`) — both non-sensitive, so no Google
      review, no "unverified app" screen, and the 100-user cap does not apply
      (it only bites on unapproved sensitive scopes; the "2 users / 100" shown is
      inert leftover from Testing mode).
      Why this mattered beyond our own launch: while in Testing, only allowlisted
      test users could sign in — so an **App Review reviewer could not reach Drive
      sync at all**, which is the functionality justifying the
      `com.apple.security.network.server` entitlement they queried under
      Guideline 2.4.5(i). Testing mode would have re-triggered that citation.
      **Do not add a logo** to the consent screen — that alone triggers brand review.
      **Do not press "Back to testing"** — same failure returns.
      Note: the Data Access page lists no scopes at all. Harmless — non-sensitive
      scopes need no pre-declaration; the consent screen renders what's requested
      at runtime. Leave it alone.
- [ ] **Google Drive API enabled** in the `billngai` project.
- [ ] **Two-device end-to-end test**: connect A → edit → see on B → force a
      conflict (edit the same invoice's amount on both while offline) → resolve →
      "กู้คืนจากคลาวด์" on a clean userData dir.
- [ ] **Code signing + notarization** for production artifacts
      (per `mac_signing_notarization_plan.md`). Current policy requires signed,
      verified production downloads for both tiers. Do not bypass Gatekeeper.
- [ ] Release routine per `CLAUDE.md` (CHANGELOG → version bump → tag → dist → push).
- [ ] `BillNgai-2.0.0-universal.dmg` + AI PKG uploaded to **R2**; website download
      links flipped from 1.4.0 to 2.0.0.
- [x] Website Pro dialog live (PromptPay ฿599 + LINE steps) — deployed and
      verified live 2026-07-13. Local is now a free download with no payment step
      (SKU.md §6.A), so the old ฿290 Local QR is gone; the Pro QR was regenerated
      at ฿599 and its payload decode-verified. The previous ฿290 QR was corrupt
      and unscannable — a customer could not pay at all. Never hand-place a QR
      SVG again without decoding it first.
- [ ] LINE OA auto-reply or rich menu covers the "ซื้อ Pro" flow after hours
      (still open — tracked as P1 in BACKLOG.md).
- [ ] Selling-page copy uses PRD §24 landing text.
- [ ] `secrets/gdrive-oauth.json` present at build time (git-ignored, but
      packaged into the DMG via `build.files` — sync silently degrades to
      "not configured" if forgotten).
- [ ] Generate your own Pro key and dogfood for at least a week.

---

## 5. Updates & support

- **App updates**: buyers re-download from the website (R2 always serves the
  latest DMG). No auto-updater — announce updates via the selling page / LINE OA
  broadcast (Pro buyers are all in your LINE contact list by construction).
- **Pro keys survive updates**: verified offline against the embedded public
  key; never re-issued for new versions. If a paid major upgrade is ever
  introduced (e.g. Pro 3.0), gate on the key's `issuedAt` — the format
  already carries it.
- **AI module updates**: new PKG, versioned independently (`--version` in the
  build script). Old modules keep working; the manifest signature is the gate.
- **Lost key**: look up the sales log, resend. (Keys are deterministic per
  issuance, not per install — the same key works on all the buyer's machines.)
- **Refunds**: ask the buyer to press "ปิดการใช้งานรหัสนี้" (honor system —
  offline keys can't be revoked). Log the refund next to the original sale.
- **Key security**: everything hinges on `secrets/ai-signing-key.pem`
  (signs AI modules *and* Pro keys). It is git-ignored — keep an offline
  backup; if it leaks, both the add-on chain and Pro licensing are forgeable.

---

## 6. Explicitly out of scope (for now)

- License server / online activation — revisit only with real volume or abuse.
- Auto-updater (Sparkle/electron-updater) — needs signed builds first anyway.
- **Phase 2 — automated key delivery** (trigger: >~10 Pro sales/day, or demand
  for instant 24/7 delivery): pre-generate a signed key pool **offline**, load
  it into a dispenser — Gumroad's unique-keys-per-sale, or Stripe TH
  (supports PromptPay) + a Cloudflare Worker that emails one pool key per
  confirmed payment. The Ed25519 private key never touches any server; a
  compromised dispenser burns at most the unsold pool.
- ~~Windows delivery~~ — **unblocked 2026-07-09**: Windows app exe + Windows AI
  add-on zip are both live on R2. Remaining: end-to-end test of TOR → Quotation
  on a real Windows machine before advertising AI for Windows.
