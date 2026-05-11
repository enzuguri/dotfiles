---
name: code-style
description: Code style and architecture rules. MUST apply to every Write or Edit operation — check these rules before generating or modifying any code.
---

# Code Style & Architecture

## Comments & Docstrings
- No docstrings or comments where the function name and signature are self-explanatory
- Only comment logic that is genuinely non-obvious — the *why*, not the *what*
- Never add JSDoc/docstrings to simple getters, setters, constructors, or single-purpose utilities
- Do not describe what a function does if reading it takes less effort than reading the comment

## General
- Write concise, strongly-typed code (TypeScript, Kotlin/Java where applicable)
- Prefer functional patterns — but not at the cost of performance or readability
- Early returns over deep nesting
- Heavy destructuring/spread for object construction
- Prevent type widening to avoid unnecessary casts

## Architecture
- Prefer hexagonal architecture when optimising or tidying code (when asked)
- Smallest diff possible for existing lines — adapt in the consumer rather than modifying shared utilities, unless the shared code is exclusively used by that consumer
- Do not modify existing code unless directly required by the task; side-effects in shared modules create blast-radius risk
