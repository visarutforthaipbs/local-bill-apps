# App Store Reject Playbook — BillNgai (Mac App Store)

> Draft only — Role 5 (Channel Ops) prepared this. The OWNER is the only one who
> reads Resolution Center replies, edits them, and clicks Submit.
> Source of truth: `SKU.md` §1.4/§4, `DELIVERY.md` §4, `BillNgai-MAS-Pilot/HANDOFF-MAS.md`.
> Verified against the `mas-pilot` branch as of 2026-07-12. If code changes
> after this date, re-check line numbers before pasting a response.

**Goal:** if Apple rejects, go from "email arrives" to "Resolution Center reply
posted" in **hours**, not days. Use this order:

1. Open the rejection in App Store Connect → Resolution Center. Copy the exact
   guideline number and the reviewer's stated reason verbatim.
2. Match it to one of the 3 sections below (or the "other" fallback at the
   bottom).
3. If a code fix is needed, hand the file/line pointers to Role 1
   (Product Engineer) on `mas-pilot` — don't guess, don't patch blind.
4. Fill in the response template's `[bracketed]` parts, paste into Resolution
   Center as a draft for the owner, and if a new build is required remind the
   owner to **bump `buildVersion`** before re-upload (SKU.md §7).
5. Never claim a fix is live until the owner confirms the new build actually
   uploaded and was attached to the version.

---

## 1. Guideline 3.1.1 — In-App Purchase (external purchase mentions)

**Guideline text (paraphrased):** apps offering purchasable content/functionality
must use in-app purchase, and must not include buttons, external links, or
other calls to action that direct users to purchasing mechanisms other than IAP.

### Likely trigger in BillNgai's case — verified, not hypothetical

`billing.html` ships as **one file for both channels** — the direct-channel
purchase modal (PromptPay price + LINE link) is not deleted for the MAS build,
it's gated at runtime:

```
1064  function openUpgradeModal(){
1065    if(IS_MAS){ openMasUpgradeModal(); return; }   // MAS: ซื้อผ่าน In-App Purchase เท่านั้น
1066    ... (renders the direct-channel modal below, unreachable when IS_MAS is true)
1089    ${tr('จ่ายครั้งเดียว — Early Bird ฿590 (ราคาเต็ม ฿1,990) ไม่มีค่ารายเดือน')}
1099    ${tr('ซื้อ Pro: สแกนจ่ายผ่าน PromptPay แล้วส่งสลิปทาง LINE — รับรหัสตอบกลับทางแชทได้เลย')}
1100    <a href="https://lin.ee/pSl8nEH" target="_blank" ...>${tr('ทักทาง LINE')} →</a>
```

`IS_MAS` (`preload.js:7`, `process.mas === true`) correctly short-circuits this
at runtime — a real reviewer clicking through the app will only ever see
`openMasUpgradeModal()` (line 1108), which has no price text, no external
link, and only "ซื้อผ่าน App Store" / "กู้คืนการซื้อ". **But the LINE URL
(`lin.ee/pSl8nEH`), the ฿590/฿1,990 strings, and the "วางรหัส Pro" input are
still literal bytes inside the shipped `app.asar`.** Apple's automated
pre-review scanning is known to string-scan binaries/bundles for
purchase-related URLs and price patterns even in code paths that never
execute. This is the most plausible concrete trigger for a 3.1.1 citation —
more likely than anything a human reviewer would click through, since the
in-app UX itself is already clean.

Also double-checked and clean:
- `STORE-LISTING.md` metadata (description, keywords, promo text, IAP
  description) — no price, no external link, no channel mention. Good.
- `openMasUpgradeModal()` (`billing.html:1108-1142`) — only "ซื้อผ่าน App
  Store" and "กู้คืนการซื้อ" buttons, price sourced live from
  `iapProducts()` (StoreKit), no hardcoded ฿ figures.
- Review Notes in `STORE-LISTING.md` already tell the reviewer the Pro IAP
  is under Settings → พื้นที่ทำงาน → "ดูแพ็กเกจ Pro" — good, keeps this from
  becoming a "feature not found" complaint too.

### Recommended fix (for Role 1, on `mas-pilot`)

Don't rely on runtime gating alone for a 3.1.1-sensitive string. Either:
- Strip the `!IS_MAS` branch of `openUpgradeModal()` (lines 1066-1104) out of
  the `mas-pilot` build entirely (dead-code elimination at build time, or a
  simple `#if MAS` style pre-process step before `electron-builder` packs the
  asar), or
- At minimum, replace the literal `lin.ee/pSl8nEH` and `฿590`/`฿1,990` strings
  in that unreachable branch with non-URL, non-price placeholders in the
  `mas-pilot` branch's copy of `billing.html` (the direct branch `main` keeps
  the real ones — this file already diverges per-branch by design).

This is a code change outside Channel Ops' remit — flagging file/line only.

### Ready-to-paste Resolution Center response (English)

```
Subject: Re: Guideline 3.1.1 — In-App Purchase

Hello,

Thank you for the review. BillNgai's Mac App Store build does not present
any external purchase mechanism to the user. The Pro upgrade flow (Settings →
พื้นที่ทำงาน / Workspace → "ดูแพ็กเกจ Pro") exclusively uses StoreKit
in-app purchase (product ID com.visarut.billngai.pro, non-consumable) via
Electron's inAppPurchase API — there are no buttons, links, or text in the
running app that mention price, an external store, or an alternative
purchase channel.

[IF the reviewer cited a specific screen/screenshot, address it directly here
 — quote what they saw and explain why it's from the app's other distribution
 channel, not the App Store build, e.g.:]
The screen you referenced belongs to a code path used only by our separate,
non-App-Store distribution of this app (direct DMG download outside the
App Store) and is not reachable in the App Store build — it is gated by a
runtime check (`process.mas`) that is always true in this binary. We
understand static references to this code could still be flagged, so we
have removed that code path entirely from build [X.X.X] (buildVersion
[NNN]), attached to this submission / uploading now.

We're happy to walk through the purchase flow again with a fresh screen
recording if that's helpful. Thank you for your patience.
```

---

## 2. Sandbox / entitlements

There is no single guideline number Apple always cites for entitlement
issues — in practice it shows up as one of:
- **Guideline 2.1 (App Completeness)** — if the reviewer's sandboxed
  environment produces a crash or blank window your local testing didn't
  catch (this literally happened to us during TestFlight, twice, before
  submission — see below).
- **Guideline 2.3.1 (Accurate Metadata)** — if a screenshot or description
  implies a feature the sandboxed build can't actually do.
- An **ITMS Transporter validation error** (e.g. `ITMS-90285`) that blocks
  upload before human review even starts — not a Resolution Center message,
  but included here because the playbook needs to cover it too.

### Likely trigger in BillNgai's case — grounded in build history

`HANDOFF-MAS.md` documents three entitlement failures already survived
during TestFlight uploads (build 2.0.1 → 2.0.4), so the risk here isn't
theoretical — it's the single most fragile part of this app's MAS build:

| Upload | Result | Cause | Fix |
|---|---|---|---|
| Round 1 | ❌ ITMS-90285 | entitlements had `cs.allow-dyld-shared-cache` | removed — Apple disallows it outright |
| Round 2 | ❌ ITMS-90257 | `CFBundleVersion` had 4 dotted components (`2.0.1.1`) | use `buildVersion`, keep it ≤3 components |
| Round 3 (build 2.0.2) | ✅ validated, ❌ crashed on launch in TestFlight | stripped `cs.allow-jit` along with `cs.allow-dyld-shared-cache` — V8 needs JIT even sandboxed | restored `cs.allow-jit` + `cs.allow-unsigned-executable-memory` |
| Round 4 (build 2.0.3) | ✅ launched, ❌ blank window | Chromium's Mach port (`TEAMID.bundleid.MachPortRendezvousServer`) blocked by sandbox without an app-group entitlement | added `com.apple.security.application-groups = [79QFYKTJMN.com.visarut.billngai]` to both `entitlements.mas.plist` and the inherit plist |

Current entitlements (`build/entitlements.mas.plist`, `build/entitlements.mas.inherit.plist`):
`app-sandbox`, `application-groups`, `network.client`, `network.server`
(OAuth loopback listener on 127.0.0.1 for Google Drive sign-in — the app is
not a persistent server), `files.user-selected.read-write`, `cs.allow-jit`,
`cs.allow-unsigned-executable-memory`. Explicitly **not** present:
`cs.allow-dyld-shared-cache` (the one Apple hard-rejects).

Two things a human reviewer could plausibly flag even with this fixed set:
1. **`network.server`** is unusual for a sandboxed finance app and may
   prompt a "why does this app run a server?" question — it's the standard
   OAuth loopback pattern for desktop apps, not a real listening service.
2. **Feature parity with the description.** `SKU.md §4`'s feature matrix is
   explicit that MAS Pro does **not** include AI TOR→Invoice (sandbox can't
   `spawn` the local `llama-cli` binary) or external file storage folders
   (Drive/Dropbox — blocked pending security-scoped bookmarks, per
   `HANDOFF-MAS.md`). `STORE-LISTING.md`'s MAS description and screenshots
   were checked and do **not** mention AI or external folders — good — but
   if marketing (Role 4) ever reuses direct-channel copy verbatim for the
   MAS listing, this becomes a 2.3.1 risk. Cross-check any MAS copy against
   `SKU.md §4` before it goes live.

### Recommended fix / response prep

- If the crash/blank-window pattern recurs in the reviewer's environment,
  the entitlements table above is the diagnostic checklist — walk it in
  order (dyld-shared-cache → CFBundleVersion format → JIT flags → app-group)
  before assuming it's something new.
- Keep the local test trick documented in `HANDOFF-MAS.md` §"วิธีทดสอบ MAS
  build ในเครื่องโดยไม่ต้องรอ TestFlight" (re-sign the .app with a Developer
  ID identity, same team, run the binary directly from Terminal to see
  FATAL logs) — this is how the app-group bug was actually found. Use it to
  reproduce any reviewer-reported crash before replying.

### Ready-to-paste Resolution Center response (English)

```
Subject: Re: Guideline 2.1 / entitlement or sandbox issue

Hello,

Thank you for flagging this. BillNgai runs fully inside the App Sandbox
(com.apple.security.app-sandbox = true). The entitlements requested are:

- network.client / network.server — network.server is used only for a
  loopback OAuth listener on 127.0.0.1 during the optional "Sign in with
  Google Drive" flow (standard installed-app OAuth pattern); the app does
  not run a persistent network service.
- files.user-selected.read-write — for the user-chosen logo/signature/stamp
  images used on generated documents.
- cs.allow-jit / cs.allow-unsigned-executable-memory — required by the
  Chromium/V8 runtime the app is built on (Electron); without these the app
  fails to launch (EXC_BREAKPOINT in v8::Isolate::Initialize).
- application-groups (79QFYKTJMN.com.visarut.billngai) — required for
  Chromium's inter-process Mach port communication between the main process
  and the renderer under sandboxing; without it the app launches to a blank
  window.

[IF crash/blank window was reported:]
We were able to reproduce a similar issue during our own TestFlight testing
and traced it to [missing application-groups entitlement / a stripped JIT
entitlement — pick whichever matches]. We've since fixed this in build
[X.X.X] / buildVersion [NNN], attached to this submission. We tested this
build via TestFlight on physical Apple Silicon and Intel Macs before
resubmitting.

[IF it's a feature-description mismatch:]
To clarify: the Mac App Store version of BillNgai does not include the
offline AI document-generation feature or custom external storage folders —
these require capabilities (subprocess execution, persistent access outside
the sandbox container) that are not available/appropriate for a sandboxed
app. Our App Store description and screenshots reflect only the features
available in this build. [Point to the specific screenshot/description line
if the reviewer quoted one.]

Happy to provide a screen recording or further detail on any entitlement.
```

---

## 3. Guideline 3.1.1 — In-App Purchase (Restore Purchases flow)

**Guideline text (paraphrased):** apps must implement a mechanism to restore
previously purchased non-consumable in-app purchases (Restore Completed
Transactions), and it must actually work.

### Status: present and wired — verified in code, not yet reviewer-tested

`BN-PRO-MAS` (`com.visarut.billngai.pro`) is a StoreKit **non-consumable**
IAP, and BillNgai's restore flow exists end to end:

- UI: "กู้คืนการซื้อ" (Restore Purchases) button, `billing.html:1134`, inside
  the MAS upgrade modal (`openMasUpgradeModal()`), next to the buy button —
  always visible, not hidden behind any other step.
- Handler: `iapRestorePro()` (`billing.html:1163-1166`) calls
  `window.billingAPI.iapRestore()`.
- Bridge: `preload.js:10` → `ipcRenderer.invoke('iap:restore')`.
- Main process: `main.js:616-620` —
  ```js
  ipcMain.handle('iap:restore', async () => {
    if (process.mas) inAppPurchase.restoreCompletedTransactions();
    else if (IS_MAS) setTimeout(iapNotifyRenderer, 400);
    return true;
  });
  ```
  This calls Electron's `inAppPurchase.restoreCompletedTransactions()`,
  which triggers StoreKit's real restore flow. Results land in the same
  `transactions-updated` listener used for fresh purchases
  (`main.js:585-598`), which checks `state === 'purchased' || state ===
  'restored'` and calls `masGrantPro()` for either — so a restored
  transaction correctly re-sets `cfg.masPro` and unlocks Pro. The renderer
  is notified via `iap:changed` (`iapNotifyRenderer()`), which the UI
  listens for at `billing.html:5148`.
- Per `HANDOFF-MAS.md`, Restore Purchases is explicitly on the pre-submission
  test list ("ซื้อ Pro ด้วย sandbox tester ... Restore Purchases ...") — but
  as of this playbook's writing that TestFlight pass had not yet been
  confirmed done. **Before submitting, confirm with the owner that Restore
  Purchases was actually exercised on a second (or reset) sandbox tester
  account in TestFlight**, not just read from the code. Restore looking
  correct in source is not the same as Apple's sandbox environment agreeing.

### If Apple flags "missing" or "broken" restore anyway

Two realistic causes even with the code above being correct:
1. **Reviewer didn't find the button.** It only appears inside the "ดูแพ็กเกจ
   Pro" modal, which itself is one click from Settings → พื้นที่ทำงาน — not
   on the main dashboard. If Apple says "no restore mechanism found," this
   is the most likely reason — the response below should point precisely at
   the location, and Role 4/1 should consider surfacing it more prominently
   (e.g. also in the license/account area) if this citation recurs.
2. **Silent failure with no user feedback.** `iapRestorePro()` shows a toast
   ("กำลังกู้คืนการซื้อจาก App Store…") immediately, but the actual
   grant only happens asynchronously via the `transactions-updated` event —
   if StoreKit finds nothing to restore, there is currently **no "nothing to
   restore" or failure toast shown to the user** (only success is wired via
   `iap:changed`). A reviewer testing restore on an account with no prior
   purchase may see nothing happen and read that as "broken." Worth a small
   UX fix (timeout + neutral toast) — flagging file/line for Role 1:
   `billing.html:1163-1166` (`iapRestorePro`) and `main.js:583-598`
   (`iapNotifyRenderer` / `transactions-updated` listener) don't currently
   emit any explicit "not found" signal.

### Ready-to-paste Resolution Center response (English)

```
Subject: Re: Guideline 3.1.1 — Restore Purchases

Hello,

BillNgai does implement Restore Purchases for the non-consumable IAP
com.visarut.billngai.pro. To find it: open the app → Settings (⚙) →
พื้นที่ทำงาน (Workspace) → "ดูแพ็กเกจ Pro" (View Pro plans) → the button
labeled "กู้คืนการซื้อ" (Restore Purchases) sits directly next to the
purchase button.

Under the hood this calls Electron's inAppPurchase.restoreCompletedTransactions(),
the standard StoreKit restore API, and any restored transaction is handled
identically to a fresh purchase — it unlocks Pro and persists that state
locally so it survives app relaunches.

[IF Apple says the button couldn't be found:]
We've made this easier to find in build [X.X.X] by [describe the UI change
— e.g. "adding a Restore Purchases entry directly under Settings, not only
inside the upgrade modal"].

[IF Apple says nothing visibly happens with no purchase to restore:]
You're right that this account state didn't produce clear user feedback in
the build you tested — we've added an explicit "No previous purchase found"
message for that case in build [X.X.X].

Please let us know if you'd like a screen recording of the restore flow
against a specific sandbox tester account.
```

---

## Fallback: guideline not covered above

If the rejection cites something outside 3.1.1 / sandbox / restore:

1. Quote the exact guideline number + reviewer text back to the team before
   drafting anything — don't guess at the cause.
2. Check `SKU.md §1.4` and `§4` (MAS content restrictions / feature matrix)
   and `STORE-LISTING.md`'s Review Notes for anything already addressed
   there that the reviewer may have missed.
3. Common categories not yet seen but worth having a stance on ahead of time:
   - **5.1.1 (Data Collection / Privacy)** — Review Notes already state "no
     account required, no network requests except optional Google Drive
     sync," and Privacy questionnaire should be answered "Data Not
     Collected" per `HANDOFF-MAS.md` step 3. If this is challenged, point to
     `docs/privacy.html` (published) and the `drive.file` OAuth scope (only
     files the app itself creates, not full Drive access).
   - **4.3 (Spam / Design Guidelines)** — not applicable, single app.
   - **2.3.1 (Accurate Metadata)** — cross-check against `SKU.md §4`'s
     feature matrix before replying; the MAS build genuinely lacks AI and
     external-folder storage, so if a screenshot implies otherwise, it's
     likely stale marketing asset reuse from the direct channel, not a
     wrong review call.
4. After resolving, add the new pattern to this file so it's covered next
   time.

---

## Housekeeping notes for whoever runs this playbook

- **Every code-referencing line number above was read directly off the
  `mas-pilot` branch on 2026-07-12.** If Role 1 has touched `billing.html`,
  `main.js`, `preload.js`, or the `build/entitlements.mas*.plist` files
  since, re-grep before pasting a response that cites a line number.
- Do not generate or reference actual Pro license keys in any Resolution
  Center response — restore/purchase flows only concern the MAS IAP path,
  never the Ed25519 direct-channel keys (`SKU.md §5`).
- Do not submit anything yourself — this file's output is drafts for the
  owner's review, per the Role 5 mandate in `TEAM.md §0.1`.
