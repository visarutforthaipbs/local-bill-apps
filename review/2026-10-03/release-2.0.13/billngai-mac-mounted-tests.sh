#!/bin/zsh
set -e
export NODE_PATH=/Users/lighthouse-control/.config/billngai/test-tools/node_modules
mkdir -p /tmp/billngai-2.0.13-mount
hdiutil attach -readonly -nobrowse -mountpoint /tmp/billngai-2.0.13-mount dist/2.0.13/BillNgai-2.0.13-universal.dmg > /tmp/billngai-2.0.13-mount.log
mac_release_exe=/tmp/billngai-2.0.13-mount/BillNgai.app/Contents/MacOS/BillNgai
mkdir -p review/2026-10-03/release-2.0.13/mac-packaged-logs
spctl --assess --type execute --verbose=2 /tmp/billngai-2.0.13-mount/BillNgai.app > review/2026-10-03/release-2.0.13/mac-packaged-logs/gatekeeper.log 2>&1
NODE_PATH="$PWD/node_modules" node /tmp/billngai-package-inventory.cjs /tmp/billngai-2.0.13-mount/BillNgai.app/Contents/Resources/app.asar > review/2026-10-03/release-2.0.13/mac-package-inventory.json
node /tmp/billngai-packaged-config.cjs "$mac_release_exe" > review/2026-10-03/release-2.0.13/mac-packaged-logs/config.log 2>&1
for mac_release_suite in prepublish receipt-reissue design-fixes payment-match stabilization fintech-ui brand-color audio pdf-output legacy-review; do
 node "test/$mac_release_suite-electron-smoke.cjs" "$mac_release_exe" > "review/2026-10-03/release-2.0.13/mac-packaged-logs/$mac_release_suite.log" 2>&1
 print "PASS: packaged $mac_release_suite"
done
print 'PASS: final read-only mounted notarized DMG, inventory, Gatekeeper and eleven packaged suites'
