# 2.0.15 — release notes draft for the HIG restyle (2026-10-09)

Version bumped to 2.0.15 on 2026-10-09: 2.0.14 already exists in TestFlight (builds 3–5) and in the delivered Mac App Store package, so the restyled builds use a new version.

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

- iOS: 2.0.15 (1) — `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` are set in the project; raise
  `CURRENT_PROJECT_VERSION` on later uploads.
- macOS App Store: 2.0.15 with its own build number.
- Direct DMG and Windows: rebuild from `codex/hig-restyle` once it is merged into
  `codex/integrated-data-revamp`.

---

# Addendum 2026-10-09 — simplified 2.0.15, App Store only (`PRD-SIMPLIFY-2026-10.md`)

The owner approved the simplification on 2026-10-09: 2.0.15 ships on the Mac App Store and the
iOS App Store only, with the local AI add-on, sound effects, direct-purchase/licence screens and
the paused e-Tax / new-tax-invoice remnants removed (PRD §2). The copy below replaces the "App
Store — What's New" section above once the engineering streams A–F have landed; it is written for
the store build, so it names no price, no other sales channel, no LINE and no removed feature by a
name a reviewer could read as an outside purchase. Nothing here is submitted or released.

## App Store — What's New, simplified 2.0.15 (≤ 4,000 chars each)

**ไทย**

บิลง่ายรุ่นนี้เบาลงและใช้ง่ายขึ้น เราตัดส่วนที่ไม่ได้ช่วยให้คุณออกเอกสารได้เร็วขึ้นออกไป
เหลือแค่สิ่งที่ฟรีแลนซ์ใช้จริงทุกวัน

- หน้าตาใหม่ตามแนวทางของ Apple ทั้งบน Mac, iPhone และ iPad — ตัวอักษรระบบ โหมดมืดตามเครื่อง
  ปุ่มและการ์ดแบบเดียวกับแอประบบ ยังเป็นสีส้มบิลง่ายเหมือนเดิม
- เมนูเหลือ 6 รายการ ตั้งค่าเหลือ 3 แท็บ เริ่มใช้ครั้งแรกใน 3 ขั้น
- เอาส่วนช่วยร่างอัตโนมัติ เสียงประกอบ และข้อความแจ้งเตือนฟีเจอร์ที่ยังไม่เปิดใช้ออก
  หน้าจอโล่งขึ้น ไม่มีอะไรมากวน
- นำเข้าข้อมูลจากไฟล์สำรองของเวอร์ชันเดิมได้ตั้งแต่เปิดแอปครั้งแรก
- ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ หัก ณ ที่จ่าย สรุปรายรับ และ PDF ที่พิมพ์ออกมา ไม่เปลี่ยน

ข้อมูลของคุณอยู่ในเครื่องเหมือนเดิม ไม่ต้องสมัครบัญชีใด ๆ

**English**

A lighter, simpler BillNgai. We removed the parts that did not help you issue a document faster
and kept what Thai freelancers use every day.

- A new look that follows Apple's design guidelines on Mac, iPhone and iPad: system typography,
  Dark Mode, controls and cards that work like the built-in apps. Still BillNgai orange.
- Six menu items, three settings tabs, a three-step first-run setup.
- Automatic drafting, sound effects and banners for features that were never switched on are gone.
  Less on screen, nothing in the way.
- Import a backup file from a previous version the first time you open the app.
- Quotations, invoices, receipts, withholding tax, income summary and printed PDFs are unchanged.

Your data stays on your device. No account is required.

## Review Notes — draft for App Store Connect → App Review Information → Notes

Paste the block below as one note on both the macOS and the iOS version. Keep it under 4,000
characters (current draft: 2,276 characters). The owner fills in
the test account from `APP-STORE-SUBMISSION-2.0.14.md` and enters the password only in the
App Review Information sign-in fields, never in the note.

> BillNgai creates quotations, invoices and receipts for Thai freelancers who are not VAT
> registered. The free tier is complete and works without any account: open the app, finish the
> three-step setup (business name and tax ID, address and logo, done), add a client, create a
> document, issue it and share the PDF. Nothing is downloaded or unlocked from outside the app.
>
> PRO. BillNgai Pro is a one-time non-consumable in-app purchase (com.visarut.billngai.pro), the
> same product on Mac, iPhone and iPad. "Restore Purchases" is in Settings. There is no other way
> to buy Pro in this app and no licence or activation screen.
>
> SANDBOX ENTITLEMENT com.apple.security.network.server (macOS). Pro users can keep their data in
> their own Google Drive. Google sign-in uses the system browser with OAuth loopback: the app opens
> a listener on 127.0.0.1 on a random port for the single redirect that carries the authorization
> code back, then closes it. The entitlement is used for that loopback only; the app never accepts
> connections from other machines and runs no server otherwise. network.client is used for Google
> Drive and the purchase-verification endpoint.
>
> GOOGLE SIGN-IN (Guideline 4.8). Optional, used only to store the user's own data in the user's
> own Google Drive (drive.file scope). It is not an app account, so there is no account creation
> or deletion (5.1.1 v). "Stop syncing" in Settings disconnects the device and keeps local data.
>
> WINDOW BEHAVIOUR (macOS, Guideline 4). Closing the main window leaves the app running, as is
> standard on macOS. The window reopens from the Dock icon and from Window > BillNgai in the menu
> bar; Quit is in the application menu. No window is left unreachable.
>
> TEST DATA. The free tier needs no sign-in. To see Pro, buy it with a sandbox Apple account or
> use Restore Purchases on an account that owns it. To test Google Drive sync, sign in with the
> test Google account below on two devices; it already contains sample documents. The account is a
> test account owned by the developer; it has 2-Step Verification turned off for review.
>
> Test Google account: (owner fills in) — password in the sign-in fields, not here.
> Sandbox Apple account: the reviewer's own.
>
> Support: https://billiong-landing.pages.dev/support (contact and privacy policy).

Character count of the quoted block (without the `> ` prefixes): 2,276 — within the 4,000-char
limit, so the owner can add the account line without trimming.

Checklist for the note (`.claude/skills/apple-platform-design/SKILL.md` §5):
- [x] `com.apple.security.network.server` justified (OAuth loopback) — `build/entitlements.mas.plist`
- [x] No external purchase link, price or licence-key field mentioned
- [x] Window reopen path stated (Dock + Window menu, `main.js` `app.on('activate')`)
- [x] Free tier works without an account
- [x] Test-data note ≤ 4,000 chars; password not in the note
- [ ] Owner: support URL loads and shows contact + privacy on the day of submission

## Promo codes for existing lifetime-key holders — plan (owner-only step)

Decision (PRD §0): every holder of a direct Pro key (`BN-PRO-KEY`) receives one App Store promo
code for the Pro in-app purchase. No refund, no second payment. Apple allows up to 100 promo
codes per version of an in-app purchase; codes expire a few weeks after they are generated
(App Store Connect shows the exact date), so generate them only when ready to send.

1. **Agent prepares (no customer contact):** list of key holders from the sales log (Notion
   "BillNgai Sales Log"), one row per buyer with purchase date and the email or name used; a Thai
   message draft that explains the export → import path (FAQ "ย้ายจากเวอร์ชันดาวน์โหลดตรงไป App
   Store") and how to redeem a code on Mac and on iPhone/iPad. The draft lives in the repo; it is
   not sent.
2. **Owner runs this:** App Store Connect → My Apps → BillNgai → Promo Codes (left sidebar) →
   In-App Purchases → "BillNgai Pro" → Request codes → quantity = number of key holders (+ a few
   spare, ≤ 100) → Download the `.txt`. Keep the file outside the repo.
3. **Owner runs this:** send one code per customer through the channel the customer already uses,
   with the drafted message. Log the code and the date next to the customer in the sales log so a
   code is never sent twice.
4. **Owner runs this:** after 30 days, review unredeemed codes; regenerate for anyone whose code
   expired before they moved.
5. The direct key keeps working in the final 2.0.15 DMG until the customer moves; nothing is
   revoked.

## Build numbers — superseded by the App Store-only decision

The "Build numbers" section above predates the PRD. Current plan:
- iOS: 2.0.15 with the next `CURRENT_PROJECT_VERSION`.
- macOS App Store: 2.0.15 with its own build number.
- Direct DMG: one final 2.0.15 build from the same source (PRD §4.2 step 2); no further direct builds.
- Windows: discontinued (PRD §0); no 2.0.15 Windows build.
- The owner may rename 2.0.15 → 2.1.0 before submission (PRD §9); the copy above does not mention
  a version number, so it needs no change.
