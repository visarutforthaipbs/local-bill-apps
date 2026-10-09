# BillNgai — SKU & Channel Design (ร่างเพื่อตัดสินใจ)

## Current override — 2026-10-09, App Store only

บล็อกลงวันที่นี้มีผลเหนือทุกส่วนด้านล่าง (override 2026-09-24 และ §1–§7) และเหนือ `PRD-2.0-LOCAL-PRO.md`
**ที่มาของการตัดสินใจคือ `PRD-SIMPLIFY-2026-10.md` §4** — ถ้าข้อความในไฟล์นี้ขัดกับ PRD ให้ยึด PRD เสมอ
เจ้าของอนุมัติทิศทางเมื่อ 2026-10-09 ("agree") รุ่นเป้าหมายคือ 2.0.15 บน Mac App Store + iOS App Store
(เจ้าของอาจเปลี่ยนเลขเป็น 2.1.0 ก่อนส่งรีวิว โดยไม่มีอะไรอื่นเปลี่ยน)

สถานะ: ยังไม่มีรุ่นใดเผยแพร่ภายใต้ override นี้ ทุกอย่างด้านล่างคือแผน ไม่ใช่สิ่งที่เกิดขึ้นแล้ว

### SKU ที่เหลือ (2 ตัว)

| SKU | สินค้า | ช่องทาง | ราคา | การปลดล็อก |
|---|---|---|---|---|
| `BN-LOCAL-AS` | BillNgai (แพ็กเกจฟรี) | Mac App Store · iOS App Store (iPhone/iPad) | **ฟรี** | ดาวน์โหลด = ใช้ได้เลย ไม่ต้องมีบัญชี |
| `BN-PRO-AS` | BillNgai Pro | In-app purchase `com.visarut.billngai.pro` (non-consumable, universal ซื้อครั้งเดียวใช้ได้ทั้ง Mac/iPhone/iPad) | ฿599 Early Bird → ฿1,900 (Apple tier, **ไม่เปลี่ยน**) | StoreKit · กู้คืนการซื้อได้ทุกเครื่องที่ใช้ Apple ID เดียวกัน |

ทั้งสอง SKU อยู่บน record Apple เดิม: app `6789503350`, Apple SKU `billngai-mas`, bundle `com.visarut.billngai`,
team `79QFYKTJMN` — ไม่มี record หรือสินค้าใหม่ (`BN-LOCAL-MAS`/`BN-PRO-MAS` ในตาราง §2 เดิมคือของชิ้นเดียวกัน
แค่เปลี่ยนรหัสเรียกเป็น `-AS` เพราะตอนนี้ครอบคลุม iOS ด้วย)

### SKU ที่เลิกแล้ว

| SKU เดิม | สถานะ | หมายเหตุ |
|---|---|---|
| `BN-LOCAL-MAC` (DMG จาก R2) | เลิก หลัง DMG รุ่นสุดท้าย 2.0.15 | DMG รุ่นสุดท้ายมีแค่ปุ่มส่งออกเพื่อย้ายไป App Store (PRD §5) |
| `BN-LOCAL-WIN` (Windows beta) | เลิกทันที | ไม่เคยออกจาก beta ไม่มีบิลด์ Windows อีก |
| `BN-PRO-KEY` (รหัส Ed25519 ขายผ่านเว็บ/LINE) | เลิกขาย | รหัสเดิมยังใช้กับ DMG รุ่นสุดท้ายได้ ผู้ถือรหัสย้ายไป App Store ด้วย promo code (ด้านล่าง) |
| `BN-AI-ADDON` (AI TOR → Quotation) | ถอดออกจากแอป | ไม่มีช่องทางไหนมีอีก โฟลเดอร์ add-on ที่ติดตั้งไว้แอปไม่ลบให้ |

### ไทม์ไลน์การเปลี่ยนผ่าน (PRD §4.2)

1. **2.0.15 store release** — แอปที่ตัดฟีเจอร์แล้ว + HIG restyle ส่ง Mac App Store และ TestFlight → App Store (iOS)
2. **2.0.15 final direct DMG** — source เดียวกัน build แบบตรง มีการ์ด "ย้ายไป App Store" ใน ตั้งค่า → ข้อมูลและสำรอง
   และข้อความ "รุ่นต่อไปจะมีใน App Store เท่านั้น" อัปโหลดลิงก์ R2/Pages เดิมครั้งเดียว แล้วไม่มีบิลด์ตรงอีก
3. **Retirement release (2.0.16 ขึ้นไป, store เท่านั้น)** — ถอดการตรวจ `licenseKey`, สคริปต์ `dist`/`dist:unsigned`/`dist:win`
   และ notarisation, ย้าย `DELIVERY.md`/`WINDOWS-*.md` ไป `review/archive/` หน้าเว็บเหลือปุ่ม "Download on the App Store" ปุ่มเดียว
   (วันปิดลิงก์ดาวน์โหลดตรง: รอเจ้าของกำหนด — PRD §9 เสนอ 60 วันหลัง store release)

### นโยบาย promo code (PRD §0 "Existing lifetime-key holders", §4.3)

- ลูกค้าที่ถือรหัส Pro ช่องทางตรง (`BN-PRO-KEY`) ได้ **App Store promo code สำหรับ IAP Pro** ฟรี 1 รหัสต่อคน
  ไม่คืนเงิน ไม่ให้จ่ายซ้ำ — Apple ให้สร้างได้สูงสุด 100 รหัสต่อเวอร์ชัน ซึ่งพอสำหรับฐานลูกค้าปัจจุบัน
- Pro ที่ซื้อผ่าน App Store อยู่แล้ว ไม่ต้องทำอะไร กู้คืนการซื้อบน iPhone/iPad ได้เลย
- การสร้าง promo code ใน App Store Connect, การตรวจหลักฐานการซื้อเดิม และการส่งรหัสให้ลูกค้า **เป็นของเจ้าของเท่านั้น**
  agent เตรียมได้แค่รายชื่อผู้มีสิทธิ์ (จาก sales log) และร่างข้อความ — ดู `review/2026-10-09/SIMPLIFY-OWNER-CHECKLIST.md`
- นโยบายเดิม "MAS Pro ขอรหัสตรงฟรีเพื่อใช้ AI" (§5, §6.C) **ยกเลิก** เพราะ AI add-on ถูกถอดแล้ว

### สิ่งที่ไม่เปลี่ยนใน override นี้

ราคา Pro, record Apple เดิม, สิทธิ์ Pro ของผู้ที่ซื้อผ่าน App Store ไปแล้ว, กติกา 3.1.1 (ห้ามพูดราคา/ช่องทางอื่นใน
store build และ metadata) การตัดสินใจเรื่องเงิน การคืนเงิน และข้อความถึงลูกค้ายังเป็นของเจ้าของทั้งหมด

---

## Superseded override — 2026-09-24, Direct macOS 2.0.3 released (replaced by the 2026-10-09 block above)

This dated containment scope takes precedence over older feature promises below
and the 2.0 PRD. Published installer evidence is in `RELEASE-2.0.3.md`.
Local remains free; Pro remains ฿599 Early Bird → ฿1,900. No new pricing, refunds,
license-key actions or customer messages are authorized by the release request.

| 2.0.3 Direct macOS capability | Local | Pro |
|---|---|---|
| Ordinary non-VAT THB full-payment receipts after explicit checks | Available | Available |
| Quotations/invoices, supported PDF, local backup/export | Available | Available |
| Income classification and limited bookkeeping summary | Available | Available |
| New tax invoices / registered-seller receipts | Unavailable | Unavailable |
| PIT payable/refund estimates, custom e-Tax XML | Paused | Paused |
| Cloud connect/sync/restore | Paused | Paused |
| AI quotation-draft add-on | Not unlocked | Existing entitlement; not revalidated by receipt tests |

Partial/deposit/refund and foreign-currency receipt workflows are unsupported.
Legacy documents without original snapshots are retained but not authoritatively
reprinted. External/shared-file storage is not validated concurrent-device sync.
See `PRD-2.0.3.md` and `FAQ.md` for the complete boundary. Existing Pro customer
handling remains an owner decision; do not promise a reopening date or refund.

Release authority currently covers Direct macOS and its website only. MAS and
Windows remain pending, not updated by this release. Preserve shared app SemVer
policy and new MAS build numbers when subsequently porting; preserve StoreKit and
sandbox differences. Follow `DEPLOYMENT.md` for exact-artifact checks before upload.
No cross-channel new-feature announcement or MAS submission is authorized here.

> **[ประวัติ — superseded 2026-10-09]** ส่วนที่ 1–7 ด้านล่างเก็บไว้เป็นบันทึกการตัดสินใจเดิม ไม่ใช่ source of truth อีกต่อไป
> ให้ยึด override 2026-10-09 ด้านบนและ `PRD-SIMPLIFY-2026-10.md` §4
>
> เพิ่มช่องทาง Mac App Store แล้ว โครงสินค้าเปลี่ยนจาก "2 แพ็กเกจ 1 ช่องทาง"
> เป็น "2 แพ็กเกจ × 3 ช่องทาง" — ไฟล์นี้คือ source of truth ของ SKU ทั้งหมด
> คู่กับ `PRD-2.0-LOCAL-PRO.md` (สินค้า) และ `DELIVERY.md` (ปฏิบัติการช่องทางตรง)
> ฝั่ง MAS: `BillNgai-MAS-Pilot/HANDOFF-MAS.md`

---

## 1. หลักการตั้งต้น (อ่านก่อนดูตาราง) — superseded 2026-10-09

1. **สอง branch แยกกันจริง ไม่ใช่โค้ดเดียว+flag** (แก้ไขคำอธิบาย 2026-07-12 ให้ตรงความจริง) —
   `main` (Direct) และ `mas-pilot` (App Store) เป็นคนละ git branch/worktree ที่มี `billing.html`
   แยกกันจริง ไม่ได้ build จาก source เดียวกันด้วย `IS_MAS` flag ตอน build อย่างที่เคยเข้าใจ —
   `IS_MAS` เป็น runtime check ที่มีอยู่ **เฉพาะภายใน `mas-pilot` fork เอง** เท่านั้น `main` ไม่มี
   `IS_MAS`/โค้ด MAS เลย
   **นัยสำคัญ:** แก้โค้ดบน `main` ต้อง merge เข้า `mas-pilot` ด้วยมือเสมอ (ตาม §7) — merge
   ไม่ได้ตัดโค้ดที่ MAS ห้ามให้อัตโนมัติ ต้องตรวจทุกครั้งว่าไม่มีโค้ด/string ที่พูดถึงช่องทางตรง
   (ราคา, ลิงก์ LINE, ช่องวางรหัส) หลุดเข้าไปใน `mas-pilot` แม้จะ gate ด้วย `if (!IS_MAS)` ก็ตาม
   เพราะ string ยังติดไปกับ `app.asar` แม้โค้ดจะรันไม่ถึง — โค้ดสำหรับช่องทางตรงต้องไม่มีอยู่ใน
   source ของ `mas-pilot` เลย ไม่ใช่แค่ gate ด้วย runtime flag (บทเรียนจากเหตุการณ์ 3.1.1
   dead-code 2026-07-12 — ดู `app-store-reject-playbook.md`)
2. **Local = ตัวแอป, Pro = สิทธิ์** — ทุกช่องทางขายของเดียวกัน ต่างกันที่วิธีปลดล็อกและวิธีจ่าย
3. **License ผูกช่องทาง ไม่ข้ามกัน** — รหัส Ed25519 ใช้กับ build ตรงเท่านั้น ·
   การซื้อใน App Store ผูก Apple ID ใช้กับ build MAS เท่านั้น (ดู §5 นโยบายช่วยลูกค้าข้ามช่อง)
4. **เรื่องเงินพูดได้ทุกที่ ยกเว้นใน MAS build** — เว็บ/LINE/โซเชียลพูดราคา-โปรโมชันได้เต็มที่
   แต่ใน MAS build ห้ามมีลิงก์ซื้อภายนอกหรือพูดถึงช่องทางอื่น (กติกา 3.1.1)

---

## 2. ตาราง SKU (ทั้งหมด 6 ตัว) — superseded 2026-10-09, เหลือ 2 ตัวตาม override ด้านบน

| SKU code | สินค้า | ช่องทาง | ราคา (Early Bird → เต็ม) | รูปแบบ | การปลดล็อก |
|---|---|---|---|---|---|
| `BN-LOCAL-MAS` | BillNgai Local | Mac App Store | **ฟรี** | .pkg ผ่าน App Store | ดาวน์โหลด = ใช้ได้เลย |
| `BN-PRO-MAS` | BillNgai Pro | Mac App Store (IAP) | ฿599 → ฿1,900 (Apple tier) | IAP non-consumable `com.visarut.billngai.pro` | StoreKit → ผูก Apple ID |
| `BN-LOCAL-MAC` | BillNgai Local | เว็บ (DMG, notarized) | **ฟรี** (ตัดสินใจแล้ว 2026-07-12 — ดู §6.A) | DMG จาก R2 | ดาวน์โหลด = ใช้ได้เลย |
| `BN-LOCAL-WIN` | BillNgai Local | เว็บ (Windows) | **ฟรี** | exe/installer จาก R2 | ดาวน์โหลด = ใช้ได้เลย |
| `BN-PRO-KEY` | BillNgai Pro | เว็บ + LINE OA | ฿599 → ฿1,900 (ตัดสินใจแล้ว 2026-07-12 — ดู §6.B) | รหัส Ed25519 (per-buyer) | วางรหัสใน ตั้งค่า → Workspace (mac + win) |
| `BN-AI-ADDON` | AI TOR → Quotation | แถมกับ `BN-PRO-KEY` (mac เท่านั้น) | รวมใน Pro ตรง | PKG ~2GB จาก R2 | manifest เซ็นแล้ว ตรวจในแอป |

หมายเหตุ: `BN-AI-ADDON` ไม่ใช่ SKU ขายแยก — เป็น **ตัวสร้างความต่างของช่องทางตรง** (ดู §4)

---

## 3. ราคาและความสอดคล้องระหว่างช่องทาง — superseded 2026-10-09 (ราคาเดิม แต่เหลือช่องทางเดียว)

**ตัดสินใจแล้ว 2026-07-12 (คำถาม B):** เลิกใช้ตัวเลขคนละชุดต่อช่องทาง — ทั้งสองช่องทางใช้ราคา
เดียวกันเป๊ะ ชนตามเลข MAS tier (Apple บังคับ price tier อยู่แล้ว เลขนี้ใกล้ ฿590/฿1,990 เดิมที่สุด):

| | ช่องทางตรง (LINE) | Mac App Store | เข้ากระเป๋าจริง |
|---|---|---|---|
| Pro Early Bird | ฿599 | tier ฿599 | ตรง ฿599 เต็ม · MAS ~฿509 (หัก 15%) |
| Pro ราคาเต็ม | ฿1,900 | tier ฿1,900 | ตรง ฿1,900 เต็ม · MAS ~฿1,615 (หัก 15%) |

**นโยบาย:** ราคาหน้าร้านสองช่อง "เท่ากันในสายตาลูกค้า" เสมอ — ตอนนี้เท่ากันตัวเลขต่อตัวเลข
ไม่ใช่แค่ในกรอบ ±฿10 อีกต่อไป เพราะช่องทางตรงปรับมาชน MAS tier ตรง ๆ แล้ว — อย่าตั้ง MAS
แพงกว่าเพื่อชดเชยค่าหัว Apple เพราะ (1) ลูกค้า MAS ไม่รู้จักช่องทางตรงอยู่แล้ว (2) ราคาไม่เท่ากัน
จะย้อนมาเป็นดราม่าถ้ามีคนเจอทั้งสองช่อง ค่าหัว 15% คือ **ค่าการตลาด/discovery**
- Early Bird ยังไม่ปิด — เปิดค้างไว้จนกว่า MAS จะผ่านรีวิวและขึ้นขายจริง แล้วให้ MAS มีรันเวย์ EB
  อย่างน้อย ~2-3 สัปดาห์ ก่อนปิดพร้อมกันทั้งสองช่อง (ที่มา: biz-analyst weekly review 2026-W28)
  (MAS เปลี่ยน tier ได้ทันทีใน App Store Connect ไม่ต้องออก build ใหม่)

---

## 4. Historical 2.0 feature matrix — superseded 2026-10-09 (AI/Windows/ช่องทางตรงถูกถอด)

| ฟีเจอร์ | Local (ทุกช่อง) | Pro MAS | Pro ตรง (mac) | Pro ตรง (win) |
|---|---|---|---|---|
| เอกสาร/ภาษีไทยครบ, PromptPay QR, PDF, สำรองในเครื่อง | ✅ | ✅ | ✅ | ✅ |
| Google Drive Workspace Sync | — | ✅ | ✅ | ✅ |
| สำรองคลาวด์อัตโนมัติ + กู้คืนเครื่องใหม่ | — | ✅ | ✅ | ✅ |
| ประเภทเงินได้ (มาตรา 40) + สรุปตามประเภท | — | ✅ | ✅ | ✅ |
| Conflict protection ฟิลด์การเงิน | — | ✅ | ✅ | ✅ |
| **AI TOR → Quotation (ออฟไลน์)** | — | ❌ (sandbox) | ✅ | ❌ (ยังไม่มี win) |
| เก็บข้อมูลเป็นไฟล์ภายนอก (Drive/Dropbox folder) | ✅ ตรง / ❌ MAS | ❌ (รอ bookmarks) | ✅ | ✅ |
| ย้ายเครื่อง/ติดตั้งใหม่ | ดาวน์โหลดใหม่ | ผูก Apple ID อัตโนมัติ | วางรหัสเดิม | วางรหัสเดิม |

**ข้อความ positioning ต่อช่องทาง (สำหรับเว็บ/โซเชียล — ไม่ใช่ใน MAS build):**
- Mac App Store = "โหลดง่าย อัปเดตอัตโนมัติ ซื้อผ่าน Apple"
- ช่องทางตรง = "ครบกว่า: มี AI แปลง TOR + เลือกที่เก็บไฟล์เองได้ + เวอร์ชัน Windows"

---

## 5. กลไก license และนโยบายข้ามช่องทาง — superseded 2026-10-09 (ดูนโยบาย promo code ด้านบน)

- **ตรง:** `npm run pro:license -- --email <buyer>` → รหัส Ed25519 → ส่งทาง LINE
  (โฟลว์เดิมตาม `DELIVERY.md` ไม่เปลี่ยน)
- **MAS:** StoreKit transaction → `masPro` flag ใน config — ไม่มีรหัสให้ส่ง, restore ได้เองทุกเครื่อง
- **นโยบายข้ามช่องทาง (ตัดสินใจแล้ว 2026-07-12 — คำถาม C):**
  - ลูกค้า MAS Pro อยากได้ AI → **แจกรหัสตรงฟรี** เมื่อส่งหลักฐานการซื้อ (สกรีนช็อต
    ใบเสร็จ Apple ทาง LINE) — เขาจ่ายเต็มแล้ว อย่าให้จ่ายซ้ำ ต้นทุนเรา = คีย์หนึ่งดอก
  - ลูกค้า Pro ตรง ย้ายไปใช้ MAS build → ไม่มีทางใส่รหัสใน MAS (Apple ห้าม UI นั้น)
    → แนะนำให้ใช้ DMG ต่อ (ฟีเจอร์ครบกว่าอยู่แล้ว) — ระบุในเพจ FAQ
- ห้ามทำ "ตรวจ receipt MAS ใน DMG build" หรือกลไกข้ามอัตโนมัติ — ซับซ้อนเกินมูลค่า

---

## 6. คำถามที่ตัดสินใจแล้ว (เจ้าของ, 2026-07-12) — superseded 2026-10-09

ที่มา: biz-analyst weekly numbers + chief-of-staff decision memo
(`reviews/2026-W28-decision-memo.md`) — เจ้าของตัดสินใจทั้ง 4 ข้อพร้อมกัน

**A. `BN-LOCAL-MAC/WIN` เมื่อ MAS ฟรี → ✅ Local ฟรีทุกช่องทาง**
   เลิก honor system ฿59 — เรื่องเล่าสะอาด "แอปฟรี Pro คือสินค้า" เว็บกลายเป็น funnel เดียวกันเข้า Pro
   (0/8 ผู้ซื้อ Local เดิมอัปเกรดเป็น Pro อยู่แล้ว — แทบไม่เสียรายได้จริง)

**B. ราคา Pro → ✅ EB ฿599 → เต็ม ฿1,900 ทั้งสองช่องทาง**
   ปรับช่องทางตรงจาก ฿590/฿1,990 เดิม มาชนเลข MAS tier ตรง ๆ — ดู §3 สำหรับตารางราคาที่อัปเดตแล้ว

**C. "MAS Pro ขอรหัสตรงฟรีเพื่อใช้ AI" (§5) → ✅ ยืนยัน**
   ต้นทุนเรา = คีย์หนึ่งดอก เทียบกับลูกค้าที่จ่ายเต็มแล้วต้องจ่ายซ้ำ

**D. Windows เป็น SKU จริงจังไหม → ✅ ยังเป็น beta แจกเงียบ ๆ**
   รอ Windows AI end-to-end test บนเครื่องจริงให้ผ่านก่อน (ยังเป็น P1 todo ใน BACKLOG.md)
   ค่อยพิจารณาขึ้นเป็นหน้า download ทางการ

## 7. Release discipline ต่อรีลีส (สรุปสั้น) — superseded 2026-10-09 (เหลือ store build เดียว)

1. แก้โค้ดบน `main` → merge เข้า `mas-pilot`
2. Version เดียวกันทุกช่องทาง (SemVer ใน package.json) · MAS bump `buildVersion` ทุกครั้งที่อัปโหลด
3. บิลด์ 3 ก้อน: `npm run dist` (DMG) · PC: `--win` (exe) · pilot: `npm run dist:mas` (pkg)
4. DMG/exe ขึ้น R2 + อัปเดตเว็บ — ทันที · MAS ผ่านรีวิว 1–3 วัน → **อย่าประกาศฟีเจอร์ใหม่
   จนกว่า MAS ผ่านรีวิว** (กันลูกค้าสองช่องเห็นของไม่เท่ากันตอนประกาศ)
5. CHANGELOG เดียว ใส่หมายเหตุ `(Direct only)` / `(App Store only)` เมื่อจำเป็น
