# 2.0.14 — release notes draft for the HIG restyle (2026-10-09)

Use for the next TestFlight build ("What to Test"), the App Store "What's New", and the
website/LINE announcement. Thai first; English for the App Store secondary locale.
Everything below describes source on `codex/hig-restyle` (`0a911c5`); the installed
TestFlight build 5 and the delivered Mac package still show the previous design.

## TestFlight — What to Test (≤ 4,000 chars)

**ไทย**

บิลง่ายปรับหน้าตาใหม่ตามแนวทางออกแบบของ Apple ทั้งบน Mac, iPhone และ iPad — ยังใช้สีส้มเดิม
และเอกสาร/PDF ที่พิมพ์ออกมาไม่เปลี่ยนเลย

ช่วยทดสอบ:
1. เปิดแอปในโหมดสว่างและโหมดมืด (ตั้งค่า → รูปลักษณ์ของเครื่อง) — ตัวหนังสืออ่านง่ายทุกหน้าไหม
   ยอดเงินบนแดชบอร์ดชัดเจนไหม
2. iPhone: แถบเมนูด้านล่าง, หน้าสร้างเอกสารที่เลื่อนขึ้นจากด้านล่าง, สวิตช์ยืนยันในหน้าออกใบเสร็จฉบับแก้ไข
3. iPad: แถบข้างซ้าย แตะได้ทุกรายการไหม หมุนเครื่องแล้วหน้าจอยังเรียบร้อยไหม
4. Mac: แถบข้างโปร่งแสง ปุ่มไฟจราจรไม่ทับอะไร กด Return ในกล่องยืนยันแล้วเลือกปุ่มหลักให้
   (ปุ่มลบ/ยกเลิกเอกสารต้องกดเองเท่านั้น) ใน "สร้างเอกสาร" กด Return แล้วต้องไม่ออกเอกสาร
5. ขนาดตัวอักษรใหญ่ (การช่วยการเข้าถึง → ตัวอักษรใหญ่ขึ้น) — ยังกดปุ่มได้ครบไหม
6. พิมพ์/บันทึก PDF ใบแจ้งหนี้ 1 ใบ แล้วเทียบกับใบเดิม — ต้องเหมือนเดิมทุกจุด

ข้อมูลของคุณไม่ถูกแตะต้อง ไม่มีการเปลี่ยนวิธีคิดยอดเงินในรุ่นนี้

**English**

BillNgai now follows Apple's Human Interface Guidelines on Mac, iPhone and iPad — same orange
accent, and printed documents/PDFs are unchanged.

Please check: light and dark appearance on every screen; the iPhone tab bar and bottom sheets;
iPad sidebar taps and rotation; on Mac the translucent sidebar, traffic lights and Return in
confirmation dialogs (Return must never issue a document from the editor); Larger Text sizes;
and one printed invoice compared with the previous version.

## App Store — What's New (≤ 4,000 chars)

**ไทย**

- หน้าตาใหม่ตามแนวทางของ Apple: ตัวอักษรระบบ, โหมดมืดตามเครื่อง, ปุ่มและการ์ดแบบ iOS/macOS
- iPhone/iPad: แถบเมนู แผ่นเลื่อน และสวิตช์แบบเดียวกับแอประบบ
- ยังเป็นสีส้มบิลง่ายเหมือนเดิม — และใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จที่พิมพ์ออกมาไม่เปลี่ยน
- (คงรายการ 2.0.14 เดิมจาก CHANGELOG: ที่เก็บข้อมูล SQLite, iPhone/iPad, ซิงก์ Google Drive)

**English**

- A new look that follows Apple's design guidelines: system typography, Dark Mode, iOS/macOS-style
  controls and cards.
- iPhone and iPad: tab bar, sheets and switches that work like the built-in apps.
- Still BillNgai orange — and your printed quotations, invoices and receipts are unchanged.
- (keep the existing 2.0.14 items from CHANGELOG: SQLite storage, iPhone/iPad app, Google Drive sync)

## Store listing housekeeping

- Retake all screenshots (Mac, iPhone 6.9"/6.5", iPad 13") in light mode, plus at least one dark
  set; the current listing shows the fintech design.
- App Review notes: unchanged (OAuth loopback → `network.server`; Pro = existing IAP;
  support URL https://billiong-landing.pages.dev/support).
- Website (`promote-billiong`): replace hero/feature screenshots after the Mac DMG is rebuilt.

## Build numbers

- iOS: next build is 2.0.14 (6) — pass `CURRENT_PROJECT_VERSION=6` on the archive command line,
  as builds 3–5 were made (`handoff-M5-2026-10-07.md`).
- macOS App Store: new build number on the same 2.0.14 version.
- Direct DMG and Windows: rebuild from `codex/hig-restyle` once it is merged into
  `codex/integrated-data-revamp`.
