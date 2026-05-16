# SECURITY.md — Deferred Security Findings

**Last Updated:** 2026-05-15  
**Review Cycle:** Per Mythos-Skills.pdf Lesson 5  
**Owner:** @R3  

All deferred findings follow the Mythos security triage framework:
- [red.anthropic.com/mythos](https://red.anthropic.com) — April 7, 2026

---

## Deferred Findings

### CVE-XXXX-XXXXX — auth.ts (Timing Oracle in Password Reset)

- **Status:** Deferred
- **Advisory status:** Internal finding (not yet public)
- **Advisory published:** 2026-05-15
- **Surface:** Runtime
- **Our severity assessment:** High — timing oracle on password reset endpoint allows attacker to enumerate valid accounts via response latency
- **Advisory severity:** High — no delta
- **Mythos-class re-price:** Attacker can now parallelize reset attempts with model assistance; timing oracle that was friction-class (slow, manual) becomes barrier-breaking at scale
- **Why deferred:** Full password reset flow redesign required; impacts UX for legitimate users; feature freeze until post-MVP
- **Interim control:** Barrier-class — Rate limiting (10 reqs/min per IP) + HMAC-bound reset tokens (per-user, single-use, 15-min TTL)
- **Revisit trigger:** 2026-08-10 (90 days from advisory publication) — **HARD DATE, not event**
- **Owner:** @R3
- **Upgrade path:** Implement constant-time password reset validation; consider email-only reset (no username); audit timing on all auth endpoints (login, register, password reset, 2FA)

---

## Audit Surface Manifest

Documents which audit surfaces have been reviewed and which remain gaps.

### Memory Safety
- **Status:** Not yet audited
- **Components:** @anthropic-ai/sdk (transitive deps), Web Audio API native bindings (if any), WASM modules in LLPTE
- **Risk:** Memory corruption, buffer overruns in C/Rust code
- **Action:** Schedule WASM/native dep audit; flag all Dependabot updates to memory-unsafe components with higher scrutiny
- **Target:** Pre-first-external-beta

### Auth Logic
- **Status:** Partial (timing oracle known, see above)
- **Components:** auth.ts, session-store.ts, JWT validation, token generation
- **Known gaps:** 
  - 2FA bypass paths (if 2FA implemented)
  - Open-redirect in OAuth flows
  - Session-binding gaps (session fixation, cookie theft)
  - Account enumeration (beyond timing oracle)
- **Risk:** Complete auth bypass, privilege escalation, account takeover
- **Action:** Full auth audit required; engage external security review before external beta
- **Target:** Pre-first-external-beta

### Data Layer
- **Status:** Not yet audited
- **Components:** Drizzle ORM query generation, tRPC resolvers, row-level authorization checks
- **Known gaps:**
  - SQL injection via raw template strings or unparameterized ORM escape hatches
  - Row-level authorization gaps (query returns rows user shouldn't see)
  - Mass assignment vulnerabilities (API accepts fields that should be admin-only)
- **Risk:** Data exfiltration, data corruption, privilege escalation
- **Action:** Audit all Drizzle queries for injection paths; audit all tRPC resolvers for row-level authz checks
- **Target:** Pre-first-external-beta

### Cryptography
- **Status:** Not yet audited
- **Components:** Token generation (seed, RNG), session tokens, API request signing (HMAC), JWT signing
- **Known gaps:**
  - Weak RNG in token generation (predictable session tokens)
  - Nonce reuse in crypto operations
  - Certificate validation bypass
  - Padding oracle adjacent shapes
- **Risk:** Session hijacking, forged tokens, man-in-the-middle
- **Action:** Audit RNG seeding for cryptographic quality; verify all tokens use crypto.getRandomValues() or similar; audit HMAC/JWT signing
- **Target:** Pre-first-external-beta

### Regular Expressions (ReDoS)
- **Status:** Not yet audited
- **Components:** Any user-supplied input that reaches new RegExp() (search filters, route patterns, schema validation)
- **Risk:** Denial of service (catastrophic backtracking)
- **Action:** Audit all RegExp construction; use regex library with backtracking prevention if user-supplied patterns allowed
- **Target:** Pre-first-external-beta

### Client-Side Web Security
- **Status:** Not yet audited
- **Components:** React components, CSP headers, DOM APIs (innerHTML, dangerouslySetInnerHTML)
- **Known gaps:**
  - XSS from unsanitized user input
  - Prototype pollution from option-merging
  - Open-redirect in navigation
- **Risk:** Client-side code execution, credential theft, malware injection
- **Action:** Audit all user-supplied data rendered in React; enforce CSP headers; avoid dangerouslySetInnerHTML
- **Target:** Pre-first-external-beta

---

## Lesson 5 Validation (Pre-Merge Checklist)

Before committing any code that touches security:

- [ ] All deferred findings have: owner, trigger (date for N-day), interim control
- [ ] N-day CVE trigger dates are ≤ 30 days (High/Critical) or ≤ 90 days (Medium) from publication
- [ ] No deferred finding has only friction-class interim control (unless explicitly risk-accepted)
- [ ] Audit surface gaps are documented (see Manifest above)
- [ ] Calendar reminders are set for all trigger dates

---

## Document Sources

This SECURITY.md is derived from:
- Mythos-Skills.pdf (red.anthropic.com, April 7, 2026)
- Internal R3 v4 security findings
- SKILLS.md (operational patterns)

**All claims trace to Mythos writeup or documented architectural review.**

