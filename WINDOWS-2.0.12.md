# BillNgai 2.0.12 Windows build — 2026-10-01

Built on `doisaket-pc` through `ssh pc` (New55, Tailscale 100.93.117.57).
Windows NT 10.0.26200, AMD64, Node 24.12.0, npm 11.19.0.
Source: release worktree HEAD `c303ac3` (release source `1dcbf0a`, v2.0.12),
isolated branch `codex/windows-2.0.12`. No runtime app changes.

## Build changes

- Explicit `npm run dist:win`: electron-builder NSIS x64, publish never.
- Existing appId/productName retained; existing PNG icon converted by electron-builder.
- One-click per-user installer, no automatic launch, keep data on uninstall.
- Storage test injects failure with `path.basename` instead of a POSIX-only slash check.
- First-use native test seeds an isolated config to prevent old-profile migration.
- Mac release settings untouched. Release packaging/test changes are committed separately under the Windows tag.

## Verified

- `npm ci` with pinned Electron 43.7.3 and electron-builder 26.15.3 on Windows.
- 253/253 tests pass (initial run found the path-specific test bug above).
- Source and packaged OAuth configuration validation pass.
- Eight packaged runtime source files byte-match build source; packaged version/entry point verified.
  electron-builder strips development metadata from packaged package.json, so metadata is checked separately.
- Packaged Windows executable passed `prepublish-electron-smoke`,
  `receipt-reissue-electron-smoke`, and `design-fixes-electron-smoke`.
  These cover first-use setup, quotation/invoice/payment/receipt, TH/EN UI,
  corrected receipt batches, frozen PDF generation, backups, reload and ledger protection.
- Tests used temporary synthetic profiles; owner data was not used or copied.
- Logs: `review/2026-10-01-windows/`.
- Initial MiMo review timed out; subsequent mimo-v2.6-pro release review completed and was reviewed by Codex. Source provenance, storage, upgrade, changelog and public-download checks accepted; no separate approval requirement inferred from worker suggestions.

## Artifact

- Mac: `dist/windows-2.0.12/BillNgai-2.0.12-x64-Setup.exe` (104982162 bytes).
- PC: `C:\Users\New55\BillNgai-builds\2.0.12\dist\BillNgai-2.0.12-x64-Setup.exe`.
- SHA-256, independently matching both machines: `98e43635ce8622fafc8e7a96462696aac54b3ecfb012b3f92b0aa293d63d3d56`.
- Authenticode status: **NotSigned**. This is an unsigned Windows build for review.
- Installer upgrade from 2.0.1 passed on Windows 11: rollback app/profile backup created, 200 profile files byte-identical, installed app.asar matches the build. Uninstall retention not exercised.
- Live Google login / multi-device cloud sync on Windows not exercised.
- Release continuation authorized by owner: follow DEPLOYMENT.md, publish Windows as unsigned Beta with a separate `v2.0.12-windows` tag; retain original Mac tag/assets. Public verification recorded below once complete.

## Continue

Build folder on PC: `C:\Users\New55\BillNgai-builds\2.0.12`.
QA-only Playwright 1.58.2 in sibling `qa-tools/node_modules`; set NODE_PATH there for native tests.
Do not run the stale `packaged-electron-smoke.cjs` as a release gate: it still asserts retired sync behavior.
The PDF-output smoke uses macOS-specific PDF tools; receipt-reissue smoke produced Windows PDFs instead.
Keep OAuth configuration out of worker packets and version control. No private signing keys or customer profiles transferred.
Windows remains unsigned Beta; live Windows sync and uninstall checks are outstanding and disclosed. Signing is not claimed.

## Release continuation verification

- Native storage smoke passed: missing external store, recovery, save/reload, TH/EN backups, frozen receipt/PDF and failed-save containment.
- Renderer syntax covered by passing containment unit test; translation coverage covered by passing design-fixes native test.
- Package and package-lock both remain 2.0.12; this adds the Windows channel, not a new Mac version.
- Installed-app first-use workflow is additionally exercised after upgrade.
- Original Mac v2.0.12 tag and artifacts remain immutable.

## Published Windows Beta — 2026-10-01

- Packaging source commit `d2be9de886f7bfed6d0b9f6f5bf6f967c453d449`; tag `v2.0.12-windows`.
- GitHub prerelease: https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.12-windows
- R2 installer: https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.12-x64-Setup.exe
- R2 checksum: same base URL, `BillNgai-2.0.12-windows-SHA256SUMS.txt`.
- Anonymous R2 and GitHub downloads match the tested SHA-256 above. 22 packaged files match the tagged source.
- Website commit `9f9da94`, Pages production deployment `https://7af09659.billiong-landing.pages.dev`.
- Live homepage and support page verified: Windows 2.0.12 Beta, unsigned and live-sync limitations, valid R2 and GitHub fallback links.
- Mac tag/assets retained; existing release notes now link to the separate Windows Beta.
- PC upgraded at `C:\Users\New55\AppData\Local\Programs\billngai-app\BillNgai.exe`.
- Rollback backup: `C:\Users\New55\BillNgai-builds\2.0.12\rollback-2.0.1`.
  Retain until owner no longer needs rollback; contains private profile copies and must not be uploaded.
- Installed-app workflow passed with an isolated synthetic profile. No owner-profile launch performed.
- Public Windows is intentionally Beta: Authenticode signing, live Windows cloud sync, uninstall retention and other Windows versions remain open.
