#!/usr/bin/env pwsh
# Thin wrapper around the root npm scripts. Usage: ./run.ps1 <command>
#   ./run.ps1 setup         # copy .env, install deps for every package
#   ./run.ps1 up            # docker compose up --build -d
#   ./run.ps1 up:fg         # docker compose up --build (foreground, see logs)
#   ./run.ps1 down          # stop containers (keeps volumes)
#   ./run.ps1 down:clean    # stop + delete volumes (wipes db data)
#   ./run.ps1 logs          # tail all services
#   ./run.ps1 logs:auth     # tail one service
#   ./run.ps1 test          # run all unit tests
#   ./run.ps1 build:all     # tsc build every package
#   ./run.ps1 psql          # open psql shell against the running db
#   ./run.ps1 clean         # delete node_modules + dist everywhere
#   ./run.ps1 help          # list every available script

param([Parameter(Position=0)] [string]$Command = "help")

if ($Command -eq "help" -or $Command -eq "") {
  Write-Host "Available commands:" -ForegroundColor Cyan
  npm run
  exit 0
}

npm run $Command
