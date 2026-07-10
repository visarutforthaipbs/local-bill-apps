# แผน: BillNgai บน Mac App Store (Local + Pro ผ่าน In-App Purchase)

> สถานะ: ร่างเพื่อตัดสินใจ — ยังไม่เริ่มโค้ด
> เป้าหมาย: แอปเดียวบน Mac App Store — ดาวน์โหลดเป็น **Local**, อัปเกรดเป็น **Pro**
> ด้วย In-App Purchase (non-consumable, จ่ายครั้งเดียว) โดย **ไม่ทิ้งช่องทางเดิม**
> (DMG + PromptPay/LINE ยังขายต่อได้ตามปกติ — กลายเป็นสองช่องทางคู่กัน)

---

## 1. โมเดลราคา (ต้องตัดสินใจก่อนเริ่ม)

| ทางเลือก | Local | Pro | ข้อดี | ข้อเสีย |
|---|---|---|---|---|
| **A (แนะนำ)** | แอปฟรี | IAP ฿1,990 (หรือราคาเปิดตัวต่ำกว่า) | ยอดดาวน์โหลด/discovery สูงสุด — คนไทยค้น "ใบเสร็จ ใบกำกับภาษี" เจอแล้วลองได้เลย | Local ฟรีบน MAS แต่ DMG Local ขายเงิน → ต้องยอมรับว่า Local = ฟรีทุกช่องทางไปเลย |
| B | แอปเสียเงิน (เช่น ฿590) | IAP เพิ่ม | ตรงกับโมเดลปัจจุบัน | กำแพงราคาก่อนลอง → ดาวน์โหลดต่ำ, รีวิวแรก ๆ โหด |
| C | ฟรี + จำกัดจำนวนเอกสาร (เช่น 15 ใบ) | IAP ปลดล็อกไม่จำกัด + ฟีเจอร์ Pro | ลองก่อนจ่าย, ป้องกัน Local ฟรีกินยอด | ต้องเขียนระบบ limit ใหม่ + UX nag — ขัดกับแบรนด์ "ง่าย ไม่กวน" |

หมายเหตุ Apple หัก **15%** (Small Business Program, รายได้ < $1M/ปี — ต้องสมัคร) ·
ราคา IAP ต้องเลือกจาก price tier ของ Apple (มี ฿1,900 / ฿2,000 ให้เลือก ไม่มี ฿1,990 เป๊ะ)

**ผลกับลูกค้า Pro เดิม (ซื้อผ่าน LINE):** รหัส Ed25519 ใช้กับ MAS build ไม่ได้
(ช่องวางรหัสต้องถูกถอดออก — กติกา 3.1.1 ห้ามกลไกปลดล็อกอื่นนอกจาก IAP)
→ ลูกค้าเดิมใช้ DMG ต่อไปตามปกติ ไม่กระทบ แต่ต้องสื่อสารให้ชัดว่า "ซื้อที่ไหน ใช้ build นั้น"

---

## 2. Feature matrix — อะไรอยู่ / ปรับ / ตัด ใน MAS build

| ฟีเจอร์ | DMG (เดิม) | MAS build | งานที่ต้องทำ |
|---|---|---|---|
| เอกสาร/ภาษี/PromptPay QR/PDF/สำรองในเครื่อง | ✅ | ✅ เหมือนเดิม | — |
| เก็บข้อมูลในแอป (Application Support) | ✅ | ✅ (อยู่ใน sandbox container) | — |
| **เก็บเป็นไฟล์ใน Drive/Dropbox (external billing.json)** | ✅ | ⚠️ เลือกไฟล์ได้ แต่สิทธิ์หายตอนเปิดแอปใหม่ | ต้องทำ **security-scoped bookmarks** (เก็บ bookmark ใน config แล้ว resolve ตอน boot) — งาน main.js ~1–2 วัน หรือ**ตัดออกจาก MAS v1** ไปก่อน |
| ย้ายข้อมูลจากโฟลเดอร์ Billiong เดิม | ✅ | ❌ (sandbox อ่านนอก container ไม่ได้) | ปิดบน MAS — ผู้ใช้ MAS เป็นคนใหม่อยู่แล้ว |
| **AI TOR → Invoice (llama-cli)** | ✅ Pro | ❌ **ตัดออกทั้งฟีเจอร์** | sandbox ห้าม spawn binary ภายนอก — ซ่อนเมนู + เอาออกจากรายการขาย Pro บน MAS (ระยะยาวค่อยพิจารณา llama.cpp แบบ embed) |
| **Google Drive Workspace Sync** | ✅ Pro | ✅ ทำงานได้ | ต้องมี entitlement `network.client` + `network.server` (OAuth loopback 127.0.0.1 ใช้ได้ใน sandbox) — ทดสอบจริงก่อนส่งรีวิว |
| Keychain (token sync) ผ่าน safeStorage | ✅ | ✅ | — |
| **โมดัลอัปเกรด Pro (PromptPay/LINE + ช่องวางรหัส)** | ✅ | ❌ แทนด้วย **หน้า IAP**: ราคาโหลดจาก StoreKit + ปุ่มซื้อ + ปุ่ม **Restore Purchases** (Apple บังคับ) | งานหลักของโปรเจกต์นี้ |
| รหัส Pro แบบ Ed25519 | ✅ | ❌ ถอด UI ออก (โค้ด verify เก็บไว้ได้ ใช้ร่วมกับ DMG) | build flag |
| เมนู/ลิงก์ "ทักทาง LINE" เพื่อซื้อ | ✅ | ❌ ห้ามลิงก์ไปซื้อนอกระบบ | build flag |

---

## 3. งานเทคนิค (เรียงตามลำดับทำจริง)

### Phase 1 — Build flavor + Sandbox (2–3 วัน)
1. **ตัวแยก build**: Electron ตั้ง `process.mas === true` ให้อัตโนมัติใน mas build
   → ส่งผ่าน preload เป็น `billingAPI.isMas` — renderer ใช้ตัวเดียวนี้ gate ทุกอย่าง
   (เมนู AI, โมดัลอัปเกรด, การ์ด license, ลิงก์ LINE)
2. **Entitlements 2 ไฟล์** (`build/entitlements.mas.plist` + `entitlements.mas.inherit.plist`):
   `app-sandbox`, `network.client`, `network.server`,
   `files.user-selected.read-write`, team identifier
3. **package.json `build.mas`**: category, provisioning profile, entitlements, `type: distribution`
4. ปิด `migrateFromBilliong()` และซ่อน external-file UI (ถ้าเลือก defer bookmarks)
5. ทดสอบ: `npm run dist:mas` แล้วรันแบบ sandbox จริง — ไล่ทุกฟีเจอร์หลัก
   (จุดพังยอดฮิต: path นอก container, dialog, print, loopback server)

### Phase 2 — In-App Purchase (3–4 วัน)
1. ใช้ **Electron `inAppPurchase` API** (มีเฉพาะ mas build):
   - `getProducts(['pro'])` → ราคา/ชื่อ localize จาก App Store
   - `purchaseProduct('pro')` + listener `transactions-updated`
   - ปุ่ม **Restore Purchases** → `restoreCompletedTransactions()`
2. **ตรวจ receipt ในเครื่อง** (ปรัชญา local-first เหมือนเดิม — ไม่มีเซิร์ฟเวอร์เรา):
   อ่าน App Store receipt (PKCS#7) ใน bundle, verify กับ Apple Root CA,
   หา non-consumable `pro` → ตั้ง `PRO.valid = true`
   (ทางเลือกง่ายกว่า: เชื่อ transaction state + เก็บ flag ใน config — ป้องกันน้อยกว่า
   แต่แอปเราราคาไม่แพงและผู้ใช้กลุ่มนี้ไม่ใช่เป้า piracy — **เสนอทางง่ายก่อน**)
3. รวม 2 แหล่ง license: `license:status` คืน valid ถ้า *(Ed25519 key)* หรือ *(MAS receipt)*
4. หน้า upgrade ใหม่ (MAS): feature list เดิม **ลบบรรทัด AI ออก**, ราคา + ปุ่มซื้อ + restore
5. ทดสอบด้วย **Sandbox tester account** ใน App Store Connect

### Phase 3 — (เลือกทำ) Security-scoped bookmarks (1–2 วัน)
ให้ "เก็บเป็นไฟล์ใน Drive/Dropbox" ทำงานถาวรบน MAS —
เก็บ bookmark ตอน user เลือกไฟล์, `app.startAccessingSecurityScopedResource` ตอน boot
→ ถ้า defer: MAS v1 มีเฉพาะเก็บในแอป + export/import (ยังสำรอง/ย้ายเครื่องได้)

### Phase 4 — App Store Connect + ส่งรีวิว (1–2 วัน + รอรีวิว 1–3 วัน)
1. สมัคร **Small Business Program** (ลดค่าหัวจาก 30% → 15%)
2. สร้าง app record (bundle id `com.visarut.billngai`), IAP product `pro`,
   กรอกราคา/ภาษี/ข้อตกลงการเงิน (ครั้งแรกมี paperwork ภาษี US ด้วย)
3. Certificates: **Apple Distribution** + **Mac Installer Distribution** + provisioning profile
   (Developer ID เดิมใช้กับ MAS ไม่ได้)
4. **Privacy**: ต้องมีหน้า privacy policy URL (ยังไม่มี — เขียนสั้น ๆ hosting บน GitHub Pages ได้)
   · App Privacy questionnaire — จุดแข็งเรา: **"Data Not Collected"** ทั้งกระดาน
5. Metadata ไทย+อังกฤษ, screenshots (สัดส่วน 16:10), review notes อธิบาย demo flow
   (มีปุ่ม "ลองดูข้อมูลตัวอย่าง" อยู่แล้ว — reviewer ใช้ได้เลย ระบุใน notes)
6. อัปโหลด .pkg ผ่าน **Transporter** → TestFlight ทดสอบเอง → Submit

---

## 4. สิ่งที่เปลี่ยนถาวรในวิธีทำงาน (ยอมรับก่อนเริ่ม)

- **สอง build ต่อหนึ่งรีลีส**: `npm run dist` (DMG) + `npm run dist:mas` — เวอร์ชันต้องตรงกัน
- **Hotfix ไม่ทันใจ**: MAS ทุกอัปเดตรอรีวิว 1–3 วัน (DMG ยังปล่อยได้ทันทีเหมือนเดิม)
- **ฟีเจอร์ใหม่ต้องคิดเผื่อ sandbox เสมอ** (ห้าม spawn, ห้ามอ่านไฟล์นอก container)
- **ราคา/โปรโมชัน Pro สองช่องทางต้องสอดคล้อง** ไม่งั้นลูกค้างง (LINE ฿590 vs IAP ฿1,990?)
  — แนะนำ: ทำ Early Bird tier บน IAP ให้ใกล้เคียงกันช่วงเปิดตัว

## 5. ความเสี่ยงที่ควรรู้

| ความเสี่ยง | ระดับ | ทางลด |
|---|---|---|
| รีวิวแรกโดน reject (metadata/สิทธิ์/UX) | กลาง — ปกติของรอบแรก | อ่าน rejection แล้วแก้ส่งใหม่ วนได้ ไม่มีบทลงโทษ |
| Drive sync (loopback OAuth) เจอปัญหาใน sandbox บนเครื่องลูกค้า | กลาง | ทดสอบ TestFlight ก่อน + มี fallback ข้อความแนะนำ |
| Reviewer ตีความ Drive sync ว่าต้องใช้ Sign in with Apple | ต่ำ (login เพื่อ sync ไฟล์ผู้ใช้เอง ไม่ใช่บัญชีแอป) | อธิบายใน review notes |
| Electron app โดนมองเป็น "เว็บห่อกล่อง" | ต่ำ (UI native-feel, มีเมนู/พิมพ์/ไฟล์ครบ) | screenshots เน้น workflow จริง |

## 6. สรุปการตัดสินใจที่ต้องการจากเจ้าของ

1. โมเดลราคา: **A ฟรี+IAP** / B จ่ายก่อน+IAP / C ฟรีจำกัดจำนวน+IAP
2. ราคา Pro IAP (tier ใกล้ ฿1,990) + จะมี intro price ช่วงเปิดตัวไหม
3. External billing.json บน MAS: ทำ bookmarks เลย (Phase 3) หรือตัดออกจาก v1
4. ตรวจ receipt: แบบเต็ม (PKCS#7 verify) หรือแบบง่าย (เชื่อ transaction + config flag)

**ประมาณเวลารวม: ~7–10 วันทำงาน + รอรีวิว** (ไม่รวม paperwork ภาษี App Store Connect ครั้งแรก)
