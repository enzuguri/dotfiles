# 0001 — Sub-agents are context firewalls, not personas

- **Status**: Accepted
- **Date**: 2026-08-06 (principle predates this; measurement added on this date)
- **Evidence**: instrumented multi-agent session — `ai-engine` playthrough-replay E2E, 2026-08-05/06

## Context

The principle was asserted in `AGENTS.md` and the README from the start, on
reasoning alone: a sub-agent exists to run a bounded job in its own context window
and return a compact summary, not to roleplay a specialism. It had never been
measured, and the competing intuition is strong — delegation *feels* expensive
because you pay for a spawn, a prompt, and a round trip, and because dispatching
requires writing out context the orchestrator already holds.

A large multi-agent session provided the first real dataset: 8 named teammates
across 5 repos, plus 10 `git-agent` spawns, a `pr-summarizer`, and a `review-agent`,
over two days.

## Decision

Delegate read-only investigation by default. Treat the orchestrator's own tool
output as the scarce resource, and the delegation channel as effectively free.

Corollaries now enforced in `AGENTS.md`:

- Log and output interpretation goes to `log-reader`, never inline.
- Waiting/polling goes to an agent or a background task, never an orchestrator turn.
- Owning process *lifecycle* does not mean owning the *reading* of what those
  processes produce. The two separate cleanly.

## Evidence

Orchestrator context consumption by tool-result volume:

| Source | Calls | Context | Share |
|---|---|---|---|
| Its own `Bash` | 354 | 345 KB | **80%** |
| `Agent` returns | 20 | 28 KB | 6% |
| `SendMessage` returns | 58 | 17 KB | 4% |
| `Read` | 8 | 35 KB | 8% |

Transcript volume: orchestrator 4.5 MB; named teammates ~13.5 MB combined.
**Roughly 3× more work happened inside firewalls than in the orchestrator, and the
entire delegation channel — 78 dispatches — cost 45 KB.**

Breakdown of the orchestrator's own Bash, which is where the context actually went:

| Category | Calls | Context | Avg/call |
|---|---|---|---|
| Log analysis (`rg`/`sed`/`tail`/`awk`) | 239 | 291 KB | 1,217 B |
| git + gh (already `git-agent`'s remit) | 18 | 15.5 KB | 860 B |
| Polling / waiting | 29 | 11.8 KB | 406 B |
| Build / verify | 23 | 10.6 KB | 459 B |
| Process / socket inspection | 12 | 4.6 KB | 387 B |

Reproduce by joining `tool_use` ids to `tool_result` lengths in the session JSONL:

```bash
jq -r 'select(.type=="assistant") | .message.content[]?
  | select(.type=="tool_use") | "\(.id)\t\(.name)"' <session>.jsonl > ids.tsv
jq -r 'select(.type=="user") | .message.content[]? | select(.type=="tool_result")
  | "\(.tool_use_id)\t\((.content | if type=="string" then . else
    ([.[]?|select(.type=="text")|.text]|join("")) end)|length)"' <session>.jsonl > res.tsv
join -t$'\t' <(sort ids.tsv) <(sort res.tsv) | awk -F'\t' '{s[$2]+=$3; n[$2]++}
  END {for (k in s) printf "%-24s n=%-4d total=%d\n", k, n[k], s[k]}' | sort -t= -k3 -rn
```

## Alternatives rejected

**Delegate by specialism (a "backend agent", a "frontend agent").** This is the
persona framing. It groups work by subject matter, but subject matter does not
predict context cost — see 0002 for the measurement that makes this concrete.
Personas also accrete scope by association, because the name implies capabilities
nobody scoped.

**Keep investigation inline and compact it later.** Compaction is lossy and
happens after the damage: the orchestrator has already degraded by the time the
window is full. A firewall never lets the material in.

## Consequences

- Agent definitions are scoped by **job shape** (read-only investigation, bounded
  verification, git mechanics), not by domain expertise. New agents must justify
  themselves on job shape.
- The orchestrator's remaining direct-Bash budget is for things that genuinely
  cannot be delegated: process lifecycle, resource allocation, and single-fact
  lookups whose answer immediately determines the next action.
- Dispatch cost is not a reason to avoid delegating. Measured at ~575 B per
  dispatch round trip, it is cheaper than almost any command it replaces.
- **Adherence, not coverage, is the bottleneck.** The two largest remaining leaks
  in the measured session were both to agents that already existed and simply
  weren't used (18 git/gh calls; a reviewer spawned only when the user suggested
  it). See `open-questions.md`.

## What would change this

- A session where dispatch overhead exceeds ~20% of orchestrator tool-result
  context — would suggest tasks are being sliced too finely.
- Evidence that firewalled agents systematically miss findings an inline read
  would have caught, at a rate that outweighs the coherence gain. Watch for
  conclusions that were technically correct but missed context the orchestrator
  held and failed to transmit.
- A harness change making orchestrator context cheap or self-pruning (reliable
  selective eviction of tool results) would weaken the whole argument.
