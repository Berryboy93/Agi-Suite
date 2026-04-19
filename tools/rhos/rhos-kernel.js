#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

console.log("[RHOS] booting self-healing repository OS...");

// -----------------------------
// STATE STORAGE
// -----------------------------
const STATE_DIR = path.join(ROOT, ".rhos_state");
const MEMORY_FILE = path.join(STATE_DIR, "memory.json");

if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR);
}

// -----------------------------
// LOAD MEMORY
// -----------------------------
let memory = {
  failures: [],
  safeModules: [],
  riskyModules: [],
  lastRuns: [],
};

if (fs.existsSync(MEMORY_FILE)) {
  memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
}

// -----------------------------
// OBSERVATION LAYER
// -----------------------------
function observe() {
  const files = execSync("git ls-files", {
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean);

  return files;
}

// -----------------------------
// DECISION KERNEL
// -----------------------------
function decide(files) {
  const risky = files.filter(
    (f) =>
      f.includes("node_modules") || f.includes("dist") || f.includes("build"),
  );

  const safe = files.filter((f) => !risky.includes(f));

  return {
    safe,
    risky,
  };
}

// -----------------------------
// EXECUTION ENGINE (SIMULATED)
// -----------------------------
function execute(plan) {
  console.log("[RHOS] executing safe transformations...");

  return plan.safe.map((file) => ({
    file,
    action: "noop-refactor-simulated",
    changeScore: Math.random() * 10,
  }));
}

// -----------------------------
// VERIFICATION LAYER
// -----------------------------
function verify() {
  try {
    execSync("pnpm typecheck", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// -----------------------------
// MEMORY UPDATE
// -----------------------------
function updateMemory(result) {
  memory.lastRuns.push({
    timestamp: Date.now(),
    result,
  });

  if (!result.success) {
    memory.failures.push(result);
  }

  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// -----------------------------
// MAIN LOOP
// -----------------------------
const files = observe();
const plan = decide(files);

const execution = execute(plan);
const ok = verify();

const result = {
  success: ok,
  executed: execution.length,
};

updateMemory(result);

// -----------------------------
// OUTPUT
// -----------------------------
console.log("\n[RHOS] CYCLE COMPLETE");
console.log(`files observed: ${files.length}`);
console.log(`safe targets: ${plan.safe.length}`);
console.log(`risk targets: ${plan.risky.length}`);
console.log(`CI status: ${ok ? "PASS" : "FAIL"}`);

console.log("\n[RHOS] memory updated at .rhos_state/");
