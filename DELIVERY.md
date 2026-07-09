# BillNgai 2.0 — Delivery & Fulfillment

How the two packages reach customers. Companion to `PRD-2.0-LOCAL-PRO.md`
(§8 packaging, §25 entitlement) — this file is the operational side.

Core principle: **one DMG, one codebase — the license key decides the tier.**
Never ship separate Local/Pro builds; Local→Pro is "paste a key", not a reinstall.

---

## 1. The two products

| | BillNgai Local | BillNgai Pro |
|---|---|---|
| Price | ฿59 Early Bird → ฿299–499 one-time | ฿590 Early Bird → ฿1,990 one-time |
| Buyer receives | DMG download link | DMG link + **Pro key** + **AI add-on PKG link** |
| License key | none (soft enforcement — the download *is* the product) | Ed25519 signed key, verified offline in-app |
| Unlocks | all core billing + tax features, local backup/restore | + TOR → Invoice AI · Google Drive sync · income categories (มาตรา 40) |
| Upgrade path | — | buy Pro → paste key in ตั้งค่า → Workspace. No reinstall |

Rationale for no Local key: ฿299-tier friction isn't worth it; the valuable
features (AI, sync) are gated anyway. Revisit only if sharing becomes a real
problem (plan `'local'` fits the existing license format if ever needed).

---

## 2. What gets built and hosted

1. **`BillNgai-<version>-universal.dmg`** — `npm run dist`. One file for both tiers.
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

- **BillNgai Local (฿59 Early Bird)** — website dialog: PromptPay QR →
  download from R2. Honor system, no key, unchanged.
- **BillNgai Pro (฿590 Early Bird)** — website "จองสิทธิ์" dialog: PromptPay
  QR ฿590 → buyer sends **slip + email** via LINE OA → you reply with the key.
  The site and the in-app upgrade modal both state the flow, and promise
  **"รับรหัสทาง LINE ปกติไม่กี่นาที ไม่เกิน 24 ชม."**

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

1. Check the slip amount (฿590) against your bank/PromptPay notification.
2. Ask for their **email** if not included with the slip.
3. Generate the key:

   ```bash
   npm run pro:license -- --email <buyer email>
   ```

4. Reply in the same LINE chat (template below).
5. Log the sale — this spreadsheet **is** the customer database
   (keys are offline-verified and cannot be revoked remotely):

   | date | email | LINE name | product | key (or key prefix) | notes |
   |---|---|---|---|---|---|

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

## 4. Launch checklist (blockers before selling Pro)

- [ ] **Google OAuth app published to Production**
      (console.cloud.google.com → project `billngai` → OAuth consent screen → Publish).
      Testing mode limits: 100 test users, refresh tokens expire every 7 days.
      Scopes are non-sensitive (`drive.file` + `email`) → no Google review needed.
      **Do not add a logo** to the consent screen — that alone triggers brand review.
- [ ] **Google Drive API enabled** in the `billngai` project.
- [ ] **Two-device end-to-end test**: connect A → edit → see on B → force a
      conflict (edit the same invoice's amount on both while offline) → resolve →
      "กู้คืนจากคลาวด์" on a clean userData dir.
- [ ] **Code signing + notarization** for the DMG *and* the AI PKG
      (per `mac_signing_notarization_plan.md`). Unsigned right-click-to-open is
      acceptable for free downloads, not for a ฿1,990 purchase.
- [ ] Release routine per `CLAUDE.md` (CHANGELOG → version bump → tag → dist → push).
- [ ] `BillNgai-2.0.0-universal.dmg` + AI PKG uploaded to **R2**; website download
      links flipped from 1.4.0 to 2.0.0.
- [ ] Website Pro dialog live (PromptPay ฿590 + LINE steps); LINE OA auto-reply
      or rich menu covers the "ซื้อ Pro" flow after hours.
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
  add-on zip are both live on R2. Remaining: end-to-end test of TOR → Invoice
  on a real Windows machine before advertising AI for Windows.
