# Branch Protection Setup Guide

## Overview
This guide helps you set up branch protection rules for the `master` branch to ensure all changes (including Dependabot PRs) are tested before merging.

## Quick Setup (60 seconds on Mobile)

### Step 1: Open Settings
1. Go to your repository: https://github.com/Berryboy93/Agi-Suite
2. Click **Settings** (top right)
3. Click **Branches** (left sidebar)

### Step 2: Add a Rule
1. Click **Add rule**
2. In "Branch name pattern" field, type: `master`

### Step 3: Enable Protection Checks
Check these boxes:
- ☑️ **Require a pull request before merging**
  - Check: "Require approvals" (keep at 1)
- ☑️ **Require status checks to pass before merging**
  - Search for and select: `Build & Test` (CI workflow)
- ☑️ **Dismiss stale pull request approvals when new commits are pushed**
- ☑️ **Require branches to be up to date before merging**

### Step 4: Save
Click **Create** button at the bottom

## What This Does

✅ **All PRs (including Dependabot) must:**
- Pass the CI workflow (prettier, lint, typecheck, test, build)
- Be reviewed before merging
- Have fresh approvals if new commits are pushed

✅ **Benefits:**
- No broken code merges to master
- Dependabot updates are automatically tested
- You maintain code quality standards

## After Setup

- Dependabot will create PRs automatically every Monday
- Your CI workflow will run automatically on each PR
- PRs will merge only if all checks pass and you approve them

## Troubleshooting

**"Build & Test" not appearing in status checks?**
- Make sure at least one PR has run the CI workflow
- Refresh the page and try again

**Need to modify later?**
- Go back to Settings → Branches → Edit the rule for `master`

---
**Setup Date:** June 16, 2026  
**Configuration:** Dependabot + CI Protection for master branch
