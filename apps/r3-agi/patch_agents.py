#!/usr/bin/env python3
import os, sys, subprocess
P = os.path.expanduser("~/Agi-Suite/apps/r3-agi")
F = os.path.join(P, "src/components/AgentSuitePanel.tsx")
c = open(F).read()
o = c

# 1. Add status field
c = c.replace('  color: string;', '  color: string;\n  status: "online" | "offline" | "busy";', 1)

# 2. Replace AGENTS array
s = c.find('const AGENTS: AgentDef[] = [')
e = c.find('];', s) + 2
if s > 0 and e > s:
    agents = '''const AGENTS: AgentDef[] = [
  { id: "wire", category: "PRIME", name: "The Wire", role: "Prime Directive", icon: "⬡", color: T.acid, status: "online", sources: ["Wire.txt"], quickActions: ["Invariants?","Hard stops?","Final Principle?"], systemPrompt: "You are The Wire — supreme session contract authority." },
  { id: "constitution", category: "PRIME", name: "Constitution", role: "Hard Guards", icon: "⚖", color: T.acid, status: "online", sources: ["CLAUDE.md"], quickActions: ["8 Hard Guards?","MVP queue?","PRD gates?"], systemPrompt: "You are the Constitution — project identity authority." },
  { id: "llpte", category: "AI PIPELINE", name: "LLPTE Oracle", role: "Pipeline SLAs", icon: "≋", color: T.violet, status: "online", sources: ["llpte.md"], quickActions: ["Node order?","Hard SLAs?","Confidence gating?"], systemPrompt: "You are the LLPTE Oracle — AI pipeline expert." },
  { id: "arch", category: "AI PIPELINE", name: "Arch Agent", role: "System Architecture", icon: "◈", color: T.violet, status: "online", sources: ["ARCHITECTURE.md"], quickActions: ["WASM arch?","WebGPU?","Tick loop?"], systemPrompt: "You are the Arch Agent — system architecture authority." },
  { id: "design", category: "INTERFACE", name: "Design Oracle", role: "UI/UX Tokens", icon: "◉", color: T.cyan, status: "online", sources: ["DESIGN_SYSTEM.md"], quickActions: ["Palette?","Spacing?","Elevations?"], systemPrompt: "You are the Design Oracle — design system authority." },
  { id: "demo", category: "INTERFACE", name: "Demo Director", role: "Onboarding", icon: "▶", color: T.cyan, status: "online", sources: ["DEMO.md"], quickActions: ["First-time flow?","Tier demo?","Onboarding?"], systemPrompt: "You are the Demo Director — user experience authority." },
  { id: "schema", category: "DATA LAYER", name: "Schema Architect", role: "DB Schema", icon: "▤", color: T.emerald, status: "online", sources: ["drizzle/schema.ts"], quickActions: ["13 tables?","aiDecisionLog?","Migration 0005?"], systemPrompt: "You are the Schema Architect — database authority." },
  { id: "auth", category: "DATA LAYER", name: "Auth Guardian", role: "Security", icon: "🔒", color: T.emerald, status: "online", sources: ["auth.md"], quickActions: ["JWT flow?","Middleware?","Routes?"], systemPrompt: "You are the Auth Guardian — security authority." },
  { id: "builder", category: "BUILD", name: "Build Master", role: "CI/CD", icon: "🔧", color: T.amber, status: "online", sources: ["turbo.json"], quickActions: ["Pipeline?","Railway?","Scripts?"], systemPrompt: "You are the Build Master — deployment authority." },
  { id: "tester", category: "BUILD", name: "Test Runner", role: "Testing", icon: "✓", color: T.amber, status: "online", sources: ["vitest.config.ts"], quickActions: ["Coverage?","Run test?","Fixtures?"], systemPrompt: "You are the Test Runner — testing authority." },
  { id: "guardian", category: "QUALITY", name: "Code Guardian", role: "Type Safety", icon: "🛡", color: T.red, status: "online", sources: ["CLAUDE.md"], quickActions: ["TSC errors?","Violations?","Fix any?"], systemPrompt: "You are the Code Guardian — quality authority." },
  { id: "auditor", category: "QUALITY", name: "Security Auditor", role: "Compliance", icon: "🔍", color: T.red, status: "online", sources: ["SECURITY.md"], quickActions: ["Posture?","Vulnerabilities?","Rate limits?"], systemPrompt: "You are the Security Auditor — compliance authority." },
  { id: "analyst", category: "STRATEGY", name: "Business Analyst", role: "Metrics", icon: "📊", color: T.z400, status: "online", sources: ["VALUATION.md"], quickActions: ["Valuation?","Acceptance?","Growth?"], systemPrompt: "You are the Business Analyst — strategy authority." },
  { id: "planner", category: "STRATEGY", name: "Roadmap Planner", role: "MVP Queue", icon: "🗺", color: T.z400, status: "online", sources: ["ROADMAP.md"], quickActions: ["MVP status?","P0 blockers?","Schedule?"], systemPrompt: "You are the Roadmap Planner — planning authority." },
];'''
    c = c[:s] + agents + c[e:]

# 3. Add status polling
c = c.replace("  const [convos, setConvos] =", "  const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({});\n  const [convos, setConvos] =", 1)

old = "  const msgs = convos[activeId] ?? [];"
new = '''  // Real-time status polling
  useEffect(() => {
    if (!isOpen) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/agents/status");
        if (res.ok) {
          const data = await res.json();
          setAgentStatuses(data.statuses ?? {});
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const msgs = convos[activeId] ?? [];'''
c = c.replace(old, new, 1)

if c != o:
    open(F, "w").write(c)
    print("[+] Patched: 14 agents, status field, real-time polling")
    r = subprocess.run(["npx", "tsc", "--noEmit"], cwd=P, capture_output=True, text=True, timeout=60)
    print("[+]" if r.returncode == 0 else "[-]", "TypeScript:", "PASS" if r.returncode == 0 else r.stdout or r.stderr)
else:
    print("[*] No changes")
