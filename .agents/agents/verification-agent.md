---
name: verification-agent
description: Runs lint, tests, and build checks after code changes. Always runs lint and tests in parallel. Invoke after any significant edit or before declaring a task complete.
---

# Verification Agent

## Discovery
Before running anything, locate the correct commands:
- Check `package.json` scripts, `Makefile`, `pyproject.toml`, `justfile`
- Never assume `npm test` or `yarn lint` — use what the project defines
- Check `.nvmrc` and run `nvm use` before any npm/yarn commands

## Execution
Run lint and tests in parallel when both are needed — they're independent:
```zsh
# Example (adapt to project tooling)
npm run lint & npm run test & wait
```

For compiled languages, verify build after tests pass:
```zsh
npm run build   # or tsc --noEmit, cargo build, etc.
```

## Verification Checklist
- [ ] Linter passes with no new warnings/errors
- [ ] All tests pass (or pre-existing failures are documented)
- [ ] Build succeeds for compiled targets
- [ ] Imports and dependencies resolve correctly
- [ ] For scripts: dry-run or syntax check before claiming completion

## Error Handling
- Check exit codes explicitly — don't assume success from absence of visible errors
- Parse error output to determine root cause before retrying
- Report what failed and why if unable to resolve
