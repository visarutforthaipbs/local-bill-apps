# BillNgai 2.0.13 Windows x64 Beta

Built on doisaket-pc through Tailscale SSH using isolated source directory
C:\Users\New55\BillNgai-builds\2.0.13. Source dd8e7ce (release/2.0.13).
Electron 43.7.3 / electron-builder 26.15.3; Windows 11 x64; Node24.12.0.
Existing app identity retained, per-user NSIS, no launch after installation,
no profile deletion on uninstall. Owner's installed app/profile unchanged.

264 tests pass; packaged first-use, receipt-reissue, design/TH-EN,
brand-color and audio suites pass using temporary synthetic profiles.
31 runtime/font/asset files byte-match source; embedded OAuth matches.
All five clay images and eleven audio clips included; mobile excluded.
Windows path separators were accounted for in the manager's asar inventory.
A PowerShell native stderr handling issue interrupted initial npm ci; resumed
with cmd redirection and explicit exit-code checks. No product code fix needed.

Artifact: dist/windows-2.0.13/BillNgai-2.0.13-x64-Setup.exe (110341943 bytes).
SHA-256: 72b9e214c6f18ac68fb0eda33f533915e3c479a3891ae9eab5014a9ce80b7a85.
Remote PC, local Mac, anonymous R2 and anonymous GitHub downloads all match.
Authenticode: NotSigned. This remains an unsigned Beta; other Windows versions
and this installer upgrade/uninstall were not exercised. Do not bypass security warnings.

Published tag v2.0.13-windows at dd8e7ce:
https://github.com/visarutforthaipbs/local-bill-apps/releases/tag/v2.0.13-windows
R2: https://pub-4ed16d146bff4f168839661507e1748a.r2.dev/BillNgai-2.0.13-x64-Setup.exe
Matching BillNgai-2.0.13-windows-SHA256SUMS.txt available beside the installer.
Previous 2.0.12 artifacts/tag remain immutable.

This is a UI/branding release over the unchanged 2.0.12 financial/sync runtime.
Earlier three-device live sync verified core scenarios but found canceled-login
feedback and dirty-close issues; those remain open/disclosed. Live Google login
was not repeated for 2.0.13. Mac Store and mobile are not updated by this release.
