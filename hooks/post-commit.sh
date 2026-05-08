#!/usr/bin/env bash
set -euo pipefail

LABLOCK_HOME="${LABLOCK_HOME:-$HOME/.claude/skills/lablock}"
[ -d "$LABLOCK_HOME" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

META_FILE=.git/lablock-commit-meta.json
[ -f "$META_FILE" ] || exit 0

COMMIT_HASH=$(git rev-parse HEAD)
bun "$LABLOCK_HOME/bin/lablock-append-index.ts" --commit="$COMMIT_HASH" --meta-file="$META_FILE"

TAG=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).tag)")
if [ "$TAG" = "SCOPE-DRIFT" ]; then
  echo "Scope drift committed. Confirm /lab-fork or scope.lock update is accounted for."
fi

EXP_ID=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).exp_id || '')")
if [ -n "$EXP_ID" ]; then
  echo "$COMMIT_HASH" > ".lablock/state/last-commit-${EXP_ID}"
fi

rm -f "$META_FILE"
exit 0
