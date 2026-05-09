#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const WATCH_ROOT = path.join(ROOT, ".next", "server", "app");
const KEY_FILES = [
  ".next/server/app/page.js",
  ".next/server/app/page_client-reference-manifest.js",
  ".next/server/app/sign-in/page.js",
  ".next/server/app/sign-in/page_client-reference-manifest.js",
  ".next/server/app/expenses/page.js",
  ".next/server/app/expenses/page_client-reference-manifest.js",
  ".next/server/app/upload/page.js",
  ".next/server/app/upload/page_client-reference-manifest.js",
  ".next/server/app/api/auth/sign-in/route.js",
  ".next/server/app/api/expenses/[id]/mark-paid/route.js",
];

function now() {
  return new Date().toISOString();
}

function fileInfo(rel) {
  const abs = path.join(ROOT, rel);
  try {
    const stat = fs.statSync(abs);
    return {
      exists: true,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      ctime: stat.ctime.toISOString(),
    };
  } catch (err) {
    if (err?.code === "ENOENT") return { exists: false };
    return { exists: false, error: err.message };
  }
}

function listAppFiles() {
  try {
    return execFileSync("find", [".next/server/app", "-maxdepth", "6", "-type", "f"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

function processSnapshot() {
  try {
    return execFileSync("ps", ["-ax", "-o", "pid,ppid,lstart,command"], {
      cwd: ROOT,
      encoding: "utf8",
    })
      .split("\n")
      .filter((line) => /next|npm|node|rm -rf \.next|turbopack|claude|codex/i.test(line))
      .join("\n");
  } catch (err) {
    return `process snapshot failed: ${err.message}`;
  }
}

function snapshot(label) {
  const appFiles = listAppFiles();
  console.log(`\n[${now()}] SNAPSHOT ${label}`);
  console.log(`cwd=${ROOT}`);
  console.log(`appFileCount=${appFiles.length}`);
  for (const rel of KEY_FILES) {
    console.log(`${rel} ${JSON.stringify(fileInfo(rel))}`);
  }
  console.log("processes:");
  console.log(processSnapshot());
}

snapshot("initial");

if (!fs.existsSync(WATCH_ROOT)) {
  console.error(`[${now()}] Watch root missing: ${WATCH_ROOT}`);
  process.exitCode = 1;
}

const watchers = [];
function watchDir(dir) {
  try {
    watchers.push(
      fs.watch(dir, (eventType, filename) => {
        const rel = filename ? path.relative(ROOT, path.join(dir, filename)) : path.relative(ROOT, dir);
        console.log(`[${now()}] fs.watch ${eventType} ${rel}`);
        if (KEY_FILES.includes(rel)) {
          console.log(`${rel} ${JSON.stringify(fileInfo(rel))}`);
        }
      })
    );
  } catch (err) {
    console.log(`[${now()}] watch failed ${path.relative(ROOT, dir)}: ${err.message}`);
  }
}

function watchTree(dir) {
  watchDir(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) watchTree(path.join(dir, entry.name));
  }
}

if (fs.existsSync(WATCH_ROOT)) watchTree(WATCH_ROOT);

setInterval(() => snapshot("poll"), 5000);

process.on("SIGINT", () => {
  snapshot("final");
  for (const watcher of watchers) watcher.close();
  process.exit(0);
});
