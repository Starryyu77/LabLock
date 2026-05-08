#!/usr/bin/env bash
set -euo pipefail

LABLOCK_HOME="${LABLOCK_HOME:-$HOME/.claude/skills/lablock}"
[ -d "$LABLOCK_HOME" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

COMMIT_MSG_FILE=$1
META_FILE=.git/lablock-commit-meta.json
[ -f "$META_FILE" ] || exit 0

bun "$LABLOCK_HOME/bin/lablock-validate-msg.ts" --msg-file="$COMMIT_MSG_FILE" --meta-file="$META_FILE" || {
  echo "Commit message validation failed." >&2
  exit 1
}
