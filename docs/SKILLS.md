# Agi-Suite + R3 v4 — SKILLS.md

# Patterns, failure modes, and learned techniques from active development.

# Updated: 2026-04-18 | Source: multi-session engineering thread

# Use alongside PRD.md, ARCHITECTURE.md, and WIRE.txt — not a replacement for any of them.

---

## INDEX

**Agi-Suite specific (new — 2026-04-18)**

- [A1. Anthropic SDK — abort vs error event distinction](#a1-anthropic-sdk--abort-vs-error-event-distinction)
- [A2. esbuild — externalizing packages that live in node_modules at runtime](#a2-esbuild--externalizing-packages-that-live-in-node_modules-at-runtime)
- [A3. tsx watch — api-server hot reload without a build step](#a3-tsx-watch--api-server-hot-reload-without-a-build-step)
- [A4. pnpm catalog — version pinning and the catalog: reference pattern](#a4-pnpm-catalog--version-pinning-and-the-catalog-reference-pattern)
- [A5. simple-git-hooks — build approval required after install](#a5-simple-git-hooks--build-approval-required-after-install)
- [A6. Prettier — .prettierignore is not .gitignore](#a6-prettier--prettierignore-is-not-gitignore)
- [A7. SSE debugging from the terminal](#a7-sse-debugging-from-the-terminal)
- [A8. Python patch scripts — exact-match assertion pattern](#a8-python-patch-scripts--exact-match-assertion-pattern)
- [A9. drizzle-kit push vs migrate — which to use and when](#a9-drizzle-kit-push-vs-migrate--which-to-use-and-when)

**R3 v4 general (pre-existing)**

- [1. Python Patch Scripts — Terminal Delivery](#1-python-patch-scripts--terminal-delivery)
- [2. Git History — Large File Removal](#2-git-history--large-file-removal)
- [3. Double Transport Bar — Root Cause Pattern](#3-double-transport-bar--root-cause-pattern)
- [4. Multi-Machine Environment Management](#4-multi-machine-environment-management)
- [5. Railway Migration — Confirmed Pattern](#5-railway-migration--confirmed-pattern)
- [6. pnpm Install — Permission Error on Shared Systems](#6-pnpm-install--permission-error-on-shared-systems)
- [7. Theme Migration — Tailwind to Inline Style](#7-theme-migration--tailwind-to-inline-style)
- [8. Node Version Mismatch — esbuild Transform Error](#8-node-version-mismatch--esbuild-transform-error)
- [15. Git Push — Interrupted Transfer Recovery](#15-git-push--interrupted-transfer-recovery)
- [16. Admin Login — Verification Pattern](#16-admin-login--verification-pattern)
- [18. PRD Version Verification — Triple-Check Process](#18-prd-version-verification--triple-check-process)
- [19. DAW.tsx — Unterminated JSX](#19-dawtsx--unterminated-jsx-statusbar-component)
- [20. Railway CLI — exec format error](#20-railway-cli--exec-format-error-architecture-mismatch)
- [21. gitsafe-backup Remote on Penguin](#21-gitsafe-backup-remote-on-penguin)
- [22. Ctrl+C During Long Operations](#22-ctrlc-during-long-operations--state-recovery)

---

## A1. Anthropic SDK — abort vs error event distinction

### Problem

The api-server crashes with an unhandled `APIUserAbortError` when a client
disconnects mid-stream. The crash kills the entire Node process with exit code 1,
taking down all other active requests.

```
APIUserAbortError: Request was aborted.
    at Anthropic.makeRequest (.../core.ts:483:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
```

### Root Cause

`MessageStream` (returned by `client.messages.stream()`) is **both an EventEmitter
and Promise-like**, but with a non-standard abort path. When `stream.abort()` is
called:

1. The stream emits an `abort` event (not `error`)
2. Inside `_emit('abort')`, the SDK checks:
   - Is `#catchingPromiseCreated` true? (set by calling `.done()`, `.finalMessage()`, etc.)
   - Are there any `abort` event listeners registered?
   - If BOTH are false → `Promise.reject(error)` is called intentionally
3. That intentional `Promise.reject()` produces an unhandled rejection that kills Node

**The error handler does nothing:**

```typescript
stream.on("error", handler); // handles real API errors — NOT aborts
// abort event never reaches this handler
```

**`.catch()` does not exist:**

```typescript
stream.catch(() => {}); // TypeError: stream.catch is not a function
// MessageStream is not a Promise — it only looks like one
```

### Fix

Register an `abort` listener. One listener satisfies `listeners?.length` and
prevents the SDK from calling `Promise.reject(error)`.

```typescript
const stream = client.messages.stream({ ... });

// Handles real API errors (rate limits, network failures, etc.)
stream.on("error", (err: Error) => {
  if (err.message?.includes("aborted") || err.constructor?.name === "APIUserAbortError") {
    return; // already handled by abort listener
  }
  res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  res.end();
});

// REQUIRED — distinct from error. Without this, _emit('abort') calls
// Promise.reject(error) intentionally, killing the process on client disconnect.
stream.on("abort", () => {});

req.on("close", () => {
  try { stream.abort(); } catch { /* ignore */ }
});
```

### Key insight from SDK source (`MessageStream.ts`, v0.39.0)

```typescript
if (event === "abort") {
  const error = args[0] as APIUserAbortError;
  if (!this.#catchingPromiseCreated && !listeners?.length) {
    Promise.reject(error); // <-- this is the crash
  }
  // ...
}
```

The SDK intentionally crashes your process if you call `stream.abort()` without
handling the abort event. It is a feature, not a bug — it forces you to acknowledge
the abort path.

### Prevention

Every route that uses `client.messages.stream()` must have:

1. `stream.on("error", handler)` — for real errors
2. `stream.on("abort", () => {})` — to prevent the intentional crash on disconnect
3. `req.on("close", () => { stream.abort(); })` — to clean up on client disconnect

---

## A2. esbuild — externalizing packages that live in node_modules at runtime

### Problem

The api-server esbuild bundle is 2.0mb with a warning. The Anthropic SDK
(`@anthropic-ai/sdk`) accounts for ~1.8mb of that. There is no benefit to bundling
it — it is installed in `node_modules` on the Railway deployment target anyway.

### Fix

Add `"@anthropic-ai/sdk"` to the `external` array in `build.mjs`:

```javascript
external: [
  "@anthropic-ai/sdk", // <-- add this
  "*.node",
  "sharp",
  // ... rest of existing externals
];
```

### Rule

Any package that:

1. Is installed as a production dependency (not devDependency)
2. Will be present in `node_modules` on the deployment target
3. Does not require special bundling treatment (e.g. no dynamic `require()` tricks)

...should be externalized from the esbuild bundle. Bundling it adds size and
build time with zero runtime benefit.

### Verification

After the change, run `pnpm --filter @workspace/api-server build` and confirm
the bundle size drops significantly. The SDK should no longer appear in the
esbuild output listing.

---

## A3. tsx watch — api-server hot reload without a build step

### Problem

The original `dev` script was `export NODE_ENV=development && pnpm run build && pnpm run start`.
Every source change required a full esbuild build pass (500-2500ms) before the
server restarted. No file watching — manual kill and restart required.

### Fix

Replace the dev script in `apps/api-server/package.json`:

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx watch --env-file=.env src/index.ts",
    "build": "node ./build.mjs",
    "start": "node --env-file=.env --enable-source-maps ./dist/index.mjs"
  },
  "devDependencies": {
    "tsx": "catalog:"
  }
}
```

`tsx watch` restarts the process in < 500ms on any source file change. No build
step. The `build` and `start` scripts remain unchanged for production use.

### Version pinning

`tsx` is in the workspace catalog (`pnpm-workspace.yaml`). Always use `"catalog:"`
as the version specifier — not a hardcoded version string. Hardcoding a version
that differs from the catalog will cause pnpm to install a duplicate.

### env-file loading

Node 22+ supports `--env-file=.env` natively. tsx passes this flag through to
Node. No `dotenv` package required in development or production.

---

## A4. pnpm catalog — version pinning and the catalog: reference pattern

### Problem

When adding a package that is already in the workspace catalog
(`pnpm-workspace.yaml` `catalog:` section), hardcoding a version string in the
package's `package.json` causes a conflict with the catalog pin. pnpm may install
a duplicate at a different version, or reject the install entirely.

### Example

`tsx` is in the catalog as `tsx: ^4.21.0`. Adding `"tsx": "^4.19.4"` to
`api-server/package.json` is wrong. pnpm will use the catalog pin anyway, but
the declared version creates inconsistency.

### Correct pattern

```json
{
  "devDependencies": {
    "tsx": "catalog:"
  }
}
```

The `"catalog:"` specifier tells pnpm to use whichever version is pinned in the
workspace catalog. One source of truth.

### How to check what is in the catalog

```bash
grep -A 50 "^catalog:" pnpm-workspace.yaml
```

Always check the catalog before adding a new package — it may already be there.

### Supply chain note

The catalog works together with `minimumReleaseAge: 1440`. New catalog entries
are subject to the same 24-hour minimum release age. If you need to add a
package version published less than 24 hours ago, add it to
`minimumReleaseAgeExclude` temporarily (with justification) and remove it once
the window passes.

---

## A5. simple-git-hooks — build approval required after install

### Problem

After `pnpm install` adds `simple-git-hooks`, pnpm warns:

```
Ignored build scripts: simple-git-hooks@2.13.1.
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

The hooks appear to install (the `prepare` script runs and reports success), but
on a fresh `pnpm install` on a new machine or in CI, the hooks will NOT be
re-applied because the build script is not approved.

### Fix (one-time, per machine)

```bash
pnpm approve-builds
# Select simple-git-hooks when prompted
```

This writes the approval to `.npmrc` or `pnpm-workspace.yaml`. Commit the result
so the approval is checked in.

### Verification

After approval, run `pnpm install` on a clean clone and confirm:

```
. prepare$ simple-git-hooks
│ [INFO] Successfully set the pre-commit with command: pnpm exec prettier --check .
│ [INFO] Successfully set the pre-push with command: pnpm typecheck
│ [INFO] Successfully set all git hooks
└─ Done
```

### CI implication

In CI, `pnpm install --frozen-lockfile` will skip the `prepare` script by default.
To install hooks in CI (if needed), use `pnpm install --frozen-lockfile --ignore-scripts=false`.
For most CI setups, hooks are not needed — CI runs the same checks (prettier, typecheck) directly.

---

## A6. Prettier — .prettierignore is not .gitignore

### Problem

After installing prettier and running `pnpm exec prettier --write .`, files like
`pnpm-lock.yaml`, `.patch-backups/`, and auto-generated components are formatted.
The lock file is large and takes 111ms to format. The patch backup dir should
not exist in the formatted output at all.

Additionally, after adding `.prettierignore`, these files still appear in
`git status` — they are formatted by prettier now but were not before. The
`.prettierignore` only tells prettier to skip them; git is unaware of it.

### Fix — .prettierignore

```
# Generated
pnpm-lock.yaml
dist/
node_modules/

# Patch artifacts
.patch-backups/

# Auto-generated component files
```

### Fix — .gitignore (separate concern)

For files that should not be tracked by git at all (e.g. `.patch-backups/`),
add them to `.gitignore`:

```bash
echo '.patch-backups/' >> .gitignore
git add .gitignore && git commit -m 'chore: gitignore patch backups'
```

### Rule

`.prettierignore` — files prettier should not format  
`.gitignore` — files git should not track  
These are independent. A file can be in one, both, or neither.

### YAML and pnpm-workspace.yaml

Prettier safely formats `pnpm-workspace.yaml`. The `*` characters in the file
are glob patterns (e.g. `artifacts/*`), not YAML anchors. Prettier does not
mishandle them. No need to add `pnpm-workspace.yaml` to `.prettierignore`.

---

## A7. SSE debugging from the terminal

### Metrics stream

```bash
curl -N http://localhost:3001/api/metrics/stream
```

Expected output:

```
data: {"activeUsers":1,"totalSubscribers":147}

: ping
: ping
```

Press Ctrl+C to stop. `-N` disables buffering so chunks appear as they arrive.

### Agent chat (single turn)

```bash
curl -N -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

Expected output:

```
data: {"type":"text_delta","text":"Hello"}
data: {"type":"text_delta","text":"! How"}
data: {"type":"text_delta","text":" can I help?"}
data: [DONE]
```

### Heartbeat

```bash
curl -X POST http://localhost:3001/api/metrics/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session-123"}'
```

Expected: `{"ok":true,"activeUsers":1,"totalSubscribers":148}`

### Diagnosing SSE connection issues

If `[vite] http proxy error: /api/metrics/heartbeat AggregateError [ECONNREFUSED]`
appears in the Vite console, the api-server is down. Check:

```bash
# Is the api-server running?
ps aux | grep "tsx watch\|node.*dist/index"

# Did it crash? Check exit code
pnpm dev   # restart and watch for [api] crash output
```

---

## A8. Python patch scripts — exact-match assertion pattern

### Pattern

Every Python patch script that modifies a file must assert exactly one match
of the target string before writing. This prevents silent corruption if the file
has drifted from the expected state.

```python
path = Path("/home/r3v/Agi-Suite/apps/api-server/src/routes/agent.ts")
content = path.read_text()
count = content.count(old)
assert count == 1, f"Expected 1 match, got {count} — file may have changed"
patched = content.replace(old, new)
path.write_text(patched)
```

### Backup pattern

Always backup before writing:

```python
from datetime import datetime
import shutil

backup_dir = Path("/home/r3v/Agi-Suite/.patch-backups") / datetime.now().strftime("%Y%m%dT%H%M%S")
backup_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(path, backup_dir / path.name)
```

### Dry-run pattern

All patch scripts should support a dry-run mode (default) that prints what
would be written without modifying files:

```python
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()

if args.apply:
    path.write_text(patched)
    print(f"Written: {path}")
else:
    print(f"Would write: {path}  (dry run — pass --apply to execute)")
```

### When to use stdin delivery instead (Termux/Android)

See entry #1 below. On Termux, heredoc delivery into a file via nano causes
SyntaxErrors. Deliver via stdin:

```bash
python3 - << 'EOF'
# pure python — no wrapper
EOF
```

---

## A9. drizzle-kit push vs migrate — which to use and when

### The two commands

| Command                | What it does                                                          | Use when                           |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `drizzle-kit push`     | Applies schema changes directly to the DB. No migration file created. | Local development — fast iteration |
| `drizzle-kit generate` | Creates a SQL migration file in `./drizzle/` from schema diff         | Before any production change       |
| `drizzle-kit migrate`  | Applies all pending migration files from `./drizzle/`                 | Production deploys                 |

### Rule

**Never use `push` in production.** It bypasses migration history. If a push
fails mid-way, there is no record of what was applied. The DB may be in a
partially migrated state with no recovery path.

**Always commit generated migration files.** The `drizzle/` directory is the
source of truth for the production schema state.

### Verification after migrate (from entry #5)

`drizzle-kit migrate` gives no explicit success/failure message — only a spinner.
Always verify:

```bash
DATABASE_URL="postgresql://..." node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")
  .then(r => { console.log('Tables:', r.rows.map(x => x.table_name)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```

### Railway deploy command

Set the Railway start command to run migrations before starting the server:

```
pnpm --filter @workspace/db migrate && node --enable-source-maps dist/index.mjs
```

This ensures every deploy applies pending migrations before accepting traffic.
If the migration fails, the deploy fails — the previous version continues serving.

---

## 1. Python Patch Scripts — Terminal Delivery

### Problem

On Termux/Android, heredoc syntax (`cat << 'EOF' > file.py`) does not work when
the user pastes the entire block into nano — they copy the shell wrapper along
with the Python content, causing `SyntaxError: invalid syntax` on the `cat` line.

### Root Cause

User opens nano, then pastes the full block including the outer shell command.
nano saves literally what was pasted — the Python file then starts with bash.

### Fix

Deliver Python patches via stdin directly — skip file creation entirely:

```bash
python3 - << 'EOF'
# pure python only — no cat, no PYEOF, no shell wrapper
import shutil
...
EOF
```

This runs Python from stdin. No file is created. No nano required.

### Fallback (if heredoc also fails on the target shell)

Create the file manually via nano by opening it and pasting ONLY from `import`
onwards — never including the `python3 -` or `EOF` lines.

---

## 2. Git History — Large File Removal

### Problem

A 1.6GB archive (`archives/r3v4_source_*.tar.gz`) was committed and pushed.
GitHub rejected with GH001 (100MB limit). `git rm --cached` + amend is not
sufficient — the blob remains in history and git still tries to push it.

### Fix

Use `git filter-branch` to purge from entire history:

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch archives/r3v4_source_*.tar.gz' \
  --prune-empty --tag-name-filter cat -- --all
git push origin main --force
```

### Prevention

Add to `.gitignore` immediately after any archive operation:

```
archives/*.tar.gz
archives/*.gz
archives/*.zip
secrets/
logs/
.patch-backups/
```

---

## 3. Double Transport Bar — Root Cause Pattern

### Problem

`/mixer` route rendered two transport bars — one from `PageNav` (global) and
one from `MultitrackView`'s own internal transport section.

### Root Cause

`MultitrackView` was designed as a standalone component with its own transport.
When embedded in a routed app that already has a global nav/transport (`PageNav`),
the internal one doubles up.

### Fix Pattern

Add an optional `hideTransport?: boolean` prop to any component that owns its
own transport bar. Default `false` for standalone use. Pass `hideTransport={true}`
from the route wrapper that lives inside a nav-aware shell.

```tsx
interface Props {
  hideTransport?: boolean;
}
const Component = ({ hideTransport = false }) => (
  <>
    {!hideTransport && (<>
      {/* internal transport */}
    </>)}
    {/* rest of component */}
  </>
);

// In App.tsx route
<Component hideTransport={true} ... />
```

### JSX Pitfall

When wrapping JSX with `{condition && (...)}`, always wrap children in a fragment
`<>...</>` if the first child is a comment — a comment is not a valid single JSX
expression and Babel/esbuild will throw `Unexpected token`.

```tsx
// WRONG
{!hideTransport && (
  {/* comment */}
  <div>...</div>
)}

// CORRECT
{!hideTransport && (<>
  {/* comment */}
  <div>...</div>
</>)}
```

---

## 4. Multi-Machine Environment Management

### Machines in Use

| Machine        | Path               | Node    | Purpose                           |
| -------------- | ------------------ | ------- | --------------------------------- |
| Kali (`r3v`)   | `~/Stable`         | 22.x    | Canonical dev — use this          |
| Penguin (`v4`) | `~/R3v4`           | 18.20.4 | Chromebook Linux — migration only |
| Termux (`v4`)  | `~/r3v4_extracted` | 18.x    | Android — UI testing only         |

### Rules

- **All development on Kali only.** Penguin and Termux are for running specific commands only.
- Penguin and Termux run Node 18.x — incompatible with the project (requires 22.x).
- `~/r3v4_extracted` on Termux is a separate extracted archive — NOT the canonical repo.

### Railway DB URL

- Never stored in `.env` or `.env.production` on any machine.
- Must be fetched from Railway dashboard → PostgreSQL service → Connect tab.
- Never paste the URL into chat — type it directly in the terminal.
- Rotate the password immediately if accidentally exposed.
- The public URL (`ballast.proxy.rlwy.net:PORT`) is required from outside Railway.

---

## 5. Railway Migration — Confirmed Pattern

### drizzle-kit migrate Ambiguity

`pnpm drizzle-kit migrate` prints an animated spinner but gives no explicit
success/failure message. This is NOT a confirmation of success.

### Verification Required

Always verify after every `drizzle-kit migrate` run:

```bash
DATABASE_URL="postgresql://..." node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")
  .then(r => { console.log('Tables:', r.rows.map(x => x.table_name)); pool.end(); })
  .catch(e => { console.error('ERROR:', e.message); pool.end(); });
"
```

### railway.toml — Include migrate in startCommand

```toml
startCommand = "pnpm --filter @workspace/db migrate && node --enable-source-maps dist/index.mjs"
```

---

## 6. pnpm Install — Permission Error on Shared Systems

### Problem

`npm install -g pnpm` fails with `EACCES: permission denied`.

### Fix

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
npm install -g pnpm
```

---

## 7. Theme Migration — Tailwind to Inline Style

### Canonical Acid-Techno Palette

```ts
const T = {
  bg: "#0a0a0a",
  surface: "#0d0d0d",
  border: "#1c1c1c",
  border2: "#2a2a2a",
  text: "#e5e5e5",
  dim: "#555",
  accent: "#a3e635", // --ag-acid
  accentDim: "rgba(163,230,53,0.12)",
  rec: "#ef4444",
  recDim: "rgba(239,68,68,0.15)",
  font: '"IBM Plex Mono", "JetBrains Mono", monospace',
};
```

### Key swaps from Tailwind

- `bg-card` → `background: '#0d0d0d'`
- `bg-background` → `background: '#0a0a0a'`
- `text-blue-400` → `color: '#a3e635'`
- `rounded-lg` → remove (zero radius is canonical)

---

## 8. Node Version Mismatch — esbuild Transform Error

### Symptom

```
Error [TransformError]: Transform failed with 1 error:
Expected "from" but found "import"
```

### Root Cause

Running `tsx` under Node 18.x on a codebase requiring Node 22.x.

### Fix

```bash
node --version   # must be v22.x
nvm install 22 && nvm use 22
```

---

## 15. Git Push — Interrupted Transfer Recovery

### Rule

Git push is idempotent. Re-running after interruption is always safe.

```bash
git push
# or if force was involved:
git push --force-with-lease
```

If remote already has the commit: `Everything up to date`.
If not: transfer resumes.

---

## 16. Admin Login — Verification Pattern

```bash
# Step 1 — Confirm admin user exists in DB
node -e "
require('dotenv/config');
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT id, email, \"isAdmin\", tier FROM users WHERE \"isAdmin\" = true')
  .then(r => { console.log('Admin users:', r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"

# Step 2 — Confirm ADMIN_EMAIL env var is set
grep "ADMIN_EMAIL" .env

# Step 3 — Test auth endpoint
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_PASSWORD"}' \
  | head -c 200
```

---

## 18. PRD Version Verification — Triple-Check Process

When updating a PRD or technical document, run three passes:

**Pass 1** — Targeted search for known wrong values:

```bash
grep -n "OLD_VALUE\|stale_string" file.md
```

**Pass 2** — Cross-reference all numerical claims:

- Count items manually and compare to stated counts
- Verify math (e.g. $4.8M / $120K ARR = 40×, not 4×)
- Check version numbers against pinned stack

**Pass 3** — Context sweep:

- Search every instance of key terms across ALL sections
- Changelog, glossary, and prose paragraphs hold stale copies longest

**Rule:** The changelog and glossary are always last to be checked — which is
exactly where stale values hide longest.

---

## 19. DAW.tsx — Unterminated JSX (StatusBar Component)

### Symptom

```
Pre-transform error: DAW.tsx: Unterminated JSX contents. (1866:7)
```

### Root Cause

Stray `</>` with no matching opening `<>` inside `StatusBar` component.

### Diagnosis

```bash
sed -n '1840,1870p' ~/Stable/client/src/pages/DAW.tsx
grep -n "StatusBar\|const StatusBar" ~/Stable/client/src/pages/DAW.tsx
```

### Prevention

Run `pnpm tsc --noEmit` immediately after every `git pull`.

---

## 20. Railway CLI — exec format error (Architecture Mismatch)

### Symptom

```
zsh: exec format error: railway
```

### Fix — Skip CLI entirely

```bash
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:PORT/railway" \
  pnpm drizzle-kit migrate
```

---

## 21. gitsafe-backup Remote on Penguin

Always push to `origin` explicitly on Penguin — two remotes exist:

```
gitsafe-backup  git://gitsafe:5418/backup.git
origin          https://github.com/Berryboy93/r3v4.git
```

```bash
git push origin main   # explicit — avoids ambiguity
```

---

## 22. Ctrl+C During Long Operations — State Recovery

Assume any interrupted operation is incomplete. Check state explicitly.

```bash
# git push interrupted
git log --oneline -3
git push  # re-run — idempotent

# tar extraction interrupted
ls -la ~/r3v4_extracted/
# If partial: rm -rf ~/r3v4_extracted && re-extract

# pnpm install interrupted
rm -rf node_modules && pnpm install --frozen-lockfile
```

---

_This file is a living document. Add entries whenever a new pattern surfaces
more than once, or whenever a non-obvious failure mode is encountered._
_Format: Problem → Root Cause → Fix → Prevention_
_Agi-Suite entries prefixed A1–A9. R3 v4 general entries use original numbering._
