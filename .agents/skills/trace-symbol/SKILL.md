---
name: trace-symbol
description: Traces one named symbol (function, class, hook, type, route handler) through the codebase behind a context firewall — its definition, re-exports, every importer, call sites grouped by usage pattern, and what it depends on. Use when the question is about a specific symbol ("what calls X", "where is X used", "what does X depend on"); for general orientation before a change, use `orient-agent`.
argument-hint: <symbol> [path to scope the search]
context: fork
agent: orient-agent
---

# Trace Symbol

Target: $ARGUMENTS

Trace one symbol, not a feature. If the target is ambiguous (several definitions
with the same name), trace each, labelled by defining file — don't pick one silently.

Before the first search, `Read` `references/ast-grep.md` (relative to this skill's
base directory) for the pattern syntax. If the caller stated a belief about the symbol ("only used by the API layer",
"X is dead code"), test it and report under Corrections.

## Read budget
**Max 5 Reads**, used only on files `rg` has already located — the definition, then
representative call sites. Grouping call sites by pattern from `rg -n -C 2` output is
usually enough without reading the files.

## Procedure

Batch each step's searches into one Bash block.

1. **Definition.** `rg -n` for declaration forms (`function X`, `const X =`,
   `class X`, `def X`, `type X`, `interface X`, `export ... X`). Confirm with
   `ast-grep` where the language is supported.
2. **Re-exports.** Barrel files and aliasing: `rg -n "export \{[^}]*\bX\b" ` and
   `rg -n "export \* from"` in the defining directory's ancestors. Note every alias
   (`X as Y`) — subsequent searches must include it.
3. **Consumers.** `rg -l` for imports of the symbol and each alias, scoped to the
   caller's path if given. Exclude the definition and barrels.
4. **Call sites.** `rg -n -C 2` (or `ast-grep` scoped to the consumer files) for
   invocations, JSX usage, `extends`/`implements`, and type references. Group by
   pattern, not by file.
5. **Dependencies.** From the definition file, what the symbol itself uses: imports
   it references and the calls in its body.

`rg` and `ast-grep` don't resolve dynamic dispatch, string-keyed lookups, DI
containers, or reflection. When the codebase uses them, search the registration
side (`register('X'`, `@Injectable`, route tables) and list what remains unresolved
under Gaps.

## Output

```
## Trace — <symbol>

### Corrections   (omit if the prompt carried no belief)
- <premise> — CONFIRMED | REFUTED | PARTIALLY · `<file>:<line>` · <what is actually true>

### Definition
`<file>:<line>` — <signature>

### Re-exports
- `<barrel file>:<line>` — <as alias, if any>

### Consumers (<n> files)
- `<file>` — <role: route, component, test, ...>

### Call Sites
- <pattern> — <n> sites, e.g. `<file>:<line>`

### Depends On
- <symbol/module> — <how it's used>

### Gaps
- <what rg/ast-grep cannot follow here, and the searches you ran>
```

Zero consumers is a finding, not an empty section: write
`0 consumers — searched: <exact patterns and aliases>` so it reads differently from a
skipped step.
