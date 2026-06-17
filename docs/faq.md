# FAQ

## What happens if I squash commits?

Keep all `LabLock-Change: chg-XXXXXXXX` trailers in the squashed commit message. If a trailer is lost, `lookupCommit` may return null and drift audit can report an orphan change ID.

## Can I bypass hooks?

Most research drift is warning-only locally, so `git commit --no-verify` should rarely be needed. Protected branches can still rely on CI drift audit or branch protection when a project explicitly wants enforcement.
