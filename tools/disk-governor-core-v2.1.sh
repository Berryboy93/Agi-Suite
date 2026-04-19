set +e

bash "$HOME/Agi-Suite/tools/disk-governor-core-v2.1.sh"
DISK_STATUS=$?

set -e

echo "[RHOS] disk-governor exit code: ${DISK_STATUS}"

# ----------------------------
# CRITICAL FAILURE
# ----------------------------
if [ "${DISK_STATUS}" -eq 1 ]; then
  echo "[RHOS] CRITICAL DISK FAILURE"
  exit 1
fi

# ----------------------------
# DEGRADED STATE (SAFE TO CONTINUE)
# ----------------------------
if [ "${DISK_STATUS}" -eq 2 ]; then
  echo "[RHOS] DISK DEGRADED (warning level)"
  # continue allowed execution
fi

# ----------------------------
# OK STATE
# ----------------------------
if [ "${DISK_STATUS}" -eq 0 ]; then
  echo "[RHOS] DISK OK"
fi

# ----------------------------
# UNKNOWN / FUTURE EXIT CODES (FAIL SAFE)
# ----------------------------
if [ "${DISK_STATUS}" -ne 0 ] && [ "${DISK_STATUS}" -ne 1 ] && [ "${DISK_STATUS}" -ne 2 ]; then
  echo "[RHOS] UNKNOWN DISK STATE - FAIL SAFE TRIGGERED"
  exit 1
fi
