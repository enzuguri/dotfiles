---
name: discover-project-tools
description: One-time discovery of a project's verification, dev-loop, and project-specific commands. Reads CI workflows, README, and build manifests, then writes `.agent-shell/project-tools.md` as the canonical reference. Invoke when starting work in an unfamiliar repo or when the existing `project-tools.md` is stale.
---

# Discover Project Tools

Produce `.agent-shell/project-tools.md` — the authoritative list of commands an agent should run from a terminal in this repo. Other agents (notably `verification-agent`) read it instead of guessing.

## Source priority

CI is ground truth. It encodes what the project *requires* to pass, including non-obvious flags and ordering. Manifest scripts often drift from CI (renamed, deprecated, dev-only variants). When sources disagree, prefer CI.

1. **CI workflows** (highest weight)
   - `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `buildkite/*`
   - Extract every `run:` / `script:` step from jobs that gate merge (named `ci`, `test`, `lint`, `build`, `verify`, `pr`, etc.)
   - Note env vars, matrix versions, working directories, and pre-flight setup
2. **README** (`README.md`, `CONTRIBUTING.md`, `docs/development*`)
   - Capture bootstrap and dev-loop commands not obvious from manifests (e.g., `make bootstrap`, `direnv allow`, secret provisioning)
3. **Build manifests**
   - JS: `package.json` `scripts`, lockfile (npm/yarn/pnpm/bun)
   - Python: `pyproject.toml` (`[tool.poetry.scripts]`, `[tool.hatch.envs]`, `[tool.pdm.scripts]`), `tasks.py` (invoke), `noxfile.py`, `tox.ini`
   - JVM: `build.gradle*` (`./gradlew tasks --all`), `pom.xml` (`mvn help:describe`)
   - Go: `Makefile`, `magefile.go`
   - Rust: `Cargo.toml`, `xtask`
   - Generic: `Makefile`, `justfile`, `Taskfile.yml`
4. **Config presence** (signals which checks exist)
   - Version pins: `.nvmrc`, `.tool-versions`, `.python-version`, `rust-toolchain.toml`
   - Linters/formatters: `.eslintrc*`, `biome.json`, `.prettierrc*`, `.golangci.yml`, `ruff.toml`, `.rustfmt.toml`
   - Type: `tsconfig.json`, `mypy.ini`, `pyrightconfig.json`
   - Test: `jest.config.*`, `vitest.config.*`, `pytest.ini`, `phpunit.xml`

## Project-specific tools

Anything called frequently in CI that isn't standard verification — codegen, schema generation, asset bundling, e2e harness, container build, fixture seed, migration runner. If a step appears in CI but doesn't fit the standard buckets below, capture it under **Project-specific** with a brief note on what it does and when to run it. Bias toward over-capture for steps that gate merge.

## Targeted-test patterns

Map the project's test runner to its single-file invocation. The cache should record both the full-suite command *and* the targeted form, since `verification-agent` quick mode runs the latter:

| Runner | Full | Targeted |
|---|---|---|
| Vitest | `vitest run` | `vitest related <files> --run` |
| Jest | `jest` | `jest --findRelatedTests <files> --passWithNoTests` |
| Pytest | `pytest` | `pytest <test-file-or-dir>` |
| Go | `go test ./...` | `go test ./<changed-pkg>/...` |
| Cargo | `cargo test` | `cargo test -p <changed-crate>` |
| Gradle | `./gradlew test` | `./gradlew :<module>:test --tests <ClassName>` |
| Maven | `mvn test` | `mvn test -pl <module> -Dtest=<ClassName>` |

If the project wraps these (e.g., `npm run test:related`), record the wrapper, not the underlying tool.

## Output

Write to `.agent-shell/project-tools.md`. Create `.agent-shell/` if absent. Use this layout:

````markdown
---
discovered-at: <git rev-parse HEAD>
discovered-on: <YYYY-MM-DD>
sources:
  - .github/workflows/ci.yml
  - package.json
  - README.md
  - <other files actually consulted>
---

# Project Tools — <repo name>

## Prerequisites
<bootstrap that must run before anything else: `nvm use`, `source .venv/bin/activate`, `direnv allow`, required env vars, docker login>

## Verification
- **Lint**: `<exact command>` — from `<source:line>`
- **Format check**: `<exact command>` — from `<source:line>`
- **Typecheck**: `<exact command>` — from `<source:line>`
- **Test (full)**: `<exact command>` — from `<source:line>`
- **Test (targeted)**: `<exact command pattern with <files> placeholder>` — runner: `<jest|vitest|pytest|...>`
- **Build**: `<exact command>` — from `<source:line>`

For categories that genuinely don't exist in this project, write `n/a — not present in CI or manifests`. Do not invent.

## Dev loop
- **Install deps**: `<command>` — from `<source>`
- **Dev server / run**: `<command>` — from `<source>`
- **Migrations**: `<command>` — from `<source>` (or `n/a`)

## Project-specific
<commands called frequently in CI that don't fit the buckets above — one bullet each with a short "what it does / when to run" note>

## Notes
<gotchas: required env vars, ordering constraints, slow steps worth a wider budget, known-flaky checks>
````

## Discovery procedure

1. `git rev-parse HEAD` — capture for the header
2. List CI files: `fd -H -t f . .github/workflows .gitlab-ci.yml .circleci 2>/dev/null`
3. Read each CI file in full. Note every `run:` step in merge-gating jobs, including the env block and `working-directory`
4. Read README and any `CONTRIBUTING.md` / `docs/development*`
5. Read manifest files based on language (use config-presence detection)
6. Cross-reference: for each CI step, find the corresponding manifest entry. If CI runs `npm run lint` and `package.json` has `"lint": "eslint . --max-warnings 0"`, record the npm-script form (it's what CI invokes) and note the underlying flags
7. If CI invokes a script the manifest doesn't define, that's a real signal — record exactly what CI runs
8. Write the file. Verify it exists and parses (re-read it)

## When *not* to write

- If `.agent-shell/project-tools.md` already exists and `discovered-at` matches `git rev-parse HEAD`, no work needed — report "already current"
- If sources are inconsistent and you cannot resolve (e.g., three different test commands across three workflows), surface the ambiguity in **Notes** rather than picking one silently

## Failure modes to avoid

- Don't run the discovered commands during discovery — that's verification's job. Discovery only reads.
- Don't infer from file presence alone. `jest.config.js` existing doesn't mean `jest` is the test command — check what CI actually invokes
- Don't capture deploy / release / publish steps. Out of scope; those are not tools an agent should run autonomously
