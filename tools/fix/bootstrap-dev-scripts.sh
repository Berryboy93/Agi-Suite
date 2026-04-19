#!/usr/bin/env bash
set -euo pipefail

echo "🧠 AGI-SUITE SELF-BOOTSTRAP FIXER v2 (PATH SAFE)"

# ALWAYS resolve repo root regardless of where script is executed
ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

echo "📍 Repo root detected: $ROOT_DIR"

APPS=(
  "apps/api-server"
  "apps/r3-agi"
)

echo "📦 Checking workspace apps..."

for APP in "${APPS[@]}"; do
  PKG="$ROOT_DIR/$APP/package.json"

  if [ ! -f "$PKG" ]; then
    echo "❌ Missing $PKG — creating minimal scaffold..."

    mkdir -p "$ROOT_DIR/$APP"

    cat > "$PKG" <<EOF
{
  "name": "@workspace/$(basename $APP)",
  "version": "0.0.0",
  "private": true,
  "scripts": {}
}
EOF
  fi

  echo "🔧 Processing $APP"

  node - <<EOF
const fs = require('fs');

const path = "$PKG";
const pkg = JSON.parse(fs.readFileSync(path, 'utf-8'));

pkg.scripts = pkg.scripts || {};

if (path.includes("api-server")) {
  pkg.scripts.dev = pkg.scripts.dev || "tsx watch src/index.ts";
  pkg.scripts.start = pkg.scripts.start || "node dist/index.js";
}

if (path.includes("r3-agi")) {
  pkg.scripts.dev = pkg.scripts.dev || "vite --host";
  pkg.scripts.build = pkg.scripts.build || "vite build";
}

fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
console.log("✔ Updated:", path);
EOF

done

echo "🧱 Ensuring entrypoints..."

mkdir -p apps/api-server/src
mkdir -p apps/r3-agi/src

if [ ! -f apps/api-server/src/index.ts ]; then
cat > apps/api-server/src/index.ts << 'EOF'
import express from "express";

const app = express();

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.listen(3001, () => {
  console.log("API running on http://localhost:3001");
});
EOF
fi

if [ ! -f apps/r3-agi/index.html ]; then
cat > apps/r3-agi/index.html << 'EOF'
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>R3 AGI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF
fi

if [ ! -f apps/r3-agi/src/main.tsx ]; then
cat > apps/r3-agi/src/main.tsx << 'EOF'
console.log("R3 AGI booted");
document.getElementById("root")!.innerHTML = "R3 AGI ONLINE";
EOF
fi

echo "📦 Running pnpm install..."
pnpm install

echo "🚀 DONE — run: pnpm dev"