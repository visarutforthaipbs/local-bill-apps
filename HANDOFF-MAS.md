# HANDOFF — BillNgai Mac App Store SKU (สถานะ ณ 2026-07-10 เย็น)

> เอกสารส่งต่อสำหรับ agent/เซสชันถัดไป — อ่านไฟล์นี้ก่อนแตะอะไรในโปรเจกต์นี้
> เจ้าของ: Visarut (คุยไทย/อังกฤษปน) · กติกา agent อยู่ใน `AGENTS.md`, `CLAUDE.md`, `BRAND.md`

## ภาพรวม 30 วินาที

BillNgai มี **สอง SKU สองที่**:
- **DMG + Windows (ช่องทางเดิม, ขาย Pro ผ่าน LINE/PromptPay)** → worktree `../Billiong-App`, branch `main`, ล่าสุด v2.0.1 (tag `v2.0.1` push แล้ว)
- **Mac App Store (SKU ใหม่, Pro = In-App Purchase)** → worktree นี้ (`BillNgai-MAS-Pilot`), branch `mas-pilot` (push แล้ว)

**สถานะตอนจบเซสชัน:** build **2.0.1 (CFBundleVersion 2.0.2)** อัปโหลดผ่าน Transporter
**สำเร็จแล้ว** (Delivery UUID `41f59bd3-07f6-4c9b-8511-fd63beeb7b72`) — สถานะ `PROCESSING` ฝั่ง Apple
รอโผล่ในแท็บ TestFlight ของ App Store Connect

## สิ่งที่เสร็จแล้ว

### โค้ด (ทั้งหมดอยู่บน branch `mas-pilot`)
- ตัวแยก build เดียว: `IS_MAS` (จาก `process.mas`; dev preview = `npm run start:mas-dev`
  ซึ่งตั้ง `BILLNGAI_FAKE_MAS=1` + โฟลเดอร์ข้อมูลแยก `BillNgai-MAS-Dev`)
- **IAP**: Electron `inAppPurchase`, product id `com.visarut.billngai.pro` (non-consumable,
  hardcode ใน main.js เป็น `IAP_PRO_ID`) — ซื้อ/restore → `cfg.masPro` ใน config.json →
  `license:status` คืน valid (รวมกับเส้นทาง Ed25519 เดิมของ DMG ที่ไม่แตะเลย)
- **ตัดออกจาก MAS build**: ลิงก์ซื้อ LINE, ช่องวางรหัส Pro, ฟีเจอร์ AI ทั้งก้อน
  (sandbox spawn llama-cli ไม่ได้), external billing.json (รอ security-scoped bookmarks
  = Phase 3 ใน PLAN-MAC-APP-STORE.md), `migrateFromBilliong()`
- Entitlements: `build/entitlements.mas.plist` = app-sandbox + network.client +
  network.server (OAuth loopback ของ Drive sync) + user-selected files
  **+ `cs.allow-jit` + `cs.allow-unsigned-executable-memory` (V8 ต้องใช้ —
  ถอดออกแล้วแอป crash ตอนเปิดใน v8::Isolate::Initialize, เจอใน TestFlight build 2.0.2)**
  · ตัวเดียวที่ห้ามมีคือ `cs.allow-dyld-shared-cache` (โดน ITMS-90285)
- ทดสอบ: harness 13 เคส MAS gating + 16 เคส regression (ดูประวัติ commit)

### บิลด์และอัปโหลด (บทเรียนราคาแพง — อย่าทำซ้ำ)
- คำสั่งบิลด์: `npm run dist:mas` (= `electron-builder --mac mas --universal`) →
  `dist/mas-universal/BillNgai-<ver>-universal.pkg`
- **ก่อนบิลด์ครั้งแรกใน worktree ใหม่ต้องรัน `npx electron make-icon.js`**
  (build/icon.icns ถูก gitignore — ไม่มีแล้วได้ไอคอน Electron เปล่า)
- upload รอบ 1 ❌ ITMS-90285: entitlements มี `cs.allow-dyld-shared-cache`
- upload รอบ 2 ❌ ITMS-90257: `CFBundleVersion` เกิน 3 ตัวเลข (2.0.1.1) → ใช้ `buildVersion`
- upload รอบ 3 (build 2.0.2) ✅ ผ่าน validation แต่ ❌ **crash ตอนเปิดใน TestFlight**
  เพราะตอนแก้รอบ 1 ถอด cs.* ออกหมด — V8 ขาด allow-jit → คืน allow-jit +
  allow-unsigned-executable-memory แล้ว (build 2.0.3)
- **รี-อัปโหลดครั้งถัดไปต้อง bump `buildVersion` เสมอ**
- codesign/บิลด์ต้องรัน **นอก sandbox ของ Bash tool** (dangerouslyDisableSandbox)
  ไม่งั้น "internal error in Code Signing subsystem"

### App Store Connect (ฝั่งเจ้าของทำแล้ว)
- App record: **BillNgai — บิลง่าย**, Apple ID `6789503350`, bundle `com.visarut.billngai`
- Certs ในเครื่องนี้: Apple Distribution + 3rd Party Mac Developer Installer (หมดอายุ 2027-07)
- Provisioning profile "BillNgai MAS" ที่ `build/embedded.provisionprofile`
  (**gitignored + เครื่องนี้เท่านั้น** — หายให้โหลดใหม่จาก developer.apple.com)
- IAP form กำลังกรอก (ใช้รูปจาก store-assets/)

### Assets พร้อมใช้ (store-assets/ — commit แล้วบางส่วน)
- `iap-pro-1024.png` — ภาพโปรโมต IAP 1024×1024 (เทมเพลต: `iap-promo.html` + `render-promo.js`)
- `iap-review-screenshot.png` — ภาพหน้าจอรีวิว IAP (โมดัลซื้อ, 2880×1800)
- `screenshot-1-dashboard … 6-settings-brand.png` — สกรีนช็อตหน้าร้าน 6 ภาพ 2880×1800
  (สคริปต์: `.capture-shots.js` ที่ root — ต้องอยู่ root เพราะ appPath/loadFile)
- `docs/privacy.html` — ออนไลน์แล้ว: **https://visarutforthaipbs.github.io/local-bill-apps/privacy.html**
  (GitHub Pages เปิดจาก main branch /docs ของ repo หลัก)
- `STORE-LISTING.md` — copy ทุกช่องของ App Store Connect (TH/EN) + review notes
- `APP-STORE-SETUP.md` — คู่มือ 8 ขั้นของเจ้าของ · `PLAN-MAC-APP-STORE.md` — แผนแม่บท

## สิ่งที่เหลือ (เรียงตามลำดับ)

1. **รอ Apple ประมวลผล build 2.0.2** (~15–30 นาที) → โผล่ในแท็บ TestFlight
   - ถ้ามีอีเมล ITMS-xxxxx มาแทน: แก้ → bump buildVersion → บิลด์ → อัปโหลดใหม่
2. **ทดสอบผ่าน TestFlight บนเครื่องจริง** (build MAS เปิดนอก TestFlight ไม่ได้ — เป็นเรื่องปกติ):
   ซื้อ Pro ด้วย **sandbox tester** (ขั้น 6 ใน APP-STORE-SETUP.md — เช็คว่าสร้างหรือยัง),
   Restore Purchases, Google Drive sync ใน sandbox จริง, พิมพ์/PDF, สำรอง/กู้คืน
3. **หน้า version ใน App Store Connect**: อัปโหลดสกรีนช็อต 6 ภาพ, กรอกตาม STORE-LISTING.md,
   Privacy questionnaire = **Data Not Collected**, แนบ build + แนบ IAP กับ version, วาง review notes
4. **Submit for Review** (รอบแรกอาจโดน reject เรื่อง metadata — แก้แล้วส่งใหม่ได้เรื่อย ๆ)
5. ค้างจากแผน (ไม่บล็อกการส่ง): Small Business Program (ลดค่าหัวเหลือ 15%),
   Phase 3 security-scoped bookmarks, ตัดสินใจราคา intro/Early Bird ของ IAP

## กติกาสำคัญเวลาทำงานต่อ

- **ทุกคำสั่ง Bash ที่ทำกับ pilot ต้องขึ้นต้น `cd .../BillNgai-MAS-Pilot &&`** —
  cwd ของ shell รีเซ็ตกลับ worktree หลักแบบสุ่ม เคยทำ `rm -rf dist` ผิด worktree มาแล้ว
- แก้บั๊กที่กระทบทั้งสอง SKU → แก้บน `main` แล้ว merge เข้า `mas-pilot` (ไม่ก๊อปมือ)
- **ห้าม `rm -rf build`** — มี provisioning profile + entitlements + icon source อยู่ข้างใน
- เจ้าของเป็นคนกด Transporter/App Store Connect เอง — เราเตรียมไฟล์/บอกขั้นตอน
- UI/ภาพทุกอย่างตาม `BRAND.md` (ส้ม #FF6B00, ครีม, ห้าม gradient) · สตริงใหม่เข้า `tr()`+`I18N_EN`
