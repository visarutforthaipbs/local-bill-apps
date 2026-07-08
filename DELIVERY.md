# BillNgai 2.0 — Delivery & Fulfillment

How the two packages reach customers. Companion to `PRD-2.0-LOCAL-PRO.md`
(§8 packaging, §25 entitlement) — this file is the operational side.

Core principle: **one DMG, one codebase — the license key decides the tier.**
Never ship separate Local/Pro builds; Local→Pro is "paste a key", not a reinstall.

---

## 1. The two products

| | BillNgai Local | BillNgai Pro |
|---|---|---|
| Price | ฿299–499 one-time | ฿1,990 one-time (launch price) |
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

Hosting: **Gumroad** (or Lemon Squeezy) — handles payment + file hosting.
Gumroad allows files up to 16GB (the AI PKG doesn't fit GitHub Releases' 2GB
cap comfortably). Buyers keep permanent access to the product page, which is
also the update channel (§5).

Storefront setup = two products:

- **BillNgai Local** — attach the DMG.
- **BillNgai Pro** — attach the DMG + AI PKG (or PKG link in the receipt);
  description states: **"รหัส Pro ส่งให้ทางอีเมลภายใน 24 ชม."**
  (manual key fulfillment is an expectation, not a surprise).

---

## 3. Per-sale fulfillment (Pro)

For every Pro sale notification:

```bash
npm run pro:license -- --email <buyer email>
```

1. Copy the printed key.
2. Reply to the buyer (email template below).
3. Log the sale — this spreadsheet **is** the customer database
   (keys are offline-verified and cannot be revoked remotely):

   | date | email | product | key (or key prefix) | order id | notes |
   |---|---|---|---|---|---|

Email template (Thai):

```text
เรื่อง: รหัส BillNgai Pro ของคุณ

ขอบคุณที่สนับสนุน BillNgai Pro!

รหัส Pro ของคุณ (คัดลอกทั้งบรรทัด):
<KEY>

วิธีเปิดใช้งาน:
1. เปิด BillNgai → ตั้งค่า → พื้นที่ทำงาน (Workspace)
2. กด "ดูแพ็กเกจ Pro" แล้ววางรหัสในช่อง → เปิดใช้งานรหัส

ดาวน์โหลด:
- ตัวแอป (ถ้ายังไม่มี): <DMG link>
- โมดูล AI สำหรับ TOR → Invoice: <PKG link> (ติดตั้งแล้วเปิดแอปได้เลย)

หมายเหตุ: ข้อมูลของคุณอยู่ในเครื่อง/Google Drive ของคุณเองเท่านั้น
BillNgai ไม่เก็บเอกสารลูกค้าบนเซิร์ฟเวอร์เรา
```

Local sales need no action — Gumroad delivers the DMG automatically.

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
- [ ] Gumroad products live; Pro page states the 24-hour key delivery.
- [ ] Selling-page copy uses PRD §24 landing text.
- [ ] `secrets/gdrive-oauth.json` present at build time (git-ignored, but
      packaged into the DMG via `build.files` — sync silently degrades to
      "not configured" if forgotten).
- [ ] Generate your own Pro key and dogfood for at least a week.

---

## 5. Updates & support

- **App updates**: buyers re-download from their Gumroad purchase page
  (files stay updated there). No auto-updater — announce updates via the
  selling page / LINE.
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
- Automated key delivery (webhook → make-license) — worth it above ~5 sales/day.
- Windows delivery — blocked on the Windows AI runtime work in `AI_ADDON_HANDOFF.md`.
