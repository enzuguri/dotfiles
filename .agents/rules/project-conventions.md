---
name: project-conventions
description: How to orient in a new project before making changes. Always active — apply at the start of any task in an unfamiliar codebase or after context switches between projects.
---

# Project Conventions

## Orientation Checklist
Before writing any code, check for:
- `.nvmrc` — Node version
- `package.json` — scripts, dependencies, workspace structure
- `pyproject.toml` / `setup.cfg` — Python project config
- `Dockerfile` / `docker-compose.yml` — container setup
- `.env.example` — required environment variables
- `codeowners` — ownership map

## Conventions to Match
- Naming: files, variables, functions, classes — infer from existing code
- Import style: relative vs absolute, barrel files, path aliases
- Error handling: infer from existing try/catch or Result patterns
- Logging: infer library and log level conventions
- Test structure: co-located vs `__tests__`, naming patterns

## Rules
- Match existing patterns — don't introduce new conventions without discussion
- Respect existing architecture — don't refactor unless explicitly asked
- Preserve comments and documentation style
