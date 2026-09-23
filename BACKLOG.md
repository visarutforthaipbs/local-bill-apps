# BillNgai — Backlog กลางของทีม

> support เขียนเข้า · product-engineer หยิบไปทำ · chief-of-staff จัดลำดับ
> รูปแบบ: วันที่ · ที่มา (ใครขอ) · ปัญหาจริง · กระทบกี่คน · Priority · สถานะ

Priority: **P0** = ข้อมูลลูกค้าเสี่ยงพัง/ขายไม่ได้ · **P1** = ลูกค้าติดขัดจริง ·
**P2** = ขอกันหลายคน ควรทำ · **P3** = nice to have

## Active

### 2.0.3 containment follow-up — 2026-09-23

The owner authorized Direct macOS audit/release and website updates, not completion
of other channels or customer-policy actions. Older dated entries below are kept as
history; verify current state before executing old upload or deployment instructions.

| Priority | Work | Status / boundary |
|---|---|---|
| P0 | Final Direct macOS 2.0.3 exact-artifact gates and truthful website restrictions | Release preparation; record final commit, signed/notarized artifact, packaged smoke, public hash and live deploy before marking done |
| P1 | Deliberate MAS containment port | Pending; preserve StoreKit/sandbox, inspect current upload number and entitlement needs, same app SemVer + fresh build number; no submission authorized here |
| P1 | Windows containment port/build and real-machine verification | Pending; do not label the existing Windows download 2.0.3 |
| P1 | Historical document exposure/correction assessment | Pending separate owner-approved data scope and appropriate professional review; preserve original records/PDFs, no invented snapshots or mass edits |
| P1 | Existing Pro customers affected by paused sync/tax features | Pending owner decision on handling and approved messages; no automatic refund, price/key action or promised return date |
| P1 | Security/PDPA/import review and durable multi-device conflict/numbering design | Pending separate audit; source regression tests are not complete security certification; keep cloud sync paused |
| P1 | Reconcile older support/marketing drafts before reuse | Current FAQ/SKU/DELIVERY/TEAM corrected; historical drafts not publication-ready; no unsafe Gatekeeper bypass or full-tax/sync promises |
| P2 | External Thai practitioner review of the supported receipt/payment/WHT scope | Recommended, not completed; owner directs AI-assisted audit instead as this release prerequisite, not legal certification |

Certificate-preservation P2 audit finding: fixed in source candidate with a new
invoice-to-receipt regression; see `VERIFICATION-2.0.3.md` for exact test evidence.

| วันที่ | ที่มา | รายการ | กระทบ | P | สถานะ |
|---|---|---|---|---|---|
| 2026-07-12 | DELIVERY.md §6 | Windows AI TOR→Quotation end-to-end test บนเครื่องจริง (ตัวปลดล็อกคำถาม D ใน SKU.md) | Windows SKU ทั้งก้อน | P1 | todo |
| 2026-07-12 | DELIVERY.md §3 | LINE OA rich menu / auto-reply "ซื้อ Pro" (ลูกค้านอกเวลาตื่นไม่ติดค้าง) | ทุก Pro sale | P1 | todo |
| 2026-07-12 | TEAM.md sprint | ไล่ launch checklist DELIVERY.md §4 ที่เหลือ: Drive API enabled? two-device test? signing/notarization? dogfood ครบสัปดาห์? (OAuth production + Pro dialog = ✅ แล้ว) | Pro launch | P1 | todo |
| 2026-07-15 | Apple reject (1.5 + 2.4.5(i) + G4) | **รอเจ้าของ resubmit — build 2.0.7** (2.0.6 ไม่ได้ส่ง external review เจอบั๊ก): Developer Reject → upload `dist/mas-universal/BillNgai-2.0.1-universal.pkg` (CFBundleVersion 2.0.7) → paste 3 คำตอบ + Review Notes. verify แล้วทั้ง artifact + human test | MAS launch | P0 | รอเจ้าของ |
| 2026-07-15 | external review (Finding 4) | **DMG/ช่องทางตรงมีบั๊ก Google consent อยู่ตอนนี้** — ลูกค้า Pro ที่ต่อ Drive ด้วยบัญชี Google ที่ไม่เคยอนุญาตแอปมาก่อน ถ้าไม่ติ๊กช่อง Drive จะได้ token ที่ใช้ไม่ได้ แอปขึ้น "เชื่อมต่อแล้ว" แต่ Drive call 403 ทุกครั้ง (บันทึก token เสียไว้ด้วย) → port `b2d3aa2` เข้า main (hunk `billing.html` เป็น generic ต้องการบน main ด้วย) + `f7dc9ad` + `67b5932` (main.js) — **ห้าม cherry-pick 3.1.1 strip เข้า main** | ลูกค้า Pro ตรงที่ใช้ Drive sync | P1 | todo |
| 2026-07-15 | external review (§5.3) | เพิ่ม standing test ก่อนทุก submission: ทดสอบ OAuth ด้วยบัญชี Google ที่**ไม่เคยอนุญาตแอปมาก่อน** — บัญชีเก่า auto-grant บังบั๊ก consent (เหตุผลที่เทสต์ 3 รอบไม่เจอ) → ใส่ใน qa-release checklist + reject playbook | ทุก release ที่แตะ OAuth | P1 | todo |
| 2026-07-13 | ลูกค้า (พี่ป๊อบ) จ่ายเงินไม่ได้ | เว็บ promote-billiong: QR ฿290 (Local) เสีย scan ไม่ได้ → แก้เป็นราคาใหม่ (Local ฟรี ตัด payment step, Pro ฿599 + QR ใหม่ที่ verify แล้ว) โค้ดเสร็จ+build ผ่าน แต่ **ยังไม่ deploy** — รอเจ้าของ push/deploy Cloudflare Pages (ต้อง Node ≥22) | ขายไม่ได้ทุกราย | P0 | code done, deploy pending |

## Done

| วันที่เสร็จ | ที่มา | รายการ | กระทบ | P |
|---|---|---|---|---|
| 2026-07-15 | Apple reject (Guideline 4 — Design) | Window menu fix ใน mas-pilot `main.js`: ปิดหน้าต่างหลักแล้วไม่มีเมนูเปิดกลับ (แอปยังรันอยู่เพราะ `window-all-closed` ไม่ quit บน macOS) → แทน `{ role: 'windowMenu' }` เปล่า ๆ ด้วย submenu เอง **แต่คง role เดิมไว้** (macOS ยังผูกเป็น NSApp.windowsMenu) + role มาตรฐานครบ (Minimize/Zoom/Bring All to Front) + เพิ่ม `หน้าต่างหลัก BillNgai (Main Window)` เรียก `showMainWindow()` — ไม่มีหน้าต่าง=สร้างใหม่, มีอยู่แล้ว=โฟกัส ไม่เปิดซ้ำ; `app.on('activate')` ใช้ helper เดียวกัน. ไม่ผูกคีย์ลัด (Cmd+0 ถูก View → Actual Size จองแล้ว). ไม่แตะ entitlements — `network.server` ยังจำเป็นจริง (OAuth PKCE loopback) | MAS review pass/fail | P0 |
| 2026-07-12 | channel-ops (reject playbook) | 3.1.1 fix: `openUpgradeModal()` ใน mas-pilot ลบสาขา direct-channel ทิ้งทั้งหมด (ไม่ใช่แค่ gate ด้วย `IS_MAS`) — ราคา ฿590/1,990, ลิงก์ `lin.ee/pSl8nEH`, ช่องวางรหัส Pro ไม่มีอยู่ใน source ของ mas-pilot อีกต่อไป จึงไม่ติดไปกับ app.asar เลย (ลบทั้ง call site และ I18N_EN entries) + Restore Purchases เพิ่ม toast "ไม่พบการซื้อ Pro ก่อนหน้านี้" เมื่อกู้คืนแล้วไม่มีอะไรให้กู้คืน (mas-pilot billing.html) | MAS review pass/fail | P0 |
| 2026-07-12 | SKU.md (ตัดสินใจแล้ว) | Price parity ripple: in-app upgrade modal (main billing.html) อัปเดตเป็น Early Bird ฿599 / เต็ม ฿1,900 แล้ว — ตรวจโค้ดแล้วไม่มี Local honor-system paywall อยู่แล้ว (Local ฟรีในแอปอยู่แล้วทุกช่อง ไม่มีอะไรต้องลบ) เว็บการตลาด (`promote-billiong`) แยก repo ไม่ได้แตะ — ต้อง flag ให้ channel-ops/marketing เช็คแยก | ราคาที่ลูกค้าเห็นจริง | P1 |
| 2026-07-12 | TEAM.md sprint | App Store reject playbook (3.1.1, sandbox, IAP restore) + ร่างคำตอบ → `app-store-reject-playbook.md` | ช่องทาง MAS | P1 |
| 2026-07-12 | TEAM.md sprint | ร่างประกาศเปิดตัว MAS 2 ชุด (ผ่าน/ไม่ผ่าน) → `drafts/mas-launch-announcement-{approved,pending}.md` | launch day | P2 |
| 2026-07-12 | TEAM.md sprint | FAQ.md v1: ติดตั้ง/Gatekeeper · วางรหัส Pro · ย้ายเครื่อง · MAS vs ตรง · AI module | support load | P2 |
| 2026-07-12 | SKU.md §6 | ตัดสินใจคำถาม A–D (memo จาก biz-analyst + chief-of-staff, `reviews/2026-W28-decision-memo.md`) → บันทึกใน SKU.md §6 + DELIVERY.md | positioning ทั้งหมด | P1 |
