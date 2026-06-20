cd ~/Agi-Suite/apps/r3-agi

cat > patch_agent_suite.py << 'PYEOF'
#!/usr/bin/env python3
import os
import sys
import subprocess

PROJECT_DIR = os.path.expanduser("~/Agi-Suite/apps/r3-agi")
FILE_PATH = os.path.join(PROJECT_DIR, "src/components/AgentSuitePanel.tsx")

def read_file():
    with open(FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def write_file(content):
    with open(FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def main():
    print("[+] Patching AgentSuitePanel.tsx...")
    
    if not os.path.exists(FILE_PATH):
        print("[-] File not found: " + FILE_PATH)
        sys.exit(1)
    
    content = read_file()
    original = content
    
    # Patch 1: Add status field to AgentDef interface
    old_color = "  color: string;"
    new_color = '  color: string;\n  status: "online" | "offline" | "busy";'
    if old_color in content:
        content = content.replace(old_color, new_color, 1)
        print("[+] Added status field to AgentDef interface")
    
    # Patch 2: Replace AGENTS array
    start_idx = content.find("const AGENTS: AgentDef[] = [")
    if start_idx != -1:
        search_start = start_idx + len("const AGENTS: AgentDef[] = [")
        end_idx = content.find("];", search_start)
        if end_idx != -1:
            end_idx += 2
            
            new_agents = '''const AGENTS: AgentDef[] = [
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
            
            content = content[:start_idx] + new_agents + content[end_idx:]
            print("[+] Replaced AGENTS array with 14 agents")
    
    # Patch 3: Add status polling
    old_state = "  const [convos, setConvos] ="
    new_state = "  const [agentStatuses, setAgentStatuses] = useState<Record<string, string>>({});\n  const [convos, setConvos] ="
    if old_state in content:
        content = content.replace(old_state, new_state, 1)
        print("[+] Added agentStatuses state")
    
    old_msgs = "  const msgs = convos[activeId] ?? [];"
    new_msgs = '''  // Real-time status polling
  useEffect(() => {
    if (!isOpen) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/agents/status");
        if (res.ok) {
          const data = await res.json();
          setAgentStatuses(data.statuses ?? {});
        }
      } catch {
        // Backend may not support this endpoint yet
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const msgs = convos[activeId] ?? [];'''
    
    if old_msgs in content:
        content = content.replace(old_msgs, new_msgs, 1)
        print("[+] Added real-time status polling")
    
    if content != original:
        write_file(content)
        print("[+] AgentSuitePanel.tsx patched successfully")
    else:
        print("[*] No changes made")
        return
    
    # Run TypeScript check
    print("[+] Running TypeScript check...")
    try:
        result = subprocess.run(
            ["npx", "tsc", "--noEmit"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print("[+] TypeScript check passed")
        else:
            print("[-] TypeScript errors:")
            print(result.stdout or result.stderr)
    except Exception as e:
        print("[!] TypeScript check failed: " + str(e))

if __name__ == "__main__":
    main()
PYEOF

python3 patch_agent_suite.py
