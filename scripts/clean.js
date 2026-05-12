#!/usr/bin/env node
// Removes node_modules and dist across the monorepo. Safe to re-run.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const targets = [
  "shared",
  "services/auth-service",
  "services/portfolio-service",
  "services/scheduler-service",
  "services/app-service",
];

for (const t of targets) {
  for (const dir of ["node_modules", "dist"]) {
    const p = path.join(root, t, dir);
    if (fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
      console.log("removed", path.relative(root, p));
    }
  }
}
console.log("clean done");
