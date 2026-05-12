#!/usr/bin/env bash
# Thin wrapper around the root npm scripts. Usage: ./run.sh <command>
#   ./run.sh setup        — copy .env, install deps for every package
#   ./run.sh up           — docker compose up --build -d
#   ./run.sh up:fg        — docker compose up --build (foreground)
#   ./run.sh down         — stop containers (keeps volumes)
#   ./run.sh down:clean   — stop + delete volumes (wipes db data)
#   ./run.sh logs         — tail all services
#   ./run.sh test         — run all unit tests
#   ./run.sh build:all    — tsc build every package
#   ./run.sh psql         — open psql shell against the running db
#   ./run.sh clean        — delete node_modules + dist everywhere
#   ./run.sh help         — list every available script
set -euo pipefail
cmd="${1:-help}"
if [[ "$cmd" == "help" ]]; then
  echo "Available commands:"
  npm run
  exit 0
fi
npm run "$cmd"
