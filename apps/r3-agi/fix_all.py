#!/usr/bin/env python3
import os, subprocess, json

P = os.path.expanduser("~/Agi-Suite/apps/r3-agi")

# 1. Fix tsconfig.json with CORRECT paths
config = {
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": True,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": True,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": True,
        "resolveJsonModule": True,
        "isolatedModules": True,
        "noEmit": True,
        "jsx": "react-jsx",
        "strict": True,
        "noUnusedLocals": True,
        "noUnusedParameters": True,
        "noFallthroughCasesInSwitch": True,
        "baseUrl": ".",
        "paths": {
            "@/*": ["src/*"],
            "@/components/*": ["src/components/ui/*"],
            "@/components/ui/*": ["src/components/ui/*"],
            "@/tokens/*": ["src/ui/tokens/*"],
            "@/primitives/*": ["src/ui/components/*"]
        }
    },
    "include": ["src/**/*.ts", "src/**/*.tsx"],
    "exclude": ["node_modules", "dist", "build"]
}
with open(os.path.join(P, "tsconfig.json"), "w") as f:
    json.dump(config, f, indent=2)
print("[+] tsconfig.json fixed")

# 2. Fix vite.config.ts
vite = '''import { defineConfig, transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/src\\/.*\\.js$/)) return null;
        return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/components": path.resolve(__dirname, "src/components/ui"),
      "@/tokens": path.resolve(__dirname, "src/ui/tokens"),
      "@/primitives": path.resolve(__dirname, "src/ui/components"),
    },
  },
  server: {
    host: true,
    port: 5176,
    strictPort: false,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});'''
with open(os.path.join(P, "vite.config.ts"), "w") as f:
    f.write(vite)
print("[+] vite.config.ts restored")

# 3. Fix unused agentStatuses
asp = os.path.join(P, "src/components/AgentSuitePanel.tsx")
c = open(asp).read()
c = c.replace(
    "const [agentStatuses, setAgentStatuses]",
    "const [_agentStatuses, setAgentStatuses]"
)
open(asp, "w").write(c)
print("[+] Fixed unused variable in AgentSuitePanel.tsx")

# 4. Run TypeScript
print("[+] Running pnpm tsc --noEmit...")
r = subprocess.run(["pnpm", "tsc", "--noEmit"], cwd=P, capture_output=True, text=True, timeout=120)
print("[+]" if r.returncode == 0 else "[-]", "TypeScript:", "PASS" if r.returncode == 0 else r.stdout or r.stderr)
