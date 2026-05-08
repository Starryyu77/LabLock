#!/usr/bin/env bash
set -euo pipefail

REPO="${LABLOCK_REPO:-https://github.com/Starryyu77/LabLock.git}"
INSTALL_DIR="${LABLOCK_INSTALL:-$HOME/.lablock/source}"

if [ -d "$INSTALL_DIR" ]; then
  if git -C "$INSTALL_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    echo "LabLock already installed at $INSTALL_DIR. Pulling latest..."
    cd "$INSTALL_DIR"
    git pull --ff-only
  else
    echo "Install path exists but is not a git repository: $INSTALL_DIR" >&2
    echo "Move it aside or set LABLOCK_INSTALL to another directory." >&2
    exit 1
  fi
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

./setup "$@"
