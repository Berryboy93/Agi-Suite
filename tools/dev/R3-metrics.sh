#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec python3 r3-metrics-sse-fix-1.py "$@"
