# R3 Ecosystem Architecture Vision

**Created:** 2026-05-12  
**Review Cycle:** 60 days (next review: 2026-07-11)  
**Status:** Parking (under evaluation — not yet a roadmap)  
**Owner:** @Ty

---

## Context

This document articulates a potential long-term architecture for the R3 ecosystem. It is **not** a committed roadmap. It exists to:

- Clarify thinking about how current projects relate to each other
- Identify potential consolidations and optimizations
- Guide prioritization in 60-day cycles
- Be re-evaluated regularly for relevance and feasibility

**This is a solo developer's architecture framework, not a vision for hiring or external commitment.**

---

## Current State: Two Complementary Projects

### Stable (~/Stable)

**Role:** Execution layer  
**Focus:** Runtime operations, deployment, real-time systems  
**Scope:**

- R3 v4 DAW (React/Vite frontend, Express/tRPC backend)
- LLPTE audio processing pipeline (6-node AI routing)
- WebSocket collaboration layer
- Auth, billing, workspace management
- Production deployment and monitoring

**Pattern:** Ship fast, audit after, repair iteratively

### Agi-Suite (~/Agi-Suite)

**Role:** Architecture and governance layer  
**Focus:** Modular infrastructure, reusable contracts, policy enforcement  
**Scope:**

- Typed API contracts (tRPC routers, Zod schemas)
- Shared libraries (@workspace packages)
- Monorepo orchestration patterns
- Refactor planning and graph resolution
- Long-term design standards

**Pattern:** Design, document, enforce through CI

---

## The Relationship (How They Work Together)

**Stable** provides:

- Working implementations of features
- Real deployment feedback
- Iteration velocity
- Autonomous repair capabilities

**Agi-Suite** provides:

- Architectural review and standardization
- Reusable patterns extracted from Stable
- Governance gates (eslint, types, audit)
- Planning tools for long-term refactors

**Neither replaces the other.** Stable is too fast to stay architecturally pure. Agi-Suite is too formal to ship rapidly. They balance each other.

---

## Concrete Next Steps (This Cycle)

### Immediate (Stable-focused, next 1-2 weeks)

1. **Remove VocalSpectra from Stable** (clean separation) ✅ DONE
   - Move to standalone project
   - Unblocks Stable from carrying audio DSP research
   - Can be re-integrated later as external dependency

2. **Fix open security findings** (Mythos Lesson 5 SLAs) ✅ DONE
   - Vite CVE: already safe at 8.0.12 ✓
   - Timing oracle in auth.ts: 90-day deferral (due 2026-08-10)
   - Schedule reviews for other surfaces

3. **Verify Stable builds end-to-end**
   - `pnpm verify` green
   - All three tsconfig files compiling
   - No orphaned imports

### Near-term (Both, next 30 days)

4. **Consolidate startup scripts** (Agi-Suite) ✅ DONE
   - Merge `agi-suite-startup-dev.sh` and `agi-suite-startup.sh` into one parameterized script
   - Reduce maintenance burden
   - Single source of truth for orchestration

5. **Extract shared audit patterns** (Agi-Suite → Stable)
   - Move duplicate `asi-hygiene-master.sh` logic into a shared library
   - Both repos can call the same audit runner
   - Central enforcement, distributed usage

6. **Document Stable → Agi-Suite feedback loop**
   - When Stable discovers a pattern worth standardizing, capture it
   - When Agi-Suite enforces a standard, backport to Stable
   - Create a simple "promotion" process

---

## Longer-term Possibilities (Do NOT act on without re-review)

These are speculative and should only be acted upon after 60-day re-evaluation.

### VocalSpectra as Modular Plugin System

- Rebuild as standalone Web Audio plugin suite
- Integrate back into Stable as external dependency
- Model for future audio/video processing modules

### Governance Kernel

- Extract audit, patch, and repair utilities from both repos
- Unify into a shared orchestration layer
- Both Stable and Agi-Suite use same governance primitives

### Autonomous Repair Framework

- Formalize the self-healing patterns already in Stable
- Package as a reusable agent framework
- Apply to both execution and architecture tiers

### Future Module Integration

- Design both projects to accept pluggable modules
- Example: If video editing becomes a goal, model how it would integrate
- Same governance, execution, telemetry framework

---

## What This Is NOT

❌ **Not a hiring plan**  
This architecture is designed for one developer. Scaling to a team would require different tradeoffs.

❌ **Not a rewrite plan**  
Agi-Suite is not meant to replace Stable. Stable will stay as the source of real implementation.

❌ **Not a grand unified system**  
Both projects will continue to have different rhythms and constraints. That's healthy.

❌ **Not a commitment**  
This document exists to think clearly. It will be re-evaluated in 60 days. Parts may be abandoned.

---

## Success Metrics (60-day check-in)

When you re-read this on **2026-07-11**, ask:

1. **Did Stable stay ship-worthy?**
   - Codebase builds cleanly?
   - No security findings exceeded SLAs?
   - Deployment pipeline working?

2. **Did Agi-Suite remain useful?**
   - Monorepo structure made refactors easier?
   - Type system caught real bugs?
   - Governance gates had positive ROI (time saved > maintenance cost)?

3. **Did the split make sense operationally?**
   - Did you catch yourself trying to do Stable work in Agi-Suite or vice versa?
   - Did the project directories feel right?
   - Were there obvious pain points?

4. **Would consolidating something specific help?**
   - Startup scripts: consolidated? ✅ YES (done this cycle)
   - Audit runners: still duplicated? still painful?
   - Any new pain points?

If the answers are mostly "yes," continue this approach. If not, revisit.

---

## Notes for Next Cycle

- **VocalSpectra removal** unblocks Stable from audio research debt. Document the rebuilding process when creating the standalone repo.
- **Unified startup script** is a quick win. Use it to model how other script duplication could be resolved.
- **Mythos Lesson 5 enforcement** (security SLAs) is important. The timing oracle deferral is acceptable, but follow through on the 90-day deadline (2026-08-10).
- **Agi-Suite as governance** works best when Stable discovers patterns _first_. Don't try to pre-architect Agi-Suite based on speculation.

---

## Document Lifecycle

| Date       | Event      | Notes                                                      |
| ---------- | ---------- | ---------------------------------------------------------- |
| 2026-05-12 | Created    | After recognizing Stable/Agi-Suite as complementary layers |
| 2026-07-11 | Review due | Re-read and decide: continue, pivot, or abandon framework  |
| Future     | [TBD]      |                                                            |

---

**End of parking document.**

Next review: **2026-07-11** (Set a calendar reminder!)
