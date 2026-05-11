#!/usr/bin/env bash
set -euo pipefail

LABLOCK_HOME="${LABLOCK_HOME:-$HOME/.lablock/source}"
[ -d "$LABLOCK_HOME" ] || exit 0

if [ -f .git/MERGE_HEAD ] || [ -f .git/REBASE_HEAD ] || [ -f .git/CHERRY_PICK_HEAD ]; then
  exit 0
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "LabLock warning: bun not found; skipping checks." >&2
  exit 0
fi

CURRENT_EXP=""
if [ -f .lablock/state/current-exp ]; then
  CURRENT_EXP=$(cat .lablock/state/current-exp)
fi

bun "$LABLOCK_HOME/bin/lablock-frontmatter-check.ts" --strict || {
  echo "Frontmatter validation failed." >&2
  exit 1
}

bun "$LABLOCK_HOME/bin/lablock-lfs-check.ts" || exit 1

CLASSIFY_OUTPUT=$(bun "$LABLOCK_HOME/bin/lablock-classify-diff.ts" --staged --json) || exit 1
if [ -f .git/lablock-commit-meta.json ]; then
  CHANGE_ID=$(bun -e "console.log(JSON.parse(require('fs').readFileSync('.git/lablock-commit-meta.json','utf-8')).change_id)")
else
  CHANGE_ID=$(bun -e "import { newChangeId } from '$LABLOCK_HOME/lib/ulid.ts'; console.log(newChangeId())")
fi
SUGGESTED_TAG=$(echo "$CLASSIFY_OUTPUT" | bun -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf-8')).suggested_tag)")

DRIFT_JSON='{"config":[],"files":[]}'
if [ -n "$CURRENT_EXP" ]; then
  VERIFY_LAYERS="config,files"
  PROBE_MODE=$(bun "$LABLOCK_HOME/bin/lablock-config.ts" get drift.layers.probes 2>/dev/null | tr -d '"[:space:]' || true)
  case "$PROBE_MODE" in
    local|both) VERIFY_LAYERS="config,files,probes" ;;
  esac

  VERIFY_OUTPUT=$(bun "$LABLOCK_HOME/bin/lablock-verify-scope.ts" --exp="$CURRENT_EXP" --source=staged --layers="$VERIFY_LAYERS" --json || true)
  VERIFY_STATUS=$(echo "$VERIFY_OUTPUT" | bun -e "const x=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(x.status || 'error')")
  if [ "$VERIFY_STATUS" = "drifted" ]; then
    SUGGESTED_TAG="SCOPE-DRIFT"
    DRIFT_JSON=$(echo "$VERIFY_OUTPUT" | bun -e "const x=JSON.parse(require('fs').readFileSync(0,'utf-8')); console.log(JSON.stringify({config:x.layers.config||[],files:x.layers.files||[]}))")
    cat <<EOF
SCOPE-DRIFT warning for $CURRENT_EXP.

This commit will continue. LabLock recorded the drift in commit metadata and the experiment changes log so research progress is not blocked by a local gate.

Recommended next step:
  Run /lab-guard to decide whether this drift should become a fork, an override decision, a continue-with-note, or a revert.
EOF
  fi
fi

if [ -n "$CURRENT_EXP" ]; then
  bun "$LABLOCK_HOME/bin/lablock-update-changelog.ts" --exp="$CURRENT_EXP" --change-id="$CHANGE_ID" --tag="$SUGGESTED_TAG"
  git add ".lablock/changes/${CURRENT_EXP}.changes.log"
fi

NEEDS_REGEN=$(bun "$LABLOCK_HOME/bin/lablock-needs-index-regen.ts" --staged)
if [ "$NEEDS_REGEN" = "yes" ]; then
  bun "$LABLOCK_HOME/bin/lablock-map.ts"
  git add MAP.md experiments/matrix.md 2>/dev/null || true
fi

bun "$LABLOCK_HOME/bin/lablock-write-meta.ts" \
  --exp="$CURRENT_EXP" \
  --change-id="$CHANGE_ID" \
  --tag="$SUGGESTED_TAG" \
  --classified="$CLASSIFY_OUTPUT" \
  --drift="$DRIFT_JSON"

exit 0
