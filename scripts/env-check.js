#!/usr/bin/env node
// Verifies .env exists and copies .env.example if it doesn't.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (fs.existsSync(envPath)) {
  console.log(".env present");
  process.exit(0);
}
if (!fs.existsSync(examplePath)) {
  console.error("No .env and no .env.example — cannot bootstrap.");
  process.exit(1);
}
fs.copyFileSync(examplePath, envPath);
console.log(".env created from .env.example — review the values before running in shared environments");
