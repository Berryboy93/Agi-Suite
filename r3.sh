#!/usr/bin/env bash
set -euo pipefail
echo "🔥 R3 SYSTEM BOOT SEQUENCE"
~/Agi-Suite/tools/dev/kill-ports.sh
~/Agi-Suite/tools/dev/doctor.sh
~/Agi-Suite/tools/dev/dev-kernel.sh
echo "🚀 SYSTEM ONLINE"
