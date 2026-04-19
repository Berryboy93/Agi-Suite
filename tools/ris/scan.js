#!/usr/bin/env node

import fs from "fs";
import path from "path";

const ROOT = process.env.PWD || process.cwd();

const IGNORE_DIRS = new Set(["node_modules", "artifacts", ".git"]);

function walk(dir, files = []) {
  let entries;

  try {
    entries = fs.readdirSync(dir);
  } catch {
    return files; // skip unreadable dirs
  }

  for (const file of entries) {
    const full = path.join(dir, file);

    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue; // skip broken symlinks / deleted files
    }

    if (stat.isDirectory()) {
      if (IGNORE_DIRS.has(file)) continue;
      walk(full, files);
    } else {
      files.push(full);
    }
  }

  return files;
}

function scanImports(file) {
  try {
    const content = fs.readFileSync(file, "utf-8");
    return content.match(/from\s+['"](.*?)['"]/g) || [];
  } catch {
    return [];
  }
}

console.log("[RIS] scanning repo safely...");

const files = walk(ROOT);
const graph = {};

for (const file of files) {
  if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

  const imports = scanImports(file);
  graph[file] = imports;
}

console.log("[RIS] scan complete");
console.log("[RIS] files indexed:", Object.keys(graph).length);
