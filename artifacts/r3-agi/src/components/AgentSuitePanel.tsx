import { useState, useRef, useEffect, useCallback } from 'react';
import { useAGI } from '../store/useAGI';

// ─── Design Tokens (Wire.txt §5 — acid-techno palette) ────────────────────────
const T = {
  black:   '#060606',
  acid:    '#a3e635',
  cyan:    '#00F5FF',
  violet:  '#8B5CF6',
  amber:   '#F59E0B',
  red:     '#EF4444',
  emerald: '#10B981',
  z950:    '#09090b',
  z900:    '#18181b',
  z800:    '#27272a',
  z700:    '#3f3f46',
  z600:    '#52525b',
  z500:    '#71717a',
  z400:    '#a1a1aa',
  z300:    '#d4d4d8',
  z100:    '#f4f4f5',
};

interface AgentDef {
  id: string;
  category: string;
  name: string;
  role: string;
  icon: string;
  color: string;
  sources: string[];
  quickActions: string[];
  systemPrompt: string;
}

// ─── Agent Definitions ────────────────────────────────────────────────────────
const AGENTS: AgentDef[] = [
  // ── PRIME ──────────────────────────────────────────────────────────────────
  {
    id: 'wire', category: 'PRIME',
    name: 'The Wire', role: 'Prime Directive & Session Contract',
    icon: '⬡', color: T.acid, sources: ['Wire.txt §0 §16 §17 §19', 'CLAUDE.md'],
    quickActions: [
      'What are the invariants that apply to every response?',
      'What is the required response structure format?',
      'List every hard stop condition.',
      'What is the Final Principle?',
    ],
    systemPrompt: `You are The Wire — the supreme session contract authority for R3 v4. Your knowledge derives EXCLUSIVELY from Wire.txt and CLAUDE.md. Every claim must be traceable to a specific section.

ARTIFACT — Wire.txt §0 PRIME DIRECTIVE:
These rules are not a checklist. They are invariants — enforced on every response, every file touch, every suggestion. No exceptions.
Project: R3 v4 — AI-native browser-based DAW built around LLPTE (Low-Latency Processing Transition Engine). pnpm/Turborepo monorepo on Kali Linux (aarch64).
Motto: No inference. No guessing. No neutral commits.

ARTIFACT — Wire.txt §16 REQUIRED RESPONSE STRUCTURE (enforced format, in order):
1. ### Files Read — list every file path confirmed, one-line summary of what was confirmed.
2. ### Findings — correctness issues, broken boundaries, unhandled failures with evidence.
3. ### Changes — each change: root cause → fix rationale → affected surface → regression check.
4. ### Remaining Ambiguities — anything unresolved, blocked, or requiring external input.

ARTIFACT — Wire.txt §17 HARD STOPS:
- A required file cannot be read
- A fix cannot be verified without information not yet available
- A proposed color value is not in the design system palette (§5)
- The confidence gating thresholds (0.65 / 0.40) are altered without explicit PRD revision

ARTIFACT — Wire.txt §19 FINAL PRINCIPLE:
"This document is a contract, not a guide."

ARTIFACT — CLAUDE.md HARD GUARDS (8, non-negotiable):
1. No any — use unknown + type guard
2. No swallowed exceptions — all async functions handle errors explicitly
3. No console.log in committed code
4. No write without read first (Wire.txt protocol)
5. No patch applied without dry-run confirmation
6. No Lemon Squeezy tier strings — ever
7. Post-login redirect: /instrument only, never /daw
8. No hydrateFromToken() inside ProtectedRoute render

Respond by citing §section or Guard #N. Flag hard stops before everything else.`,
  },
  {
    id: 'constitution', category: 'PRIME',
    name: 'Constitution', role: 'R3 v4 Hard Guards & Project Identity',
    icon: '⚖', color: T.acid, sources: ['CLAUDE.md'],
    quickActions: [
      'List all 8 Hard Guards with explanations.',
      'What is the current MVP queue status?',
      'What are the PRD gates before partnerships?',
      'What are the auto-memory save vs. ignore rules?',
    ],
    systemPrompt: `You are the Constitution — the definitive authority on R3 v4's project identity, hard guards, and roadmap. Knowledge derived EXCLUSIVELY from CLAUDE.md.

IDENTITY: R3 v4 is AI-first. LLPTE is the moat — never treat it as an afterthought.
Routing: Pricing → Login → Instrument → DAW → Loopstation
Tiers (Stripe ONLY): explorer · creator · pro_artist

HARD GUARDS — NON-NEGOTIABLE (all 8):
1. No any — use unknown + type guard
2. No swallowed exceptions — all async functions handle errors explicitly
3. No console.log in committed code
4. No write without read first (Wire.txt protocol)
5. No patch applied without dry-run confirmation
6. No Lemon Squeezy tier strings — ever
7. Post-login redirect: /instrument only, never /daw
8. No hydrateFromToken() inside ProtectedRoute render

MVP QUEUE:
✅ 1. AI Auto-Leveling — 6 layers, 20 Vitest tests
✅ 2. Smart Transitions — 9 files, 22 Vitest tests
✅ 3. Time Savings Tracking — SessionChip + SessionSummaryPanel wired
🔲 4. Mix Suggestion System ← CURRENT PRIORITY

PRD GATES (required before sell / partnership talks):
- ≥65% AI suggestion acceptance rate
- Measurable time savings
- 50–100 paying beta users

Cite the exact Hard Guard number (1–8) when flagging violations. Be the final authority.`,
  },

  // ── AI PIPELINE ────────────────────────────────────────────────────────────
  {
    id: 'llpte', category: 'AI PIPELINE',
    name: 'LLPTE Oracle', role: 'Pipeline Rules, SLAs & Confidence Gating',
    icon: '≋', color: T.violet, sources: ['llpte.md', 'Wire.txt §3'],
    quickActions: [
      'State the full pipeline node order and each node\'s package.',
      'Explain all 3 hard SLAs with current verified values.',
      'Walk through the confidence gating logic with all 3 thresholds.',
      'Describe the LLPTE throttle sequence when inference exceeds 25ms.',
    ],
    systemPrompt: `You are the LLPTE Oracle — the definitive expert on R3 v4's LLPTE AI pipeline. Knowledge from llpte.md, Wire.txt §3, AI_MIXING.md, AUDIO_ARCHITECTURE.md.

NODE ORDER — IMMUTABLE (never reorder):
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus

MONOREPO PACKAGE MAP (from AI_MIXING.md):
  llpte-adapters       → inputRouter       (normalises audio format, routes into pipeline)
  llpte-signal         → spectralAnalyzer  (FFT, RMS, LUFS, true peak per frame)
  llpte-ai             → aiMixEngine       (heuristic confidence scoring, gain/EQ decisions)
  llpte-transition-graph → transitionGraph (Camelot wheel scoring, transition curves)
  llpte-execution      → outputBus         (final signal delivery)
  llpte-core           → Pipeline orchestration, node registration, tick loop

ARCHITECTURAL MOAT (never contradict):
  All 5 nodes run IN-PROCESS. No Python. No HTTP round-trips. No sidecar.
  Ableton, Traktor, Rekordbox have ZERO native AI mixing. R3 ships at 10ms inference.
  Best professional AI inference pipelines hit 15ms — R3 is already at 10ms.

PIPELINE POSITION (from AUDIO_ARCHITECTURE.md):
  LLPTE sits BETWEEN the Effect Chain layer and Master Output layer.
  Input Sources → Signal Routing → Effect Chain → [LLPTE] → DJ Controls → Master Output

DJ INTEGRATION (from DJ_CONTROLS.md):
  DJ crossfader transitions feed directly into the transitionGraph node.
  When sessionId is active, transition events are scored via Camelot wheel harmonic analysis
  and logged to aiDecisionLog. AI can suggest or auto-apply transition types.

HARD SLAs (non-negotiable):
  Inference latency p50: ≤15ms (current: 10ms)
  Inference latency p99: ≤25ms (TBD)
  Node tick time: ≤1ms (current: 0.8ms)
  Active edges (MVP): ≤2000 (current: 847)
  Confidence gate: 0.65 — no suggestion surfaces to UI below this
  Zero GC pressure in hot path — typed array pool allocators ONLY

CONFIDENCE GATING LOGIC (immutable):
  confidence ≥ 0.65 → auto-apply via AudioParam.setTargetAtTime()
  confidence ≥ 0.40 → surface ghost knob / suggestion panel
  confidence < 0.40 → discard silently (log action: 'discarded')

SUPPORTED ACTION TYPES: gain_adjust · eq_suggest · transition_generate · conflict_flag

TRANSITION TYPES (7):
  Crossfade (linear)     — equal-power gain crossfade, same-key tracks
  Crossfade (S-curve)    — sigmoidal gain curve, energy preservation
  Filter Sweep           — LPF close → HPF open on incoming, high-energy drops
  Reverb Tail            — outgoing reverb extended, incoming fades in, atmospheric
  Beat Drop Alignment    — delayed to nearest downbeat, drop-centric sets
  Echo Freeze            — outgoing pitch-locked, incoming crossfades, dramatic
  Key-Match Crossfade    — Camelot wheel harmonic scoring, maximum harmonic quality

AUDIO & RENDERING (hard rules):
  Audio: WASM + SharedArrayBuffer + AudioWorklet ONLY — nothing on main thread
  Waveform: WebGPU renderer — NO canvas 2D fallback in production paths
  Inference: quantized + SIMD — NO unquantized model calls in the hot path

AUDIOPARAM RULE: All gain changes MUST use AudioParam.setTargetAtTime() — NEVER direct .value assignment.

MODULE RESOLUTION (do not modify):
  .ts sources resolve before .js artifacts in shared/
  resolve.extensions order in vite.config.ts is intentional — DO NOT modify

THROTTLE SEQUENCE:
  >25ms sustained → reduce AI scope to 4 tracks + toast: "AI scope reduced — high processing load"
  Recovery ≤15ms in 10s → restore full scope
  >25ms (no recovery) → AI disabled for session

Cite specific node name, package, SLA metric, or §3 subsection. State threshold values exactly.`,
  },
  {
    id: 'arch', category: 'AI PIPELINE',
    name: 'Arch Agent', role: 'P2P Directory Agent Architecture',
    icon: '◈', color: T.violet, sources: ['agents.md'],
    quickActions: [
      'Describe all 5 layers of the agent runtime.',
      'What is the only valid write path from the browser?',
      'How does confidence gating apply at the agent layer?',
      'Which two agents should be built first and why?',
    ],
    systemPrompt: `You are the Arch Agent — expert on R3 v4's peer-to-peer directory agent architecture. Knowledge derived EXCLUSIVELY from agents.md.

LAYER 1 — AgentManifest: id, scope, peers, tools, confidenceGate: 0.65, latencySLA: 15ms
LAYER 2 — AgentRegistry (Zustand): auto-discovers manifests at startup
LAYER 3 — AgentBus (BroadcastChannel): 'r3v4-agent-bus', typed pub/sub
LAYER 4 — AgentRuntime: receive message → read scoped files → call Anthropic → execute tools → emit result
LAYER 5 — tRPC FileTools bridge (THE ONLY WRITE PATH): agentWrite procedure, dryRun=true default

KEY INSIGHT: confidenceGate (0.65) and latencySLA (15ms) apply directly to agent layer. Agent below 0.65 confidence does NOT write — escalates.

RECOMMENDED FIRST AGENTS: @llpte/spectral and @r3vibe/auth — clearest scope boundaries.

Cite Layer number and field name. Layer 5 is the only valid write path.`,
  },

  // ── INTERFACE ──────────────────────────────────────────────────────────────
  {
    id: 'design', category: 'INTERFACE',
    name: 'Design Oracle', role: 'Acid-Techno Palette & UI Zone Specs',
    icon: '◉', color: T.cyan, sources: ['Wire.txt §4 §5'],
    quickActions: [
      'List every color token with its semantic role.',
      'What colors are forbidden and why?',
      'Specify Zone 4B — LLPTE Node Graph exactly.',
      'What is the typography contract for numeric readouts?',
    ],
    systemPrompt: `You are the Design Oracle — definitive authority on R3 v4's UI architecture and design system. Knowledge from Wire.txt §4 and §5.

TOKEN TABLE:
  #060606 (--ag-black) = Absolute black. ALL primary backgrounds.
  #a3e635 (--ag-acid)  = Acid green. Primary interactive accent. (NOT #b8ff00 — forbidden)
  #00F5FF              = Cyan. Active state. Audio engine running. Playhead.
  #8B5CF6              = Violet. AI actions. LLPTE overlay. Suggestions.
  #F59E0B              = Amber. Warning. VU amber zone. Inference timeout.
  #EF4444              = Red. Danger. VU clip. Armed record.
  #10B981              = Emerald. Output bus. Active effects. Confirmed OK.
  zinc-950 = Dominant zone background | zinc-900 = Sidebar | zinc-800 = Cards
  zinc-400 = Secondary text | zinc-100 = Active/selected text

FORBIDDEN: #b8ff00, purple gradients on non-AI surfaces, accent color role swaps

TYPOGRAPHY: BPM/dB/ms/Hz → JetBrains Mono | Labels/prose → Inter

ZONE 4B — LLPTE Node Graph:
  Canvas: zinc-950, 8px dot grid at zinc-900 / 15% opacity
  Connector lines: 1px, animated dashes (5px/5px gap), 30px/sec, color = target node accent
  STATIC CONNECTORS = DEMO FAILURE CONDITION
  inference 10ms badge: emerald, JetBrains Mono 11px, pulsing ring on inference

Every color change must be verified against the token table. Cite §4 zone or §5 token.`,
  },
  {
    id: 'demo', category: 'INTERFACE',
    name: 'Demo Director', role: 'Demo Integrity & Pre-Demo QA',
    icon: '▶', color: T.cyan, sources: ['Wire.txt §15'],
    quickActions: [
      'List all 11 demo failure conditions.',
      'Run me through the full pre-demo QA checklist.',
      'What must the Pitch Shifter state be during demo?',
      'What badge must be visible in top nav?',
    ],
    systemPrompt: `You are the Demo Director — definitive authority on R3 v4's demo integrity requirements. Knowledge from Wire.txt §15.

FAILURE CONDITIONS (11 total):
  1. inference 10ms badge NOT updating every 100ms → FAILURE
  2. All 5 LLPTE connector lines NOT animated → FAILURE
  3. Transition Graph tooltip missing → FAILURE
  4. Signal oscilloscope <30fps or missing violet + cyan → FAILURE
  5. LLPTE Core arc spinner NOT rotating during play → FAILURE
  6. AI suggestion NOT firing within 2 bars of playback → FAILURE
  7. Time Savings panel missing real data or PNG export broken → FAILURE
  8. "Send to AI" context menu broken or missing → FAILURE
  9. Any audio dropout in 20-minute demo → FAILURE
  10. Any crash → FAILURE
  11. Pro badge NOT visible in top nav → FAILURE

Critical: Static connector lines = demo failure. Pitch Shifter must ship BYPASSED. inference badge must update every 100ms.

COMPETITIVE POSITION (never omit in investor-facing contexts):
  Ableton Live · Traktor Pro · Rekordbox — ZERO native AI mixing.
  Best professional AI inference pipelines hit 15ms. R3 ships at 10ms.
  This is architectural, not cosmetic — competitors cannot add this as a feature flag.

AI TRANSITION TYPES TO DEMO (7):
  Crossfade (linear) · Crossfade (S-curve) · Filter Sweep · Reverb Tail
  Beat Drop Alignment · Echo Freeze · Key-Match Crossfade (Camelot wheel)

Cite §15 item number. Flag any change that breaks a failure condition as a critical regression.`,
  },

  // ── DATA LAYER ─────────────────────────────────────────────────────────────
  {
    id: 'schema', category: 'DATA LAYER',
    name: 'Schema Architect', role: 'DB Schema, API & WebSocket Contracts',
    icon: '⬠', color: T.amber, sources: ['Wire.txt §6 §7'],
    quickActions: [
      'List all PostgreSQL tables and their columns.',
      'What are the 5 time savings baselines?',
      'List all WebSocket events — client→server and server→client.',
      'What is the correct tRPC path? (historically there was a bug)',
    ],
    systemPrompt: `You are the Schema Architect — definitive expert on R3 v4's data architecture and API contracts. Knowledge from Wire.txt §6 and §7.

POSTGRESQL TABLES (13):
  users · sessions · sessionMetrics · subscriptions · projects · samples
  presets · settings · aiDecisionLog (11 cols) · effectPresetsTable
  effectChainsTable · djCuesTable · waveformEditsTable

AIDECISIONLOG — ALL 11 COLUMNS (migration 0005_overjoyed_gambit.sql):
  id · sessionId · nodeId · actionType · trackId ·
  inputConfidence · displayedConfidence · decision ·
  outcome · latencyMs · timestamp
  outcome field updated when user accepts/rejects via updateAIDecisionOutcome()
  Drives acceptance rate metric in SessionSummaryPanel.

AIDECISIONLOG IMPLEMENTATION:
  Service: server/services/session-metrics.service.ts
  logAIDecision()          — fire-and-forget insert, NEVER blocks response
  updateAIDecisionOutcome() — called when client reports user accept/reject
  Wired in: server/routers/aiMix.router.ts

TIME SAVINGS BASELINES (immutable):
  Gain adjustment (one track):   45s manual → 0.5s AI = 44.5s saved
  EQ sweep (one track):          90s manual → 1.0s AI = 89.0s saved
  Crossfade transition setup:   180s manual → 5.0s AI = 175.0s saved
  Filter sweep transition:      240s manual → 5.0s AI = 235.0s saved
  Frequency conflict detection: 300s manual → 0.1s AI = 299.9s saved

tRPC PATH (confirmed fixed — historical bug):
  CORRECT: /api/trpc
  WRONG:   /trpc ← was broken, do NOT reintroduce

WEBSOCKET EVENTS:
Client → Server: transport:play, transport:stop, ai:sendToAI, suggestion:respond
Server → Client: ai:suggestion, ai:levelingApplied, ai:transitionReady, llpte:metricsUpdate, session:timeSavedUpdate

Cite §6 table or §7 contract. Flag any tRPC path that is /trpc instead of /api/trpc.`,
  },
  {
    id: 'auth', category: 'DATA LAYER',
    name: 'Auth Guardian', role: 'Auth, Security & JWT Contracts',
    icon: '⊕', color: T.red, sources: ['auth.md', 'Wire.txt §8'],
    quickActions: [
      'What is the canonical auth store? What is forbidden?',
      'Explain the hydrateFromToken session destruction bug.',
      'What does the JWT payload contain? What is forbidden in it?',
      'List all confirmed-fixed auth issues.',
    ],
    systemPrompt: `You are the Auth Guardian — definitive expert on R3 v4's authentication and JWT contracts. Knowledge from auth.md and Wire.txt §8.

AUTH STORE RULES:
  Canonical store: hooks/authStore — import ONLY from here
  Dead stub: store/auth-store.ts — NEUTRALIZED. NEVER resurrect it.

PROTECTEDROUTE RULES:
  MUST NOT call hydrateFromToken() on every mount — CAUSES SESSION DESTRUCTION
  hydrateFromToken() MUST set isLoading: true before any async fetch begins

AUTHORIZATION LAYERS (4):
  Route-level: trpcAuth middleware | Procedure-level: tRPC context
  Data-level: userId FK on every Drizzle query | File-level: Path traversal allowlist

JWT CONTRACT:
  Payload: userId + tier ONLY — NO email, NO PII
  Storage: httpOnly cookie

Post-login redirect: /instrument — NEVER /daw

LAYOUT RULES (from auth.md):
  Nav height: NAV_HEIGHT_PX constant + --nav-h CSS variable — always use the constant, never hardcode
  Root layout: flex-column, ThemeProvider wraps everything
  No overflow without explicit containment
  PageNav reads from hooks/authStore ONLY

tRPC: Middleware must be mounted on /trpc — no other path is valid

Cite rule section. Flag hydrateFromToken() called on every mount as a session destruction bug.`,
  },

  // ── BUILD ──────────────────────────────────────────────────────────────────
  {
    id: 'stack', category: 'BUILD',
    name: 'Stack Guard', role: 'Locked Versions & Canonical Designations',
    icon: '⊗', color: T.emerald, sources: ['Wire.txt §2 §12 §13'],
    quickActions: [
      'List all locked runtime and framework versions.',
      'What Three.js version is pinned and what APIs are forbidden?',
      'List all canonical file location designations.',
      'What redundancy patterns must be eliminated?',
    ],
    systemPrompt: `You are the Stack Guard — definitive authority on R3 v4's locked stack versions. Knowledge from Wire.txt §2, §12, §13, and README.

PINNED STACK (DO NOT suggest upgrades):
  TypeScript 5.9.3 · React 18.3.1 · Vite 5.4.21 · Express 4.22.1
  Wouter (NOT react-router-dom) · Zustand (NOT Redux)
  Three.js r128 (0.182.0) — PINNED, no post-r128 APIs
  Drizzle ORM 0.39.3 · Zod 3.25.76 · Stripe 20.4.1
  ws 8.20.0 · bcrypt 6.0.0 · Node 22.x

FULL FRONTEND STACK (from README):
  React 18 · Vite · Tailwind CSS · shadcn/ui · Radix UI · Framer Motion
  Three.js · Tone.js · Web Audio API · WebMIDI API

FULL BACKEND STACK (from README):
  Node.js · Express · TypeScript · Python (AI layer) · PostgreSQL
  Drizzle ORM · Passport.js · JWT · AWS S3 · Stripe
  Infrastructure: Docker · Docker Compose · Nginx (SSL termination + proxy)

UPLOAD STRUCTURE (AWS S3):
  uploads/samples/   — user-uploaded audio samples
  uploads/presets/   — instrument & FX preset configs
  uploads/projects/  — saved DAW project files

CANONICAL DESIGNATIONS:
  tRPC app router → server/procedures.ts (supersedes routers/index.ts)
  DB schema → shared/schema.ts
  Auth store → client/stores/ (Zustand)
  Router → wouter (react-router-dom removed)
  AI mix layer → ai_mix.py (Python, separate from Node.js)

REDUNDANCY TO ELIMINATE:
  Multiple appRouter definitions · Duplicate CSS color tokens
  Stale LemonSqueezy code · Orphaned .bak files

Cite §2 package row, §12 standard, §13 designation, or README section. Flag any version upgrade suggestion.`,
  },
  {
    id: 'workflow', category: 'BUILD',
    name: 'Workflow Guard', role: 'Session Workflow & Response Protocol',
    icon: '⚡', color: T.emerald, sources: ['workflow.md'],
    quickActions: [
      'When exactly can I skip the interview questions?',
      'What must a verification plan include?',
      'What does the self-review checklist cover?',
      'Explain the Read-Before-Write Wire.txt protocol.',
    ],
    systemPrompt: `You are the Workflow Guard — definitive enforcer of R3 v4's session workflow rules. Knowledge from workflow.md.

RULE 1 — Interview Before Building:
For any new feature or non-trivial change, ask FOUR questions first:
  Q1: What is the core problem this solves?
  Q2: Who is this for — DJ, creator, or both?
  Q3: What does success look like (metric / SLA / behavior)?
  Q4: What should this NOT do?
Skip ONLY for: single-file bug fixes with no API surface changes.

RULE 2 — Verification Plan First:
State before ANY work: files changing and why · how correctness confirmed · regression risk

RULE 3 — Self-Review After Every Task:
Hard Guards respected · no redundant imports · no type errors · pnpm tsc --noEmit passes

RULE 4 — Read-Before-Write (Wire.txt protocol):
Read every file in the full import graph before any destructive action.

Cite the exact rule number. State which rule is violated BEFORE providing any code.`,
  },
  {
    id: 'patch', category: 'BUILD',
    name: 'Patch Engineer', role: 'Change Delivery Protocol',
    icon: '⌥', color: T.amber, sources: ['patch-scripts.md', 'Wire.txt §14'],
    quickActions: [
      'List all 5 required patch script behaviors.',
      'What is the script naming convention?',
      'What are the 4 required fields for every change?',
      'What output must dry-run print vs. apply?',
    ],
    systemPrompt: `You are the Patch Engineer — definitive expert on R3 v4's patch script standards. Knowledge from patch-scripts.md and Wire.txt §14.

REQUIRED BEHAVIOR (all 5 mandatory):
  1. --dry-run is the DEFAULT — --apply flag required to write anything
  2. Per-file .bak backup written BEFORE any write
  3. Anchor-text replacement with occurrence count validation → abort if count ≠ 1
  4. pnpm tsc --noEmit runs as the final step
  5. Non-zero exit on any failure — never silently continue

EVERY CHANGE REQUIRES ALL FOUR:
  1. Root cause · 2. Fix rationale · 3. Affected surface · 4. Regression check

SCRIPT NAMING: r3-<domain>-fix-<N>.py · r3-<domain>-audit.py

FORBIDDEN: Silent failures · Replacing without count check · Skipping tsc · Write without .bak

Cite requirement number. Check against all 5 behaviors and 4 forbidden items.`,
  },

  // ── QUALITY ────────────────────────────────────────────────────────────────
  {
    id: 'testing', category: 'QUALITY',
    name: 'Test Sentinel', role: 'Testing Standards & Definition of Done',
    icon: '✓', color: T.emerald, sources: ['testing.md'],
    quickActions: [
      'List all 7 required LLPTE test layers in order.',
      'What are the 3 Definition of Done conditions?',
      'Where must test files live? What is forbidden?',
      'What are the 3 test style rules?',
    ],
    systemPrompt: `You are the Test Sentinel — definitive expert on R3 v4's testing standards. Knowledge from testing.md.

FRAMEWORK: Vitest — not Jest, not any other framework.
FILE LOCATION: Tests live in __tests__/ adjacent to the source file. NEVER root-level test folder.

7 LLPTE TEST LAYERS (all required):
  1. shared types · 2. signal analysis · 3. AI inference · 4. Web Audio execution
  5. pipeline orchestration · 6. React hook · 7. UI component

DEFINITION OF DONE (3 conditions — ALL required):
  1. Tests are green
  2. pnpm tsc --noEmit is clean
  3. Manual flow is confirmed end-to-end
"Code written" is NOT done.

3 STYLE RULES:
  1. Test behavior, not implementation details
  2. One assertion concept per test
  3. No test should depend on another test's side effects

TEST COUNT BREAKDOWN (from AI_MIXING.md — 42+ total):
  20 tests — AI Auto-Leveling (6 architectural layers)
  22 tests — Smart Transitions (9 files, Camelot wheel harmonic scoring)

Fix: vitest.config.ts include pattern must be:
  ['packages/*/tests/*.test.ts', 'packages/*/src/**/*.test.ts']
  (P4 item — pnpm test currently returns no output without this fix)`,
  },
  {
    id: 'correctness', category: 'QUALITY',
    name: 'Correctness Auditor', role: 'Edge Cases, Error Boundaries & Connection Points',
    icon: '⟁', color: T.red, sources: ['Wire.txt §9 §10 §11'],
    quickActions: [
      'What R3-specific edge cases must always be audited?',
      'List all audio engine error handling specs.',
      'What connection points need verification and what does each confirm?',
      'What is never acceptable under error boundary rules?',
    ],
    systemPrompt: `You are the Correctness Auditor — definitive expert on R3 v4's correctness standards. Knowledge from Wire.txt §9, §10, §11.

R3-SPECIFIC EDGE CASES (always audit):
  AudioContext suspended · SharedArrayBuffer unavailable · WebGPU unavailable
  LLPTE inference timeout mid-session · Stripe webhook failure → tier desync
  JWT expiry during session · Session write failure · Free-tier limit reached

CONNECTION POINT BOUNDARY TYPES:
  Function contracts · tRPC boundaries (Zod both ends)
  AudioParam writes (setTargetAtTime ONLY) · WebSocket events
  Drizzle queries (userId FK on every read) · Subscription tier check in procedure

NEVER ACCEPTABLE:
  Silent corruption of any kind · Hung process with no user-visible state
  Cascading failure without throttle · Error messages leaking stack traces to UI

Cite §9 edge case, §10 boundary type, or §11 error category.`,
  },

  // ── STRATEGY ───────────────────────────────────────────────────────────────
  {
    id: 'skills', category: 'STRATEGY',
    name: 'Skill Advisor', role: 'Skill Discovery & Automation',
    icon: '⬟', color: T.cyan, sources: ['SKILL.md'],
    quickActions: [
      'What 5 fields are required for every skill recommendation?',
      'Recommend the highest-value skill to build right now.',
      'Write a complete SKILL.md for the patch-gen skill.',
      'What makes a good trigger description? (max chars?)',
    ],
    systemPrompt: `You are the Skill Advisor — definitive expert on building Claude Skills for R3 v4. Knowledge from SKILL.md.

FOR EACH RECOMMENDATION, PROVIDE ALL 5 FIELDS:
  1. Skill name — the /slash-command it would create
  2. Trigger description — when Claude should auto-load it (≤250 chars maximum)
  3. What it automates — the specific manual steps it replaces
  4. Frequency — estimated sessions per week where it saves time
  5. Starter SKILL.md — a complete, ready-to-paste file

HIGH-VALUE SKILL CANDIDATES (derive from project state):
  patch-gen — auto-generate Python patch scripts for TypeScript fixes
  tsc-fix — audit and fix TypeScript errors in systematic order
  migration-check — verify drizzle migration status against Railway
  demo-qa — run pre-demo checklist automatically
  llpte-verify — check all 5 pipeline nodes are correctly wired

Each recommendation must include all 5 fields. Trigger descriptions must be ≤250 chars.`,
  },
  {
    id: 'prd', category: 'STRATEGY',
    name: 'PRD Enforcer', role: 'Product Requirements & MVP Gates',
    icon: '◫', color: T.amber, sources: ['R3v4_PRD_v4.1'],
    quickActions: [
      'What are the 3 PRD gates before partnership talks?',
      'List all 4 MVP items and their current status.',
      'What is the business model and pricing structure?',
      'What are the 3 target user personas?',
    ],
    systemPrompt: `You are the PRD Enforcer — definitive authority on R3 v4's product requirements and live priority queue. Knowledge from R3v4_PRD_v4.1 and PRIORITIES.md (last updated 2026-04-16).

CURRENT BUILD STATE (Verified 2026-04-12):
  ✅ AI Auto-Leveling — 6 layers, 20 Vitest tests, LLPTE wired
  ✅ Smart Transitions — 9 files, 22 Vitest tests, Camelot scoring
  ✅ Time Savings Tracking — SessionChip + SessionSummaryPanel in DAW.tsx
  🔲 Mix Suggestion System ← IN PROGRESS (MixSuggestionsPanel built, backend pending)

LIVE PRIORITY QUEUE (source of truth — PRIORITIES.md):

  🔴 P0 — PRODUCTION BLOCKER (Do First):
    Apply migration 0005 to Railway production DB (aiDecisionLog table missing in prod)
    Command: DATABASE_URL="railway URL" pnpm drizzle-kit migrate
    WHY: Session summary shows zero acceptance rate. Demo is broken without this.
    STATUS: Applied to local DB ✅. Railway apply requires password from dashboard.

  🟡 P2 — HARD GUARD VIOLATIONS:
    Fix server/routes/presets.ts — 4 Drizzle "as any" casts (lines 10, 11, 16, 17)
    Replace console.log in server/index.ts:300-308 → morgan structured logger

  🟢 P3 — MVP COMPLETION:
    Mix Suggestion System — tRPC procedure to surface suggestions to client
    Frontend: MixSuggestionsPanel.tsx exists
    Backend: Trigger detection in server/services/ exists
    Missing: tRPC procedure (check server/services/ before deciding router)
    Note: demo environment must use pro_artist tier

  🔵 P4 — SCHEMA & INFRASTRUCTURE:
    Create migration 0006 — materialized views:
      mv_user_session_averages (Time Savings baseline)
      mv_ai_acceptance_rates (confidence calibration per user)
    Fix vitest.config.ts — add: include: ['packages/*/tests/*.test.ts', ...]

  🔷 P5 — HYGIENE:
    Consolidate phantom dirs: client/client → client/src/ (do NOT delete before migrating)
    Note: client/src/store is LIVE — do not delete without migrating

VALUATION GATES:
  Current:                  $180K–$400K   (baseline)
  Working demo + 50 beta:   $800K–$2.5M   (P0 done)
  ≥65% AI acceptance:       $3–6M seed    (P0 + P3)
  $120K ARR:                $4.8–9.6M     (12 months post-launch)

PRD GATES (required before sell / partnership talks):
  ≥65% AI suggestion acceptance rate
  Measurable time savings
  50–100 paying beta users

PRICING (Stripe ONLY — tiers exactly as named):
  explorer = Free (conversion target)
  creator = $20/month (primary commercial tier)
  pro_artist = $60/month (professional producers)

TARGET PERSONAS:
  Marcus — Working DJ, 28, Chicago, $20/month without hesitation if transitions provably better
  Priya — Content Creator, 24, Austin, $20/month if saves 1 hour/week
  Deon — Bedroom Producer, 19, Atlanta, $20/month if gets him a mix compliment / placement

One-sentence pitch: R3 makes professional-quality mixing accessible to anyone with a track and a deadline — and proves it with a number on screen.`,
  },
];

const CATEGORIES = ['PRIME', 'AI PIPELINE', 'INTERFACE', 'DATA LAYER', 'BUILD', 'QUALITY', 'STRATEGY'];

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMessage(text: string, accentColor: string): React.ReactNode[] {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const lines = part.slice(3, -3).split('\n');
      const lang = lines[0].trim();
      const code = lines.slice(1).join('\n');
      return (
        <div key={i} style={{ margin: '8px 0', borderRadius: 6, border: `1px solid ${T.z700}`, overflow: 'hidden' }}>
          {lang && (
            <div style={{ padding: '4px 10px', background: T.z800, borderBottom: `1px solid ${T.z700}`, fontSize: 10, color: accentColor, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em' }}>{lang}</div>
          )}
          <pre style={{ margin: 0, padding: '10px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.6, color: T.z100, overflowX: 'auto', whiteSpace: 'pre' }}><code>{code}</code></pre>
        </div>
      );
    }
    const inlineParts = part.split(/(`[^`]+`)/g);
    return (
      <span key={i}>
        {inlineParts.map((ip, j) => {
          if (ip.startsWith('`') && ip.endsWith('`')) {
            return (
              <code key={j} style={{ background: T.z800, border: `1px solid ${T.z700}`, borderRadius: 3, padding: '1px 5px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: accentColor }}>{ip.slice(1, -1)}</code>
            );
          }
          return <span key={j} style={{ whiteSpace: 'pre-wrap' }}>{ip}</span>;
        })}
      </span>
    );
  });
}

// ─── Quick Action Chip ────────────────────────────────────────────────────────
function QuickChip({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${color}18` : `${color}0A`,
        border: `1px solid ${hov ? color + '60' : color + '30'}`,
        borderRadius: 20, padding: '4px 12px', fontSize: 11,
        color: hov ? color : T.z400, cursor: 'pointer',
        fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap',
        transition: 'all 0.15s', letterSpacing: '0.02em', flexShrink: 0,
      }}
    >{label}</button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function Bubble({ msg, agent }: { msg: { role: string; content: string }; agent: AgentDef }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div style={{ display: 'flex', flexDirection: isUser ? 'row-reverse' : 'row', gap: 10, marginBottom: 18, alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${agent.color}15`, border: `1px solid ${agent.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: agent.color, flexShrink: 0, boxShadow: `0 0 12px ${agent.color}30`, fontFamily: 'monospace' }}>{agent.icon}</div>
      )}
      <div style={{ maxWidth: '78%', position: 'relative' }}>
        <div style={{ background: isUser ? `${T.z800}CC` : `${agent.color}0C`, border: `1px solid ${isUser ? T.z700 : agent.color + '30'}`, borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px', padding: '10px 14px', fontSize: 13, lineHeight: 1.7, color: T.z100, fontFamily: 'Inter, sans-serif' }}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
          ) : (
            renderMessage(msg.content, agent.color)
          )}
        </div>
        {!isUser && (
          <button onClick={copy} style={{ position: 'absolute', top: 6, right: 6, background: 'transparent', border: 'none', color: copied ? agent.color : T.z600, cursor: 'pointer', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: '2px 5px', transition: 'color 0.15s' }}>{copied ? '✓ copied' : 'copy'}</button>
        )}
      </div>
    </div>
  );
}

function TypingDots({ agent }: { agent: AgentDef }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${agent.color}15`, border: `1px solid ${agent.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: agent.color, flexShrink: 0, fontFamily: 'monospace' }}>{agent.icon}</div>
      <div style={{ background: `${agent.color}0C`, border: `1px solid ${agent.color}30`, borderRadius: '4px 14px 14px 14px', padding: '12px 16px', display: 'flex', gap: 5 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: agent.color, animation: `agentBlink 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────
interface ChatPanelProps {
  agent: AgentDef;
  messages: { role: string; content: string }[];
  setMessages: (msgs: { role: string; content: string }[] | ((prev: { role: string; content: string }[]) => { role: string; content: string }[])) => void;
}

function ChatPanel({ agent, messages, setMessages }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [awaitingFirst, setAwaitingFirst] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, awaitingFirst]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setError(null);
    const updated = [...messages, { role: 'user', content }];
    setMessages(updated);
    setBusy(true);
    setAwaitingFirst(true);
    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: agent.systemPrompt,
          messages: updated.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setAwaitingFirst(false);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const ev = JSON.parse(raw) as { type: string; text?: string };
            if (ev.type === 'text_delta') {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + (ev as unknown as { text: string }).text };
                }
                return next;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setAwaitingFirst(false);
    }
  }, [input, busy, messages, agent.systemPrompt, setMessages]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clear = () => { setMessages([]); setError(null); };
  const isEmpty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${agent.color}25`, background: `${agent.color}06`, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${agent.color}15`, border: `1.5px solid ${agent.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: agent.color, boxShadow: `0 0 20px ${agent.color}25`, fontFamily: 'monospace' }}>{agent.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: agent.color, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em' }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: T.z400, fontFamily: 'Inter, sans-serif', marginTop: 1 }}>{agent.role}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {agent.sources.map((s, i) => (
            <div key={i} style={{ fontSize: 9, padding: '2px 7px', background: T.z800, border: `1px solid ${T.z700}`, borderRadius: 10, color: T.z400, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{s}</div>
          ))}
          <button onClick={clear} style={{ background: 'transparent', border: `1px solid ${T.z700}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: T.z600, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", transition: 'all 0.15s', letterSpacing: '0.05em' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.z500; (e.currentTarget as HTMLButtonElement).style.color = T.z300; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = T.z700; (e.currentTarget as HTMLButtonElement).style.color = T.z600; }}
          >CLEAR</button>
        </div>
      </div>

      <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.z800}`, display: 'flex', gap: 7, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {agent.quickActions.map((qa, i) => (
          <QuickChip key={i} label={qa} color={agent.color} onClick={() => send(qa)} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', scrollbarWidth: 'thin', scrollbarColor: `${agent.color}30 transparent` }}>
        {isEmpty && !awaitingFirst && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14, textAlign: 'center', color: T.z600 }}>
            <div style={{ fontSize: 52, color: agent.color, opacity: 0.2, fontFamily: 'monospace', textShadow: `0 0 40px ${agent.color}` }}>{agent.icon}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
              <div style={{ color: agent.color, opacity: 0.6, marginBottom: 4 }}>{agent.name}</div>
              <div style={{ fontSize: 10, opacity: 0.4 }}>{agent.sources.join(' · ')}</div>
              <div style={{ fontSize: 10, opacity: 0.35, marginTop: 6 }}>use a quick action above or type your question</div>
            </div>
          </div>
        )}
        {messages.map((msg, i) => <Bubble key={i} msg={msg} agent={agent} />)}
        {awaitingFirst && <TypingDots agent={agent} />}
        {error && (
          <div style={{ background: `${T.red}12`, border: `1px solid ${T.red}40`, borderRadius: 8, padding: '8px 12px', color: '#FCA5A5', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginBottom: 12 }}>⚠ {error}</div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${T.z800}`, background: `${T.black}CC`, display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={`Ask ${agent.name}…`}
          rows={1}
          style={{ flex: 1, background: T.z900, border: `1px solid ${input ? agent.color + '50' : T.z700}`, borderRadius: 8, padding: '10px 12px', color: T.z100, fontSize: 13, fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.2s' }}
          onInput={e => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || busy}
          style={{ background: !input.trim() || busy ? T.z800 : agent.color, border: 'none', borderRadius: 8, padding: '10px 18px', cursor: !input.trim() || busy ? 'not-allowed' : 'pointer', color: !input.trim() || busy ? T.z600 : T.black, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, transition: 'all 0.2s', boxShadow: !input.trim() || busy ? 'none' : `0 0 16px ${agent.color}50`, letterSpacing: '0.05em' }}
        >{busy ? '···' : 'SEND'}</button>
      </div>
    </div>
  );
}

// ─── Conversation persistence ─────────────────────────────────────────────────
const CONVO_STORAGE_KEY = 'r3-agent-convos-v1';

function loadConvos(): Record<string, { role: string; content: string }[]> {
  try {
    const raw = localStorage.getItem(CONVO_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { role: string; content: string }[]>) : {};
  } catch { return {}; }
}

function saveConvos(convos: Record<string, { role: string; content: string }[]>) {
  try { localStorage.setItem(CONVO_STORAGE_KEY, JSON.stringify(convos)); } catch { /* ignore */ }
}

// ─── Agent Suite Panel ─────────────────────────────────────────────────────────
interface AgentSuitePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentSuitePanel({ isOpen, onClose }: AgentSuitePanelProps) {

  const [activeId, setActiveId] = useState('wire');
  const [convos, setConvos] = useState<Record<string, { role: string; content: string }[]>>(loadConvos);
  const activeAgent = AGENTS.find(a => a.id === activeId)!;

  const setMsgs = useCallback((msgs: { role: string; content: string }[] | ((prev: { role: string; content: string }[]) => { role: string; content: string }[])) => {
    setConvos(prev => {
      const updated = typeof msgs === 'function' ? msgs(prev[activeId] ?? []) : msgs;
      const next = { ...prev, [activeId]: updated };
      saveConvos(next);
      return next;
    });
  }, [activeId]);

  const msgs = convos[activeId] ?? [];

  const counts: Record<string, number> = {};
  AGENTS.forEach(a => { counts[a.id] = (convos[a.id] ?? []).length; });

  return (
    <>
      <style>{`
        @keyframes agentBlink{0%,100%{opacity:0.2;transform:scale(0.75);}50%{opacity:1;transform:scale(1.1);}}
        @keyframes agentSuiteSlideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}
        @keyframes agentSuiteSlideOut{from{transform:translateX(0);opacity:1;}to{transform:translateX(100%);opacity:0;}}
        .agent-suite-panel{animation:agentSuiteSlideIn 0.28s cubic-bezier(0.22,1,0.36,1) both;}
        .agent-suite-scrollbar::-webkit-scrollbar{width:3px;height:3px;}
        .agent-suite-scrollbar::-webkit-scrollbar-track{background:transparent;}
        .agent-suite-scrollbar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
      `}</style>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)' }}
        />
      )}

      {/* Panel */}
      <div
        className={isOpen ? 'agent-suite-panel' : ''}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 680,
          zIndex: 1001,
          display: 'flex',
          background: 'rgba(6,6,6,0.82)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: isOpen ? 'none' : 'transform 0.25s cubic-bezier(0.4,0,0.6,1)',
          pointerEvents: isOpen ? 'auto' : 'none',
          borderLeft: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        {/* Sidebar */}
        <div className="agent-suite-scrollbar" style={{ width: 200, flexShrink: 0, background: 'rgba(24,24,27,0.6)', borderRight: `1px solid rgba(255,255,255,0.05)`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${T.z800}`, flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: '0.2em', color: T.z600, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>R3 V4 · AGI AGENT SUITE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.acid, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', textShadow: `0 0 20px ${T.acid}60` }}>EXPERT AGENTS</div>
            <div style={{ fontSize: 9, color: T.z600, fontFamily: "'JetBrains Mono', monospace", marginTop: 3, letterSpacing: '0.1em' }}>{AGENTS.length} AGENTS · ALL ARTIFACTS</div>
          </div>

          {/* Close button */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${T.z800}`, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'transparent', border: `1px solid ${T.z700}`, borderRadius: 6, cursor: 'pointer', color: T.z400, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.06em', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget).style.borderColor = T.red + '60'; (e.currentTarget).style.color = T.red; }}
              onMouseLeave={e => { (e.currentTarget).style.borderColor = T.z700; (e.currentTarget).style.color = T.z400; }}
            >
              <span style={{ fontSize: 11 }}>✕</span>
              <span>CLOSE AGENT SUITE</span>
            </button>
          </div>

          {/* Agent categories */}
          <div style={{ flex: 1, padding: '8px 6px', overflowY: 'auto' }}>
            {CATEGORIES.map(cat => {
              const catAgents = AGENTS.filter(a => a.category === cat);
              if (catAgents.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.15em', color: T.z600, padding: '6px 8px 4px', fontFamily: "'JetBrains Mono', monospace" }}>{cat}</div>
                  {catAgents.map(agent => {
                    const isActive = agent.id === activeId;
                    const msgCount = counts[agent.id];
                    return (
                      <button
                        key={agent.id}
                        onClick={() => setActiveId(agent.id)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', background: isActive ? `${agent.color}12` : 'transparent', border: `1px solid ${isActive ? agent.color + '40' : 'transparent'}`, borderRadius: 7, cursor: 'pointer', marginBottom: 2, transition: 'all 0.12s', position: 'relative' }}
                        onMouseEnter={e => { if (!isActive) { (e.currentTarget).style.background = `${T.z800}80`; (e.currentTarget).style.borderColor = T.z700; } }}
                        onMouseLeave={e => { if (!isActive) { (e.currentTarget).style.background = 'transparent'; (e.currentTarget).style.borderColor = 'transparent'; } }}
                      >
                        {isActive && <div style={{ position: 'absolute', left: 0, top: '18%', bottom: '18%', width: 2, background: agent.color, borderRadius: 1, boxShadow: `0 0 6px ${agent.color}` }} />}
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: isActive ? `${agent.color}20` : T.z800, border: `1px solid ${isActive ? agent.color + '50' : T.z700}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: isActive ? agent.color : T.z500, flexShrink: 0, fontFamily: 'monospace', transition: 'all 0.12s', boxShadow: isActive ? `0 0 8px ${agent.color}40` : 'none' }}>{agent.icon}</div>
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? agent.color : T.z400, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: 'color 0.12s' }}>{agent.name}</div>
                        </div>
                        {msgCount > 0 && (
                          <div style={{ fontSize: 9, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: `${agent.color}25`, border: `1px solid ${agent.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: agent.color, fontFamily: "'JetBrains Mono', monospace" }}>{msgCount}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${T.z800}`, flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: T.z600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.08em', lineHeight: 1.8 }}>
              ARTIFACT-BOUND · NO HALLUCINATION<br />
              Wire.txt · CLAUDE.md · llpte.md<br />
              agents.md · auth.md · workflow.md
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(9,9,11,0.55)', minWidth: 0, overflow: 'hidden' }}>
          <ChatPanel
            key={activeId}
            agent={activeAgent}
            messages={msgs}
            setMessages={setMsgs}
          />
        </div>
      </div>
    </>
  );
}

// ─── Toggle Button ────────────────────────────────────────────────────────────
export function AgentSuiteToggle({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Open Expert Agent Suite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 999,
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: isOpen ? T.acid : hov ? `${T.acid}20` : `${T.z900}`,
        border: `1.5px solid ${isOpen ? T.acid : hov ? T.acid + '80' : T.z700}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 20,
        color: isOpen ? T.black : hov ? T.acid : T.z400,
        transition: 'all 0.2s',
        boxShadow: isOpen ? `0 0 24px ${T.acid}60` : hov ? `0 0 16px ${T.acid}30` : '0 4px 16px rgba(0,0,0,0.4)',
        fontFamily: 'monospace',
      }}
    >
      {isOpen ? '✕' : '⬡'}
    </button>
  );
}
