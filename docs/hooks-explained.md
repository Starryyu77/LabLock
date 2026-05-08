# Hooks Explained

LabLock does most enforcement in `pre-commit` because the staged tree is still available and can be amended before a commit is created.

- `pre-commit`: frontmatter, LFS, diff classification, scope verification, changelog update, index regeneration, commit meta write.
- `prepare-commit-msg`: prefixes commit scope/tag and appends the `LabLock-Change` trailer.
- `commit-msg`: validates message format against commit meta.
- `post-commit`: appends the change index and clears meta.
- `pre-push`: protects configured branches and tags.
