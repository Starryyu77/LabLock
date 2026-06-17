# Hooks Explained

LabLock does most local alignment work in `pre-commit` because the staged tree is still available and can be described before a commit is created. Research drift is warning-only by default; destructive Git operations and basic file hygiene remain enforceable.

- `pre-commit`: frontmatter, LFS, diff classification, scope verification warnings, changelog update, index regeneration, commit meta write.
- `prepare-commit-msg`: prefixes commit scope/tag and appends the `LabLock-Change` trailer.
- `commit-msg`: validates message format against commit meta.
- `post-commit`: appends the change index and clears meta.
- `pre-push`: protects configured branches and tags.
