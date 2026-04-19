/* eslint-disable no-console */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WATCH_PATHS = [path.join(ROOT, "data"), path.join(ROOT, "scripts")];

let running = false;
let pending = false;

function runGenerateData() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  const child = spawn("npm", ["run", "generate:data"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
  });

  child.on("exit", () => {
    running = false;
    if (pending) {
      pending = false;
      runGenerateData();
    }
  });
}

function watchPath(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.watch(targetPath, { recursive: true }, () => {
    console.log(`\n[watch] change detected in ${targetPath}`);
    runGenerateData();
  });
}

WATCH_PATHS.forEach(watchPath);
console.log("[watch] generate:data watcher started");
runGenerateData();
