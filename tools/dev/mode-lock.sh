#!/usr/bin/env bash
set -euo pipefail

LOCKFILE="/tmp/r3-runtime.lock"

if [ -f "$LOCKFILE" ]; then
  echo "⚠️ Runtime already active. Preventing duplicate boot."
  exit 1
fi

echo $$ > "$LOCKFILE"

cleanup() {
  rm -f "$LOCKFILE"
}
trap cleanup EXIT
