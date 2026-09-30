#!/bin/zsh
# Usage: launch.sh <app dir> <profile dir> <cdp port> <sync url>   — synthetic test profile only
cd "$1" || exit 1
export BILLNGAI_SYNC_V3_URL="$4"
export BILLNGAI_SYNC_V3_FAULTS_FILE="$2/../faults-$(basename $2).json"
echo '{}' > "$BILLNGAI_SYNC_V3_FAULTS_FILE"
exec ./node_modules/.bin/electron . --user-data-dir="$2" --remote-debugging-port="$3" > "$2/../launch-$(basename $2).log" 2>&1
