---
name: tooling
description: Tool preferences and environment setup rules. Always active — apply to every task involving shell commands, file search, or package management.
---

# Tooling

## Environment
- Default shell: `zsh` (env vars in `~/.zshrc`)
- Check `.nvmrc` and run `nvm use` before any `npm`/`yarn` commands
- Use `gh` with explicit `GITHUB_TOKEN=` to avoid token conflicts
- Get installed tool versions: `brew list --versions`

## Preferred Tools
| Task | Use | Not |
|---|---|---|
| Text search | `rg` | `grep` |
| File search | `fd` | `find` |
| JSON query/transform | `jq` | manual parsing |
| Code structure search | `ast-grep` | regex on source |

## Ownership
- Use `codeowners` to determine file/directory ownership before making changes in unfamiliar areas
