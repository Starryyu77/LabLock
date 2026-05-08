#!/usr/bin/env bash
set -euo pipefail

LABLOCK_HOME="${LABLOCK_HOME:-$HOME/.lablock/source}"
[ -d "$LABLOCK_HOME" ] || exit 0
command -v bun >/dev/null 2>&1 || exit 0

remote=$1
url=$2
unused="$remote $url"

while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do
  if ! PROTECTED_OK=$(bun "$LABLOCK_HOME/bin/lablock-check-push.ts" \
    --local-ref="$local_ref" \
    --local-sha="$local_sha" \
    --remote-ref="$remote_ref" \
    --remote-sha="$remote_sha"); then
    echo "Push rejected by LabLock: $PROTECTED_OK" >&2
    exit 1
  fi
  if [ "$PROTECTED_OK" != "ok" ]; then
    echo "Push rejected by LabLock: $PROTECTED_OK" >&2
    exit 1
  fi
done

exit 0
