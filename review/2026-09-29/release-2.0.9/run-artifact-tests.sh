#!/bin/zsh
set -euo pipefail
release_executable="$1"
export NODE_PATH=/Users/lighthouse-control/.config/billngai/test-tools/node_modules
for suite in packaged receipt-reissue design-fixes fintech-ui legacy-review payment-match stabilization; do
  echo "Testing $suite"
  node "test/$suite-electron-smoke.cjs" "$release_executable" > "review/2026-09-29/release-2.0.9/packaged-$suite.log" 2>&1
  echo "PASS $suite"
done
node /Users/lighthouse-control/.local/state/billngai-release-2.0.9/check-owner-copy.cjs "$release_executable" > /Users/lighthouse-control/.local/state/billngai-release-2.0.9/owner-copy.log 2>&1
echo 'PASS owner-copy'
