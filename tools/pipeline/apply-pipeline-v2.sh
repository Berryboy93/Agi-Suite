#!/usr/bin/env bash

set -euo pipefail

TARGET="$HOME/Agi-Suite/tools/pipeline/sandbox-to-ast-pipeline.js"
BACKUP="$TARGET.bak.$(date +%s)"

echo "[PIPELINE-INSTALL] starting safe upgrade..."

# -----------------------------
# 1. VERIFY FILE EXISTS
# -----------------------------
if [ ! -f "$TARGET" ]; then
  echo "[ERROR] target pipeline not found: $TARGET"
  exit 1
fi

# -----------------------------
# 2. BACKUP CURRENT VERSION
# -----------------------------
cp "$TARGET" "$BACKUP"
echo "[PIPELINE-INSTALL] backup created: $BACKUP"

# -----------------------------
# 3. WRITE NEW PIPELINE (ATOMIC)
# -----------------------------
TMP_FILE=$(mktemp)

cat > "$TMP_FILE" << 'EOF'
// ===== PIPELINE v2 (SAFE AST CODEMOD ENGINE) =====

#!/usr/bin/env node

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Project } from "ts-morph";

const ROOT = process.cwd();

console.log("[PIPELINE-v2] sandbox → AST diff compiler initializing...");

// -----------------------------
const reportPath = path.join(ROOT, "sandbox-report.json");

if (!fs.existsSync(reportPath)) {
  console.error("[PIPELINE] missing sandbox-report.json");
  process.exit(1);
}

const sandbox = JSON.parse(fs.readFileSync(reportPath, "utf-8"));

const project = new Project({
  tsConfigFilePath: path.join(ROOT, "tsconfig.json"),
});

function isSafe(entry) {
  return entry.safeToPropose === true &&
         entry.score >= 85 &&
         entry.impactedCount === 0;
}

function resolveFile(filePath) {
  return project
    .getSourceFiles()
    .find(f => f.getFilePath().endsWith(filePath));
}

function transform(file) {
  const clone = file.copy();

  clone.getImportDeclarations().forEach(imp => {
    if (
      imp.getNamedImports().length === 0 &&
      !imp.getDefaultImport()
    ) {
      imp.remove();
    }
  });

  return {
    before: file.getFullText(),
    after: clone.getFullText(),
  };
}

function diff(file, before, after) {
  const a = before.split("\n");
  const b = after.split("\n");

  let out = `diff --git a/${file} b/${file}\n`;
  out += `--- a/${file}\n+++ b/${file}\n`;

  const max = Math.max(a.length, b.length);

  for (let i = 0; i < max; i++) {
    if (a[i] !== b[i]) {
      if (a[i]) out += `-${a[i]}\n`;
      if (b[i]) out += `+${b[i]}\n`;
    }
  }

  return out;
}

const patchesDir = path.join(ROOT, "patches");
if (!fs.existsSync(patchesDir)) fs.mkdirSync(patchesDir);

let count = 0;

for (const entry of sandbox) {
  if (!isSafe(entry)) continue;

  const file = resolveFile(entry.file);
  if (!file) continue;

  const transformed = transform(file);

  if (transformed.before === transformed.after) continue;

  const patch = diff(entry.file, transformed.before, transformed.after);

  const id = crypto
    .createHash("md5")
    .update(entry.file)
    .digest("hex")
    .slice(0, 10);

  fs.writeFileSync(
    path.join(patchesDir, `${id}.patch`),
    patch
  );

  console.log("[PIPELINE] patch generated:", entry.file);
  count++;
}

console.log("\n[PIPELINE-v2] COMPLETE");
console.log("patches generated:", count);
EOF

# -----------------------------
# 4. SYNTAX CHECK (NODE VALIDATION)
# -----------------------------
echo "[PIPELINE-INSTALL] validating syntax..."

node -c "$TMP_FILE"

# -----------------------------
# 5. APPLY ONLY IF VALID
# -----------------------------
mv "$TMP_FILE" "$TARGET"

chmod +x "$TARGET"

echo "[PIPELINE-INSTALL] upgrade complete ✔"
echo "[PIPELINE-INSTALL] backup stored at: $BACKUP"
