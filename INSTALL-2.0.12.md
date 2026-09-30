# 2.0.12 release — Google Drive sync for Pro

**Installed 2026-09-30:** signed/notarized universal 2.0.12 at `/Applications/BillNgai.app`.

Owner direction: ship sync to all Pro users (Pro stays one-time ฿599 including sync), build for deployment and release.

## Scope

2.0.11 (clean PDF output, 2.0.10 first-receipt fixes) + the sync v3 pilot with its live-test fixes, disconnect,
Drive-copy reconnect, retry-safe number reservations, licence-checked access and plain error messages.
Production coordinator `billngai-sync-coordinator` deployed on the owner's Cloudflare account
(licence public key = app key, max 3 Google accounts per Pro key, no allow-list, rejected-subject logging off).
Staging coordinator remains for tests.

## Validation and artifacts

- Source commit `1dcbf0ad6fa635671c4253fd7870ba785bbd6352` (local). 253/253 app unit tests; 23/23 coordinator tests
  (5 licence tests); type check, syntax, 783 translation keys, release configuration and whitespace checks pass.
- All 13 native smokes pass on source; 10 packaged suites pass against the exact executable on a read-only mount of the final DMG.
  Note: `sync-v3-electron-smoke` always runs source; the packaged sync configuration was checked separately
  (`packaged-sync-config.log`): packaged build shows the Pro sync card, ignores the development URL, and points to production.
- Live two-Mac tests (lighthouse-control + lighthouse-field, staging with licence check on, allow-list empty): join, concurrent
  edit, concurrent numbering, payment, double payment, kill during issuance, token renewal after 3+ hours on both Macs,
  licence refusal and recovery, network loss at five points, lost reservation retry (no gap), disconnect, Drive-copy reconnect,
  and full regression. Evidence: `review/2026-09-30/sync-v3-live/`. Not tested live: a second Google account being refused
  (server unit tests only), more than 512 records, evidence-file sync, Intel hardware, Windows.
- Apple submission `8a1ce18c-e795-4a38-b953-ec42b918909f`: Accepted, no issues. Stapled and validated. App and DMG Gatekeeper: Notarized Developer ID.
- Final DMG `dist/2.0.12/BillNgai-2.0.12-universal.dmg`, 223,534,776 bytes, SHA-256
  `6d43fdfbbfbf4fd8442577f57bc70acc5ee1229b29330696de5793b965aedc60`. 22 packaged files match the commit;
  app.asar SHA-256 `28cd779f5d5867523183a80ad9b1697ddb845ac1bf6356b06cfeeebb01093b07`.
- 2.0.11 quit normally; profile backup 86 files byte-identical; installed app matches the mounted final app; launch on the
  owner profile and normal quit left `billing.json` unchanged; relaunched. The owner profile was not connected to sync.
- Backup directory `/Users/lighthouse-control/BillNgai-update-2.0.12` (profile, 2.0.11 app, final DMG, manifest).
  Rollback copy is 2.0.11; older 2.0.10 copies moved to the Trash (keep-one-rollback rule).

## Rollback

Quit normally, preserve the profile, restore `BillNgai-2.0.11-installed.app`. A profile that connected to sync in 2.0.12
carries a `syncV3` binding that 2.0.11 does not understand: stop syncing in 2.0.12 first (Settings → Data & backup), then roll back.
