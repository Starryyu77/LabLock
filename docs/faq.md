# FAQ

## What happens if I squash commits?

Keep all `LabLock-Change: chg-XXXXXXXX` trailers in the squashed commit message. If a trailer is lost, `lookupCommit` may return null and drift audit can report an orphan change ID.

## Can I bypass hooks?

`git commit --no-verify` works locally. Protected branches should rely on CI drift audit for enforcement.
