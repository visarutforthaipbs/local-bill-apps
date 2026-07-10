# คู่มือตั้งค่า App Store (ทำครั้งเดียว) — BillNgai MAS

> ทำตามลำดับ — แต่ละขั้นบอกหน้าจอที่ต้องเปิดชัด ๆ ใช้ Apple ID ของ Developer Program
> เสร็จแต่ละขั้นกลับมาบอก Claude ได้เลย จะได้ต่อขั้นถัดไป/แก้ปัญหาให้

## ขั้น 0 — ข้อตกลง Paid Apps (ทำก่อน ไม่งั้น IAP สร้างไม่ได้)
1. เปิด https://appstoreconnect.apple.com → **Business** (หรือ Agreements, Tax, and Banking)
2. ที่ **Paid Apps** กด Request/Set Up → ยอมรับข้อตกลง → กรอก:
   - **Bank Account** (บัญชีไทยได้ — ต้องมี SWIFT ของธนาคาร)
   - **Tax Forms**: แบบฟอร์มภาษีสหรัฐ (บุคคลธรรมดาไทย = W-8BEN, กรอกออนไลน์ ~5 นาที)
3. สถานะต้องเป็น **Active** (อาจใช้เวลา 1–2 วันหลังกรอกครบ) — ระหว่างรอทำขั้นอื่นได้

## ขั้น 1 — App ID (Identifier)
1. เปิด https://developer.apple.com/account → **Certificates, IDs & Profiles** → **Identifiers** → ปุ่ม **+**
2. เลือก **App IDs** → Continue → type **App**
3. กรอก:
   - Description: `BillNgai`
   - Bundle ID: **Explicit** → `com.visarut.billngai`
   - Capabilities: ติ๊ก **In-App Purchase** (ปกติติ๊กให้อยู่แล้ว)
4. Continue → Register

## ขั้น 2 — Certificates 2 ใบ
> ต้องมี CSR ก่อน: เปิด **Keychain Access** → เมนู Keychain Access → Certificate Assistant →
> **Request a Certificate From a Certificate Authority…** → ใส่อีเมล เลือก **Saved to disk** → Save

1. หน้า **Certificates** → **+** → เลือก **Apple Distribution** → อัปโหลด CSR → Download
2. **+** อีกครั้ง → เลือก **Mac Installer Distribution** → อัปโหลด CSR เดิมได้ → Download
3. ดับเบิลคลิกไฟล์ .cer ทั้งสองให้เข้า Keychain (login)
4. เช็ค: `security find-identity -v` ต้องเห็น `Apple Distribution: Visarut Sankham` และ
   `3rd Party Mac Developer Installer` (ชื่อเดิมของ Mac Installer Distribution)

## ขั้น 3 — Provisioning Profile
1. หน้า **Profiles** → **+**
2. เลือก **Mac App Store Connect** (อยู่หมวด Distribution — บางหน้าเรียก "Mac App Store")
3. เลือก App ID `com.visarut.billngai` → เลือก cert **Apple Distribution** ที่เพิ่งสร้าง
4. ตั้งชื่อ `BillNgai MAS` → Generate → **Download**
5. ย้ายไฟล์มาไว้ที่ `BillNgai-MAS-Pilot/build/embedded.provisionprofile`
   (ชื่อไฟล์ต้องเป๊ะ — package.json ชี้ path นี้แล้ว)

## ขั้น 4 — สร้างแอปใน App Store Connect
1. https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**
2. กรอก:
   - Platforms: **macOS**
   - Name: `BillNgai — บิลง่าย`
   - Primary Language: **Thai**
   - Bundle ID: เลือก `com.visarut.billngai`
   - SKU: `billngai-mas`
3. Create → เข้าหน้าแอป → กรอกตาม **STORE-LISTING.md** (Category, Description, Keywords,
   Privacy Policy URL, Support URL) — Screenshots ค่อยอัปโหลดทีหลังได้

## ขั้น 5 — In-App Purchase
1. หน้าแอปใน App Store Connect → เมนูซ้าย **Monetization → In-App Purchases** → **+**
2. Type: **Non-Consumable**
3. Reference Name: `BillNgai Pro` · Product ID: `com.visarut.billngai.pro`
   ⚠️ Product ID ต้องตรงนี้เป๊ะ — โค้ดฝังค่านี้ไว้ (IAP_PRO_ID ใน main.js)
4. Price: เลือก tier ใกล้ ฿1,900
5. Localization ไทย+อังกฤษ: ชื่อ/คำอธิบายตาม STORE-LISTING.md
6. Review screenshot: ภาพโมดัลอัปเกรด (จาก `npm run start:mas-dev`)
7. สถานะจะเป็น "Ready to Submit" — IAP ตัวแรกต้องส่งรีวิวพร้อมแอปเวอร์ชันแรก

## ขั้น 6 — Sandbox Tester (ไว้ทดสอบซื้อจริงแบบไม่เสียเงิน)
1. App Store Connect → **Users and Access** → แท็บ **Sandbox** → Testers → **+**
2. สร้างบัญชีด้วยอีเมลที่ไม่เคยเป็น Apple ID (ใช้ trick `visarut298+sandbox@gmail.com` ได้)
3. บนเครื่อง Mac ที่ทดสอบ: System Settings → App Store → Sandbox Account → ล็อกอินตัวนี้

## ขั้น 7 — Small Business Program (ลดค่าหัว 30% → 15%)
1. https://developer.apple.com/app-store/small-business-program/ → Enroll
2. เงื่อนไข: ข้อตกลง Paid Apps ต้อง Active ก่อน (ขั้น 0) — สมัครแล้วมีผลรอบถัดไป

## ขั้น 8 — Build จริง + อัปโหลด (Claude ช่วยรันให้ได้)
```bash
cd BillNgai-MAS-Pilot
npm run dist:mas          # ได้ dist/BillNgai-<version>-universal.pkg (เซ็นด้วย cert ขั้น 2 + profile ขั้น 3)
```
1. อัปโหลดด้วยแอป **Transporter** (โหลดจาก Mac App Store) — ลาก .pkg เข้าแล้วกด Deliver
2. รอ Processing (~30 นาที) → ทดสอบผ่าน **TestFlight** (แท็บ TestFlight ในหน้าแอป)
3. ทดสอบบนเครื่องจริง: sandbox purchase (ขั้น 6), Drive sync, พิมพ์/PDF, สำรอง/กู้คืน
4. หน้าแอป → เลือก build → **Submit for Review**

## เช็คลิสต์ก่อน Submit
- [ ] Paid Apps agreement = Active
- [ ] Privacy Policy URL ออนไลน์แล้ว (docs/privacy.html — เปิด GitHub Pages)
- [ ] Screenshots ≥ 1 ภาพ (แนะนำ 6 ตาม STORE-LISTING.md)
- [ ] IAP แนบไปกับ build แรก (เลือกใน version page → In-App Purchases)
- [ ] Review Notes วางจาก STORE-LISTING.md
- [ ] App Privacy questionnaire: **Data Not Collected** (ตอบตามจริง — เราไม่เก็บอะไรเลย)
- [ ] ทดสอบ sandbox purchase + restore บน build จริงแล้ว
