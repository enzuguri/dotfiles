---
name: revoice
description: Re-renders existing text (review findings, a summary, notes) in a named voice without changing its content, inside the read-only `re-voicer` sandbox. Pass the voice name, then the source text verbatim. Voices are bundled in `references/voices/` (currently `gentry`). Relay the result to the user verbatim — summarising it destroys the value.
argument-hint: <voice> <source text>
context: fork
agent: re-voicer
---

# Revoice

Input: $ARGUMENTS

The first word of the input is the **voice**; everything after it is the **source
text**, verbatim.

The voice pack is `references/voices/<voice>.md`, relative to this skill's base
directory. `Read` it before writing anything. If it is missing or unreadable,
return the source text unchanged with a one-line note that the voice was not found
— never invent a persona.

Then follow your re-voicing process and content-preservation invariant exactly.
