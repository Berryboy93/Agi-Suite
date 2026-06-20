import { useState } from "react";
import { Card } from "@/components/Card";

const PIPELINE: {
  id: string;
  label: string;
  role: string;
  color: string;
  activeBorder: string;
  icon: string;
  file: string;
}[] = [
  {
    id: "agi-cmd",
    label: "agi-cmd.ts",
    role: "CLI Entry",
    color: "var(--accent)",
    activeBorder: "rgba(163,230,53,.45)",
    icon: "▶",
    file: "tools/agi-cmd.ts",
  },
  {
    id: "orchestrator",
    label: "orchestrator",
    role: "Flow Control",
    color: "var(--violet)",
    activeBorder: "rgba(139,92,246,.45)",
    icon: "⬡",
    file: "tools/core/orchestrator.ts",
  },
  {
    id: "auditor",
    label: "auditor",
    role: "Hygiene Scanner",
    color: "#00e5ff",
    activeBorder: "rgba(0,229,255,.4)",
    icon: "◈",
    file: "tools/agents/auditor.ts",
  },
  {
    id: "refactor",
    label: "refactor",
    role: "Patch Generator",
    color: "var(--warn)",
    activeBorder: "rgba(245,158,11,.4)",
    icon: "⊕",
    file: "tools/agents/refactor.ts",
  },
  {
    id: "validator",
    label: "validator",
    role: "Triple Check",
    color: "var(--done)",
    activeBorder: "rgba(16,185,129,.45)",
    icon: "▷",
    file: "tools/agents/validator.ts",
  },
  {
    id: "patch",
    label: "patch.ts",
    role: "Safe Apply",
    color: "var(--acid)",
    activeBorder: "rgba(163,230,53,.45)",
    icon: "⚡",
    file: "tools/utils/patch.ts",
  },
];

const AGENTS: Record<string, { desc: string; code: string }> = {
  "agi-cmd": {
    desc: "CLI entry point. Parses command and routes to orchestrator. Run: pnpm agi fix:hygiene or pnpm agi audit",
    code: `#!/usr/bin/env node
import { runCommand } from "./core/orchestrator";

const cmd = process.argv[2];

async function main() {
  switch (cmd) {
    case "fix:hygiene":
      await runCommand({ type: "FIX_HYGIENE" });
      break;
    case "audit":
      await runCommand({ type: "AUDIT_FULL" });
      break;
    default:
      console.log("Usage: agi [fix:hygiene | audit]");
  }
}

main();`,
  },
  orchestrator: {
    desc: "Controls the full flow. Calls auditor → refactor → validator → apply. Self-heal loop retries up to 3× on validation failure.",
    code: `export async function runCommand(input: { type: string }) {
  const findings = await auditRepo();
  if (!findings.length) { console.log("✓ No issues"); return; }

  const patch = await generatePatch(findings);

  let attempts = 0;
  while (attempts < 3) {
    const result = await validatePatch(patch);
    if (result.pass) { await applyPatch(patch); break; }
    attempts++;
    console.log("Retrying patch...", attempts);
  }
}`,
  },
  auditor: {
    desc: "Scans the repo for hygiene violations. Runs TSC, greps for : any usage and console.log. Returns typed issue list.",
    code: `export async function auditRepo(): Promise<string[]> {
  const issues: string[] = [];
  try {
    execSync("pnpm tsc --noEmit", { stdio: "pipe" });
  } catch { issues.push("TSC_ERRORS"); }

  const grepAny = execSync(\`grep -r ": any" . || true\`).toString();
  if (grepAny) issues.push("ANY_USAGE");

  const logs = execSync(\`grep -r "console.log" . || true\`).toString();
  if (logs) issues.push("CONSOLE_LOG");

  return issues;
}`,
  },
  refactor: {
    desc: "Generates scoped find/replace patches per finding. Converts console.log → structured logger, : any → : unknown.",
    code: `export async function generatePatch(findings: string[]) {
  const patches: { file: string; find: string; replace: string }[] = [];

  if (findings.includes("CONSOLE_LOG"))
    patches.push({ file: "server/index.ts",
      find: "console.log", replace: "// removed log" });

  if (findings.includes("ANY_USAGE"))
    patches.push({ file: "packages/",
      find: ": any", replace: ": unknown" });

  return patches;
}`,
  },
  validator: {
    desc: "Runs TSC + lint after every patch. Returns pass/fail. Orchestrator self-heal loop uses this result to decide retry or commit.",
    code: `export async function validatePatch(patch: any) {
  try {
    execSync("pnpm tsc --noEmit", { stdio: "pipe" });
    execSync("pnpm lint || true", { stdio: "pipe" });
    return { pass: true };
  } catch {
    return { pass: false };
  }
}`,
  },
  patch: {
    desc: "Safe file writer. Creates .bak backup before every write. Skips non-existent files. Uses replaceAll for full-file transforms.",
    code: `export async function applyPatch(patches: any[]) {
  for (const p of patches) {
    if (!fs.existsSync(p.file)) continue;
    const content = fs.readFileSync(p.file, "utf-8");
    const updated = content.replaceAll(p.find, p.replace);
    fs.writeFileSync(p.file + ".bak", content); // backup
    fs.writeFileSync(p.file, updated);
  }
}`,
  },
};

const COMMANDS = [
  {
    cmd: "pnpm agi fix:hygiene",
    desc: "Audit + auto-fix hygiene violations (any, console.log)",
    badge: "PRIMARY",
    color: "var(--acid)",
  },
  {
    cmd: "pnpm agi audit",
    desc: "Audit only — report findings, no patch applied",
    badge: "READ-ONLY",
    color: "var(--accent)",
  },
  {
    cmd: "pnpm tsc --noEmit",
    desc: "Manual TSC check — must be 0 errors before commit",
    badge: "ALWAYS RUN",
    color: "var(--done)",
  },
  {
    cmd: "python3 r3_hygiene.py",
    desc: "Dry-run hygiene audit — 10 phases, score 0–100",
    badge: "HYGIENE",
    color: "var(--violet)",
  },
  {
    cmd: "python3 r3_hygiene.py --apply",
    desc: "Apply hygiene fixes — deletes phantom dirs after confirm",
    badge: "DESTRUCTIVE",
    color: "var(--bad)",
  },
];

const UPGRADE_PATH = [
  {
    label: "AST transforms (ts-morph)",
    desc: "Replace string find/replace with AST-aware refactors — safer, handles renames",
    status: "future",
  },
  {
    label: "Per-package scoping (--filter)",
    desc: "pnpm --filter llpte-ai exec agi fix — isolate patches to one package",
    status: "future",
  },
  {
    label: "Log actions → aiDecisionLog",
    desc: "Every AGI CMD action becomes a labeled engineering decision — feeds data flywheel",
    status: "future",
  },
  {
    label: "Vitest runtime validation",
    desc: "Add pnpm test to validator step — 42+ cases must pass before commit",
    status: "future",
  },
  {
    label: "LLPTE-aware patch generator",
    desc: "Patch generator understands LLPTE contract — refuses changes that break pipeline SLA",
    status: "future",
  },
];

const FILE_TREE = [
  { path: "tools/", type: "dir", depth: 0 },
  {
    path: "agi-cmd.ts",
    type: "file",
    depth: 1,
    note: "CLI entry · pnpm agi <cmd>",
  },
  { path: "core/", type: "dir", depth: 1 },
  {
    path: "orchestrator.ts",
    type: "file",
    depth: 2,
    note: "Flow control + self-heal loop",
  },
  { path: "agents/", type: "dir", depth: 1 },
  { path: "auditor.ts", type: "file", depth: 2, note: "TSC + grep scanner" },
  { path: "refactor.ts", type: "file", depth: 2, note: "Patch generator" },
  {
    path: "validator.ts",
    type: "file",
    depth: 2,
    note: "Triple-check pipeline",
  },
  { path: "utils/", type: "dir", depth: 1 },
  {
    path: "patch.ts",
    type: "file",
    depth: 2,
    note: "Safe file apply + .bak backup",
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div
      style={{
        position: "relative",
        background: "rgba(0,0,0,.5)",
        border: "1px solid var(--border)",
        borderRadius: 3,
        padding: "10px 12px",
        marginTop: 8,
      }}
    >
      <button
        onClick={copy}
        style={{
          position: "absolute",
          top: 6,
          right: 8,
          fontFamily: "var(--mono)",
          fontSize: 8,
          padding: "2px 7px",
          borderRadius: 2,
          background: copied ? "rgba(16,185,129,.15)" : "rgba(255,255,255,.04)",
          border: "1px solid var(--border)",
          color: copied ? "var(--done)" : "var(--dim)",
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        {copied ? "COPIED" : "COPY"}
      </button>
      <pre
        style={{
          margin: 0,
          fontFamily: "var(--mono)",
          fontSize: 9,
          color: "var(--text2)",
          lineHeight: 1.7,
          overflowX: "auto",
          whiteSpace: "pre",
          paddingRight: 40,
        }}
      >
        {code}
      </pre>
    </div>
  );
}

export function AGICmdView() {
  const [selected, setSelected] = useState("agi-cmd");
  const agent = AGENTS[selected];
  const node = PIPELINE.find((n) => n.id === selected)!;

  return (
    <>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: 14,
          marginBottom: 13,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <span style={{ color: "var(--acid)", fontSize: 14 }}>⬡</span>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            AGI CMD v3 — Autonomous Hygiene System
          </span>
          <div style={{ marginLeft: "auto" }}>
            <span
              style={{
                fontSize: 9,
                padding: "2px 8px",
                borderRadius: 2,
                background: "rgba(163,230,53,.08)",
                border: "1px solid rgba(163,230,53,.2)",
                color: "var(--acid)",
                letterSpacing: 1,
              }}
            >
              tools/ · pnpm agi
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {PIPELINE.map((node, i) => (
            <div
              key={node.id}
              style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <div
                onClick={() => setSelected(node.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "8px 11px",
                  borderRadius: 3,
                  cursor: "pointer",
                  background:
                    selected === node.id
                      ? `rgba(163,230,53,.06)`
                      : "rgba(255,255,255,.02)",
                  border: `1px solid ${selected === node.id ? node.activeBorder : "rgba(255,255,255,.07)"}`,
                  transition: "all .15s ease",
                }}
              >
                <div style={{ fontSize: 14, color: node.color }}>
                  {node.icon}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: selected === node.id ? node.color : "var(--text2)",
                    fontWeight: selected === node.id ? 700 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {node.label}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: "var(--dim)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {node.role}
                </div>
              </div>
              {i < PIPELINE.length - 1 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--dim)",
                    padding: "0 4px",
                    animation: "arrowPulse 2s ease-in-out infinite",
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${node.activeBorder}`,
          borderRadius: 3,
          padding: 14,
          marginBottom: 13,
          transition: "border-color .3s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 14, color: node.color }}>{node.icon}</span>
          <span
            style={{
              fontFamily: "var(--sans)",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {node.label}
          </span>
          <code style={{ fontSize: 9, color: "var(--text2)", marginLeft: 4 }}>
            {node.file}
          </code>
        </div>
        <div
          style={{
            fontSize: 10,
            color: "var(--text2)",
            lineHeight: 1.7,
            marginBottom: 4,
          }}
        >
          {agent?.desc ?? ""}
        </div>
        <CodeBlock code={agent?.code ?? ""} />
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--acid)" }}>▶</span> Commands
          </>
        }
      >
        {COMMANDS.map((c, i) => (
          <div
            key={c.cmd}
            style={{
              padding: "8px 0",
              borderBottom:
                i < COMMANDS.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 3,
              }}
            >
              <code
                style={{
                  fontSize: 10,
                  color: c.color,
                  fontFamily: "var(--mono)",
                }}
              >
                {c.cmd}
              </code>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 8,
                  padding: "1px 6px",
                  borderRadius: 2,
                  fontWeight: 700,
                  letterSpacing: 1,
                  flexShrink: 0,
                  background:
                    c.badge === "DESTRUCTIVE"
                      ? "rgba(255,61,113,.1)"
                      : "rgba(255,255,255,.04)",
                  color:
                    c.badge === "DESTRUCTIVE" ? "var(--bad)" : "var(--dim)",
                  border: `1px solid ${c.badge === "DESTRUCTIVE" ? "rgba(255,61,113,.2)" : "var(--border)"}`,
                }}
              >
                {c.badge}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text2)" }}>{c.desc}</div>
          </div>
        ))}
      </Card>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 3,
          padding: 13,
          marginBottom: 13,
        }}
      >
        <div
          style={{
            fontFamily: "var(--sans)",
            fontSize: 12,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span style={{ color: "var(--accent)" }}>⊞</span> File Structure —
          tools/
        </div>
        <div style={{ fontFamily: "var(--mono)" }}>
          {FILE_TREE.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 0",
                paddingLeft: item.depth * 16,
                fontSize: 10,
              }}
            >
              <span
                style={{
                  color: item.type === "dir" ? "var(--violet)" : "var(--text2)",
                  flexShrink: 0,
                }}
              >
                {item.type === "dir" ? "▸" : "◻"}
              </span>
              <span
                style={{
                  color: item.type === "dir" ? "var(--violet)" : "var(--text)",
                }}
              >
                {item.path}
              </span>
              {item.note && (
                <span style={{ fontSize: 9, color: "var(--dim)" }}>
                  — {item.note}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <Card
        title={
          <>
            <span style={{ color: "var(--dim)" }}>◈</span> Upgrade Path
            (optional next steps)
          </>
        }
      >
        {UPGRADE_PATH.map((u, i) => (
          <div
            key={u.label}
            style={{
              display: "flex",
              gap: 10,
              padding: "7px 0",
              borderBottom:
                i < UPGRADE_PATH.length - 1
                  ? "1px solid var(--border)"
                  : "none",
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--dim)",
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text2)",
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                {u.label}
              </div>
              <div
                style={{ fontSize: 9, color: "var(--dim)", lineHeight: 1.6 }}
              >
                {u.desc}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}
