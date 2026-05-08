#!/usr/bin/env bash
set -euo pipefail

LABLOCK_HOME="${LABLOCK_HOME:-$HOME/.lablock/source}"
[ -d "$LABLOCK_HOME" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

COMMIT_MSG_FILE=$1
COMMIT_SOURCE=${2:-}

case "$COMMIT_SOURCE" in
  merge|squash|template|commit) exit 0 ;;
esac

META_FILE=.git/lablock-commit-meta.json
[ -f "$META_FILE" ] || exit 0

EXP_ID=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).exp_id || 'main')")
TAG=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).tag)")
CHANGE_ID=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).change_id)")
OVERRIDE_ID=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('$META_FILE','utf-8')).override_decision || '')")

ORIGINAL=$(cat "$COMMIT_MSG_FILE")
FIRST_LINE=$(echo "$ORIGINAL" | head -n 1)

if echo "$FIRST_LINE" | grep -qE '^\[(main|paper|formalism|exp-[0-9]{3})\]'; then
  PREFIXED="$ORIGINAL"
else
  if [ "$EXP_ID" = "main" ]; then
    PREFIXED="[main] $ORIGINAL"
  else
    PREFIXED="[$EXP_ID][$TAG] $ORIGINAL"
  fi
fi

if ! echo "$PREFIXED" | grep -q "^LabLock-Change:"; then
  printf '%s\n\nLabLock-Change: %s\n' "$PREFIXED" "$CHANGE_ID" > "$COMMIT_MSG_FILE"
else
  echo "$PREFIXED" > "$COMMIT_MSG_FILE"
fi

if [ -n "$OVERRIDE_ID" ] && ! grep -q "^LabLock-Override:" "$COMMIT_MSG_FILE"; then
  printf '\nLabLock-Override: %s\n' "$OVERRIDE_ID" >> "$COMMIT_MSG_FILE"
fi

exit 0
