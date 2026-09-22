# BillNgai — Backlog กลางของทีม

> support เขียนเข้า · product-engineer หยิบไปทำ · chief-of-staff จัดลำดับ
> รูปแบบ: วันที่ · ที่มา (ใครขอ) · ปัญหาจริง · กระทบกี่คน · Priority · สถานะ

Priority: **P0** = ข้อมูลลูกค้าเสี่ยงพัง/ขายไม่ได้ · **P1** = ลูกค้าติดขัดจริง ·
**P2** = ขอกันหลายคน ควรทำ · **P3** = nice to have

## Active

| วันที่ | ที่มา | รายการ | กระทบ | P | สถานะ |
|---|---|---|---|---|---|
| 2026-07-12 | DELIVERY.md §6 | Windows AI TOR→Invoice end-to-end test บนเครื่องจริง (ตัวปลดล็อกคำถาม D ใน SKU.md) | Windows SKU ทั้งก้อน | P1 | todo |
| 2026-07-12 | DELIVERY.md §3 | LINE OA rich menu / auto-reply "ซื้อ Pro" (ลูกค้านอกเวลาตื่นไม่ติดค้าง) | ทุก Pro sale | P1 | todo |
| 2026-07-12 | TEAM.md sprint | ไล่ launch checklist DELIVERY.md §4: OAuth production? dogfood ครบสัปดาห์? ลิงก์เว็บชี้เวอร์ชันล่าสุด? | Pro launch | P1 | todo |

## Done

| วันที่เสร็จ | ที่มา | รายการ | กระทบ | P |
|---|---|---|---|---|
| 2026-07-12 | channel-ops (reject playbook) | 3.1.1 fix: `openUpgradeModal()` ใน mas-pilot ลบสาขา direct-channel ทิ้งทั้งหมด (ไม่ใช่แค่ gate ด้วย `IS_MAS`) — ราคา ฿590/1,990, ลิงก์ `lin.ee/pSl8nEH`, ช่องวางรหัส Pro ไม่มีอยู่ใน source ของ mas-pilot อีกต่อไป จึงไม่ติดไปกับ app.asar เลย (ลบทั้ง call site และ I18N_EN entries) + Restore Purchases เพิ่ม toast "ไม่พบการซื้อ Pro ก่อนหน้านี้" เมื่อกู้คืนแล้วไม่มีอะไรให้กู้คืน (mas-pilot billing.html) | MAS review pass/fail | P0 |
| 2026-07-12 | SKU.md (ตัดสินใจแล้ว) | Price parity ripple: in-app upgrade modal (main billing.html) อัปเดตเป็น Early Bird ฿599 / เต็ม ฿1,900 แล้ว — ตรวจโค้ดแล้วไม่มี Local honor-system paywall อยู่แล้ว (Local ฟรีในแอปอยู่แล้วทุกช่อง ไม่มีอะไรต้องลบ) เว็บการตลาด (`promote-billiong`) แยก repo ไม่ได้แตะ — ต้อง flag ให้ channel-ops/marketing เช็คแยก | ราคาที่ลูกค้าเห็นจริง | P1 |
| 2026-07-12 | TEAM.md sprint | App Store reject playbook (3.1.1, sandbox, IAP restore) + ร่างคำตอบ → `app-store-reject-playbook.md` | ช่องทาง MAS | P1 |
| 2026-07-12 | TEAM.md sprint | ร่างประกาศเปิดตัว MAS 2 ชุด (ผ่าน/ไม่ผ่าน) → `drafts/mas-launch-announcement-{approved,pending}.md` | launch day | P2 |
| 2026-07-12 | TEAM.md sprint | FAQ.md v1: ติดตั้ง/Gatekeeper · วางรหัส Pro · ย้ายเครื่อง · MAS vs ตรง · AI module | support load | P2 |
| 2026-07-12 | SKU.md §6 | ตัดสินใจคำถาม A–D (memo จาก biz-analyst + chief-of-staff, `reviews/2026-W28-decision-memo.md`) → บันทึกใน SKU.md §6 + DELIVERY.md | positioning ทั้งหมด | P1 |
