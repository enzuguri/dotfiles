---
name: code-style
description: Code style and architecture rules. Always active — apply to every code generation or modification task.
---

# Code Style & Architecture

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
