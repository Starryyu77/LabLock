#!/usr/bin/env bash
set -euo pipefail

REPO="${LABLOCK_REPO:-https://github.com/Starryyu77/LabLock.git}"
INSTALL_DIR="${LABLOCK_INSTALL:-$HOME/.claude/skills/lablock}"

if [ -d "$INSTALL_DIR" ]; then
  echo "LabLock already installed at $INSTALL_DIR. Pulling latest..."
  cd "$INSTALL_DIR"
  git pull
else
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

./setup
