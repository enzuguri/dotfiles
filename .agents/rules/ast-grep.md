---
name: ast-grep
description: Pattern library for ast-grep and rg-based code structure searches. Load this skill whenever an agent needs to find, trace, or transform code relationships — exports, imports, call sites, function declarations. Useful for explore-agent, review-agent, and migration-agent.
---

# ast-grep Pattern Library

## Syntax Primer
- `$NAME` — single node capture (identifier, expression)
- `$$$` — multi-node wildcard (zero or more nodes)
- `$_` — single anonymous wildcard
- `$_$$` — one or more anonymous nodes (useful for param lists)

---

## Functions & Methods

```bash
# Named function declaration
ast-grep --pattern 'function $NAME($$$) { $$$ }'

# Arrow function assigned to const
ast-grep --pattern 'const $NAME = ($$$) => $$$'

# Async arrow function
ast-grep --pattern 'const $NAME = async ($$$) => $$$'

# Class method
ast-grep --pattern 'class $CLASS { $METHOD($$$) { $$$ } }'

# Call a specific function
ast-grep --pattern '$OBJ.$METHOD($$$)'
ast-grep --pattern '$NAME($$$)'  # top-level call
```

---

## Exports (TypeScript/JavaScript)

```bash
# Named exports
ast-grep --pattern 'export const $NAME = $$$'
ast-grep --pattern 'export function $NAME($$$) { $$$ }'
ast-grep --pattern 'export class $NAME { $$$ }'
ast-grep --pattern 'export type $NAME = $$$'
ast-grep --pattern 'export interface $NAME { $$$ }'

# Default export
ast-grep --pattern 'export default $$$'

# Re-exports (barrel files)
rg 'export \* from' --type ts
rg 'export \{.*\} from' --type ts
```

---

## Imports

```bash
# Any import from a specific module
rg "from ['\"].*my-module['\"]" --type ts

# Named import of a specific symbol
ast-grep --pattern "import { $NAME } from '$$$'"
ast-grep --pattern 'import { $$$ $TARGET $$$ } from "$$$"'

# Default import
ast-grep --pattern "import $NAME from '$$$'"

# Find all files importing from a path
rg "from ['\"]@/components/Button['\"]" --type ts

# Dynamic imports
ast-grep --pattern "import('$$$')"
```

---

## Tracing Relationships (chain these)

**Export → consumers:**
```bash
# 1. Find where something is exported
rg 'export.*MyThing' --type ts

# 2. Find all files that import it
rg "MyThing" --type ts -l

# 3. Find call sites in those files
ast-grep --pattern 'MyThing($$$)'
```

**Entry point → dependency tree:**
```bash
# Find router/handler registration patterns
ast-grep --pattern '$ROUTER.$METHOD($PATH, $HANDLER)'
ast-grep --pattern '$APP.use($$$)'

# Next.js / file-based routing — just list
fd . pages/ app/ --type f --extension ts --extension tsx
```

---

## React / TSX

```bash
# Component definition
ast-grep --pattern 'function $NAME($$$): JSX.Element { $$$ }'
ast-grep --pattern 'const $NAME = ($$$): JSX.Element => $$$'

# Hook usage
ast-grep --pattern 'const [$STATE, $SET] = useState($$$)'
ast-grep --pattern 'useEffect($$$)'

# Component usage in JSX
ast-grep --pattern '<$COMPONENT $$$>'
```

---

## Types & Interfaces

```bash
# Interface declaration
ast-grep --pattern 'interface $NAME { $$$ }'

# Type alias
ast-grep --pattern 'type $NAME = $$$'

# Generic usage
ast-grep --pattern '$NAME<$TYPE>'
```

---

## Useful rg Patterns

```bash
# TODO/FIXME/HACK markers
rg 'TODO|FIXME|HACK' --type ts

# Console.log leftovers
rg 'console\.(log|warn|error)' --type ts

# Any use of a symbol across all file types
rg 'MySymbol' --type ts -l          # files only
rg 'MySymbol' --type ts -C 3        # with 3 lines context

# Exclude test files
rg 'MySymbol' --type ts -g '!*.test.ts' -g '!*.spec.ts'
```

---

## Tips
- Always pass `--type ts` (or `js`, `py`) to avoid noise from `node_modules`, lockfiles etc.
- `ast-grep` is pattern-based, not semantic — it won't resolve aliases or follow re-exports. Use `rg` to trace module paths.
- For large codebases, pipe `rg -l` (files only) first, then `ast-grep` scoped to those files to reduce noise.
