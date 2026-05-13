# Agi-Suite Troubleshooting Guide

Solutions for common issues encountered during setup, development, and deployment.

## Installation Issues

### pnpm Not Found

**Error**: `pnpm: command not found`

**Solution**:

```bash
npm install -g pnpm
pnpm --version  # Verify
```

### Node Version Mismatch

**Error**: `Node.js v16.x is not supported` or similar

**Solution**:

```bash
# Check your Node version
node --version  # Should be v18+

# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18+
nvm install 18
nvm use 18
```

### Dependency Installation Fails

**Error**: `npm ERR! code ERESOLVE` or `pnpm ERR!`

**Solution**:

```bash
# Clear pnpm store
pnpm store prune

# Remove lock file and reinstall
rm pnpm-lock.yaml
pnpm install

# If still failing, try legacy mode
pnpm install --legacy-peer-deps
```

### Permission Denied on Scripts

**Error**: `Permission denied: ./agi-suite-startup.sh`

**Solution**:

```bash
# Make scripts executable
chmod +x agi-suite-startup.sh
chmod +x agi-suite-startup-dev.sh
chmod +x quick-setup.sh
```

## Development Mode Issues

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3001` (or 3000)

**Solution**:

```bash
# Find process on port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or kill all Node processes (careful!)
pkill -9 node
```

On Windows:

```cmd
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### API Not Connecting

**Error**: `Failed to fetch from http://localhost:3001/api`

**Checklist**:

1. Is dev server running? `make dev` in another terminal
2. Check browser console for CORS errors
3. Verify `VITE_API_URL` in `.env.local`:
   ```bash
   VITE_API_URL=http://localhost:3001/api
   ```
4. Check API logs: `make logs`

### Hot Reload Not Working

**Symptom**: Changes don't appear in browser after file edit

**Solution**:

```bash
# Stop and restart
make stop
make dev

# Check Vite config
cat vite.config.ts | grep -A 5 "hmr:"
```

### TypeScript Errors in IDE

**Symptom**: Red squiggles in VSCode but build succeeds

**Solution**:

```bash
# Rebuild TypeScript
pnpm typecheck

# Restart VSCode TypeScript service:
# 1. Open Command Palette (Ctrl+Shift+P)
# 2. Type "TypeScript: Restart TS Server"
# 3. Press Enter
```

## Production Build Issues

### Build Fails

**Error**: `tsc: error TS2307: Cannot find module`

**Solution**:

```bash
# Clean and rebuild
make clean
pnpm install
pnpm typecheck  # Check for type errors
pnpm run build
```

### Build Succeeds but App Won't Start

**Error**: `Cannot find module` at runtime

**Solution**:

```bash
# Verify all files were compiled
ls -la dist/

# Check for missing dependencies
pnpm ls --depth=0

# Rebuild
rm -rf dist
pnpm run build
```

### Bundle Size Too Large

**Check size**:

```bash
du -sh dist/
```

**Reduce size**:

1. Lazy-load routes in React
2. Check for unused dependencies: `pnpm why <package>`
3. Remove unused imports
4. Use tree-shaking compatible libraries

## Database Issues

### Database Connection Failed

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Checklist**:

1. Is PostgreSQL running?
   ```bash
   psql --version  # Verify installed
   ```
2. Verify `DATABASE_URL` format:
   ```
   postgresql://user:password@localhost:5432/database_name
   ```
3. Test connection:
   ```bash
   psql -c "SELECT 1"
   ```

### Migrations Fail

**Error**: `Migration failed` or `column already exists`

**Solution**:

```bash
# Check migration status
pnpm run db:status

# Rollback last migration (if safe)
pnpm run db:rollback

# Apply pending migrations
pnpm run db:migrate
```

### Wrong Database Environment

**Problem**: Accidentally running migrations on production

**Prevention**:

```bash
# Always verify DATABASE_URL before running migrations
echo $DATABASE_URL

# In production, use explicit env
DATABASE_URL=postgresql://prod:pass@prod.db:5432/prod pnpm run db:migrate
```

## Network & API Issues

### CORS Errors

**Error**: `Access to XMLHttpRequest at 'http://...' blocked by CORS policy`

**Solution** (Development):

```bash
# Verify API_HOST in startup script allows cross-origin
grep -A 5 "cors" apps/api-server/src/app.ts

# Should include:
# app.use(cors({
#   origin: process.env.CORS_ORIGIN || "*",
# }))
```

### API Timeout

**Error**: `Request timeout` or `504 Gateway Timeout`

**Checklist**:

1. Is API server running? `lsof -i :3001`
2. Check API logs for slow queries: `make logs`
3. Increase timeout in Vite config if needed:
   ```typescript
   // vite.config.ts
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:3001',
         timeout: 30000
       }
     }
   }
   ```

### 401/403 Authentication Errors

**Error**: `Unauthorized` or `Forbidden`

**Checklist**:

1. Check JWT token in browser DevTools → Application → Cookies
2. Verify `JWT_SECRET` matches frontend and backend
3. Check token expiration
4. Look for CORS preflight issues

## Performance Issues

### Development Server Slow

**Symptom**: Hot reload takes >5 seconds, TypeScript compilation slow

**Optimization**:

```bash
# Ensure TypeScript incremental compilation is enabled
grep -A 2 "incremental" tsconfig.json

# Should be: "incremental": true

# Restart with smaller scope
pnpm run dev --filter=apps/r3-agi
```

### Large TypeScript Build

**Check build time**:

```bash
time pnpm run build
```

**Optimize**:

```bash
# Check for expensive imports
grep -r "lodash\." apps/ lib/

# Replace with lodash-es
pnpm add lodash-es
```

## Git & Deployment

### Changes Won't Commit

**Error**: `pre-commit hook failed` or formatting errors

**Solution**:

```bash
# Auto-format all files
pnpm format

# Then commit again
git add .
git commit -m "..."
```

### Push Fails

**Error**: `fatal: 'origin' does not appear to be a 'git' repository`

**Solution**:

```bash
# Check remote
git remote -v

# Add if missing
git remote add origin git@github.com:username/Agi-Suite.git

# Push
git push origin master
```

### Deployed App Not Updating

**Problem**: Changes don't appear after deployment

**Checklist**:

1. Did build succeed? Check CI logs
2. Were all files pushed to main branch?
3. Is deployment watching the right branch?
4. Clear browser cache (Ctrl+Shift+Delete)

## System Cleanup

### Free Up Disk Space

```bash
# Remove old builds
make clean

# Prune Docker (if using containers)
docker system prune -a

# Remove pnpm cache
pnpm store prune

# Remove node_modules across all apps
find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
```

### Reset to Clean State

```bash
# WARNING: This removes uncommitted changes!
git clean -fdx
git reset --hard

# Reinstall everything
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Getting More Help

### Check Logs

```bash
# Tail service logs
make logs

# API server only
tail -f ~/.pm2/logs/api-server-error.log

# Frontend only
tail -f ~/.pm2/logs/r3-agi-error.log
```

### Inspect Running Processes

```bash
# What's running?
ps aux | grep node

# Port status
lsof -i :3001
lsof -i :3000
lsof -i :5432
```

### Save Debug Output

```bash
# Capture full error for GitHub issue
make dev 2>&1 | tee debug.log

# Git info
git log --oneline -5 > git_info.log
git status >> git_info.log
```

### Report an Issue

When opening a GitHub issue, include:

```markdown
## Environment

- OS: (macOS, Linux, Windows)
- Node: (output of `node --version`)
- pnpm: (output of `pnpm --version`)

## Steps to Reproduce

1. ...
2. ...

## Error Message
```

(full error output)

```

## Logs
(output of `make logs`)
```

---

**Can't find your issue?** Open a GitHub issue with:

1. Exact error message
2. Steps to reproduce
3. Output of `make logs`
4. Your `.env.local` (without secrets)

---

**Version**: 2.0  
**Last Updated**: May 2026
