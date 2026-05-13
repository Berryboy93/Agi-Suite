# Development vs Production Guide

This guide explains the differences between development and production modes, and when to use each.

## Quick Comparison

| Aspect             | Development                  | Production                        |
| ------------------ | ---------------------------- | --------------------------------- |
| **Port**           | 3001                         | 3000                              |
| **API Runtime**    | `tsx watch` (interpreted)    | Node.js (compiled)                |
| **Frontend Build** | Vite dev server (HMR)        | Static bundle (minified)          |
| **Source Maps**    | Full (for debugging)         | None (secure)                     |
| **Hot Reload**     | Yes (instant updates)        | No (restart required)             |
| **Performance**    | Slower (unoptimized)         | Optimized (production builds)     |
| **Database**       | Shared (local or remote)     | Shared (production instance)      |
| **Startup Time**   | Fast (~2-3s)                 | Moderate (~5-10s, includes build) |
| **Use Case**       | Daily development, debugging | Demos, testing, deployment        |

## Development Mode (`make dev`)

### What Happens

```
make dev
  ↓
./agi-suite-startup-dev.sh
  ├─ API: tsx watch apps/api-server/src/index.ts
  ├─ Frontend: vite dev (port 3001)
  └─ Watches for file changes
```

### When to Use

- **Local development**: Writing features, fixing bugs
- **Debugging**: Step through code, inspect network requests
- **Quick feedback**: See changes instantly without restart
- **Experimenting**: Test ideas without commit cost

### Features

✅ **Hot Module Replacement (HMR)**: Update React components without losing state  
✅ **Full Source Maps**: Debug TypeScript directly in browser DevTools  
✅ **Instant TypeScript Errors**: Catch type errors as you code  
✅ **API Auto-reload**: Restart API server on code changes

### Workflow Example

```bash
# Start development
make dev

# In another terminal, edit a component
vim apps/r3-agi/src/components/Header.tsx

# Browser auto-updates instantly (HMR)
# No page reload needed

# Edit API route
vim apps/api-server/src/routes/agent.ts

# API restarts automatically, frontend reloads
```

### Performance Note

Development builds are **slow by design**:

- No minification
- Full source maps
- Interpreted TypeScript
- All debug code included

This is **normal and expected**—prioritizes feedback speed over runtime speed.

## Production Mode (`make prod-start`)

### What Happens

```
make prod-start
  ↓
./agi-suite-startup.sh
  ├─ API: node dist/index.js (compiled)
  ├─ Frontend: static files (minified bundle)
  └─ No file watchers
```

### When to Use

- **Demos**: Investor or stakeholder presentations
- **Performance testing**: Measure real-world speed
- **Deployment prep**: Verify build works correctly
- **Production troubleshooting**: Diagnose production-only issues
- **CI/CD**: Automated testing and deployment

### Features

✅ **Optimized Bundle**: Minified, tree-shaken, code-split  
✅ **Compiled JavaScript**: Faster startup, no TypeScript overhead  
✅ **No Source Maps**: Secure (no source disclosure)  
✅ **Production Database**: Uses real database (not local dev)

### Performance Characteristics

| Metric       | Dev                   | Prod                       |
| ------------ | --------------------- | -------------------------- |
| Initial Load | ~2-3s                 | ~0.5-1s                    |
| API Response | Variable              | Optimized                  |
| Bundle Size  | Unoptimized           | Minified (~30-50% smaller) |
| Memory Usage | High (watchers, maps) | Low (efficient)            |

## Switching Between Modes

### Dev → Prod

```bash
# Stop dev server
make stop

# Build for production
pnpm run build

# Start production
make prod-start

# Available at http://localhost:3000
```

### Prod → Dev

```bash
# Stop production server
make stop

# Start dev (no build needed)
make dev

# Available at http://localhost:3001
```

## Database Behavior

Both modes use the **same database**, configured via `DATABASE_URL`:

```bash
# .env.local (or environment variable)
DATABASE_URL=postgresql://user:password@localhost:5432/agi_suite
```

**Important**: Verify you're pointing to the correct database:

```bash
# Development: Usually local or dev instance
DATABASE_URL=postgresql://user:password@localhost:5432/agi_suite_dev

# Production: Use production instance (Railway, Heroku, etc.)
DATABASE_URL=postgresql://user:password@prod.db.host:5432/agi_suite_prod
```

## Deployment Checklist

Before deploying to production:

- [ ] Run `pnpm typecheck` (zero TypeScript errors)
- [ ] Run `pnpm test` (all tests pass)
- [ ] Run `pnpm format` (code is formatted)
- [ ] Run `pnpm run build` (build succeeds)
- [ ] Test with `make prod-start` (works locally)
- [ ] Verify `.env.local` has production values
- [ ] Check database migrations are applied
- [ ] Review environment variables on deployment platform

## Environment Variables

### Development (.env.local)

```bash
API_PORT=3001
API_HOST=localhost
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/agi_suite
VITE_API_URL=http://localhost:3001/api
DEBUG=agi-suite:*
```

### Production (Railway / CI environment)

```bash
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=postgresql://user:password@railway.app:5432/prod_db
VITE_API_URL=https://api.yourdomain.com/api
LOG_LEVEL=info
```

**Never commit `.env.local` to Git** — use `.env.example` as template.

## Troubleshooting Mode Switching

### Build Fails in Production Mode

```bash
# Clear cached builds
make clean

# Rebuild
pnpm install
pnpm run build
```

### Port Conflicts

```bash
# Dev mode (3001)
lsof -i :3001 | grep -v COMMAND | awk '{print $2}' | xargs kill -9

# Prod mode (3000)
lsof -i :3000 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

### API Connection Issues in Prod

Check `VITE_API_URL` in build:

```bash
# View final environment
grep "VITE_API_URL" dist/index.html
```

Should match your actual API endpoint, not localhost.

## Performance Tips

### Develop Faster

- Keep `make dev` running in background
- Use browser DevTools Network tab to see API calls
- Use React DevTools extension for component debugging
- Use `make logs` to tail server output

### Optimize Production Build

- Check bundle size: `pnpm run build --analyze`
- Lazy-load routes: Use `React.lazy()` for large components
- Use code splitting: Vite does this automatically
- Minify images: Use tools like `imagemin`

## Next Steps

- Read [SETUP.md](./SETUP.md) for installation
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for issues
- Review [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for coding standards

---

**Version**: 2.0  
**Last Updated**: May 2026
