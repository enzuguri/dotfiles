# Open Questions

Theories about the harness that are **not yet settled**, each with the test that
would settle it. Promote to a numbered decision record once one is resolved;
delete it if it stops mattering.

The point of this file is to stop plausible-sounding theories from quietly
becoming policy. A theory here is explicitly *not* a rule.

---

## Q1 — Is adherence, not coverage, the real bottleneck?

**Theory.** The harness's rules are mostly right and simply do not fire. Adding
more rules is therefore lower-value than making existing ones fire.

**Evidence so far (2 data points, same session, both suggestive not conclusive):**
- `references/reviewing.md` already mandates the `review-agent` firewall by default. It
  was only used when the user explicitly suggested spawning a reviewer, late in a
  two-day session.
- 18 `git`/`gh` calls (15.5 KB) ran inline despite `git-agent` owning that remit —
  3× the context prize of the entire rejected "devops" expansion
  ([0002](0002-log-reader-stays-read-only.md)).

**Test.** Instrument the next two multi-agent sessions the same way, and classify
every orchestrator tool call as: (a) correctly inline, (b) covered by an existing
agent that wasn't used, (c) not covered by any agent. If (b) consistently exceeds
(c), coverage is not the problem and effort should move to dispatch habit —
hard-constraint phrasing, ordering within `AGENTS.md`, or a harness-level nudge.

**Why it is not yet settled.** Two observations from one session, both possibly
explained by that session's unusual shape (long-running live processes, heavy
human-in-the-loop). Needs a second, differently-shaped session before acting.

---

## Q2 — Does the "confirm or refute" framing survive becoming mandatory?

**Theory.** Asking agents to attack the caller's premise reliably surfaces wrong
premises early. It worked repeatedly in the observed session — refuting a
mechanism before an implementation was built on it, correcting orchestrator
arithmetic, and prompting one agent to retract its own over-broad claim.

**Risk it might not survive.** All the observed instances were *ad hoc*, written
fresh into each dispatch with specific reasoning attached. It is now codified in
`references/hypothesis-handling.md` and referenced from three agent definitions. A
standing instruction may degrade into ritual — agents emitting a `CONFIRMED` line
because the schema has a slot for one, rather than because they tested anything.
Manufactured disagreement is a second failure mode: an agent that "refutes"
trivia to satisfy a perceived expectation.

**Test.** Over the next several sessions, count verdicts by type. Healthy looks
like a meaningful minority of `REFUTED` / `PARTIALLY` / `UNPROVABLE HERE`, each
citing `file:line`. Unhealthy looks like near-100% `CONFIRMED` (ritual), or
refutations that are pedantic rather than load-bearing (manufactured). If it
degrades, the fix is likely to reserve the framing for explicitly load-bearing
claims rather than applying it to every dispatch.

Run [`../scripts/verdict-check.sh`](../scripts/verdict-check.sh) to gather the
reports; classify by hand. The script deliberately does not classify — whether a
refutation was load-bearing or manufactured is a semantic judgement, and automating
it would measure keyword frequency rather than the thing we care about.

### Baseline — 2026-08-07, n=7, day one

Seven dispatches in `ai-engine` on the day the rules landed. **No ritual
`CONFIRMED`, no manufactured disagreement.** Observed behaviours, each traceable
to a specific clause:

- `vphist` — **REFUTED** a caller hypothesis about which commit introduced
  `vendor_proto/` tracking ("the hypothesis's introducing commit is wrong"; "two
  key facts already contradict the hypothesis"), and separately reported a tool
  gap rather than guessing around it (Slack/Confluence MCP unavailable).
- `log-reader` ×2 — both applied the *did-not-happen vs not-logged* rule
  explicitly, one citing the emit site (`ReflectionSchemaParser.kt:116`) to prove
  a warning's absence was genuine rather than unreached. Both used positive
  assertion (`dropped_no_selectors=0` as the affirmative counter form, rather than
  absence of an error) and both carried a `Not established` section. One correctly
  returned `intermittent → retry, do not investigate`, and narrowed its own claim
  (per-provider logical isolation proven; shared-transport failure untested).
- `prd` — **self-retracted**: flagged that a PR title *it had set the previous
  day* followed the skill's default format rather than the repo's convention, and
  dropped an unverified "24 commits" figure from a description.
- `refx` — reported an inconvenient side-finding it was not asked about
  (`npm run build` on `main` mutates `vendor_proto/buf.yaml`), explicitly did not
  commit it, and reported commit hygiene unprompted ("staged explicit paths only
  throughout; no `add -A`").
- `ci304` — **CONFIRMED**, but load-bearing: it disambiguated two similarly-named
  Sonar checks (the blocking quality gate failed; the code-scanning check passed)
  and was explicit about the limit of its evidence (diagnosed from the diff
  because the measures API needed auth it lacked).

**This is a baseline, not a verdict, and it is the weakest possible evidence for
the thing Q2 actually asks.** Four reasons to distrust it:

1. **n=7, one session, one repo, one day.**
2. **Novelty.** Brand-new instructions are salient. Q2 is a question about *drift*,
   which by definition cannot appear on day one — so a healthy day-one reading is
   consistent with both outcomes and discriminates between neither.
3. **Grading own homework.** The classification above was made by the same author
   as the rules. A second reader, or a reader given the reports without the rules,
   would be a better judge.
4. **The structural markers disagree with the semantic read** — `verdict-check.sh`
   scored `prd`'s self-retraction as zero correction markers because the phrasing
   didn't match. Further evidence the counts are triage only.

**Re-run at ≥30 dispatches across ≥3 distinct sessions before drawing any
conclusion.** What would falsify health: `CONFIRMED` approaching 100%; verdicts
asserted without a `file:line` or verbatim line; refutations that change no
decision.

---

## Q3 — What is the right size cap for a coordination artefact?

**Theory.** `references/coordination-artifact.md` caps `§Status` entries at 5 lines and
the whole file at ~400 lines, with long-form pushed to per-agent notes files.

**Where the numbers came from.** Reaction, not measurement. The observed
`contract.md` reached 595 lines / 333 KB with individual status entries running to
thousands of words — unquestionably too large to load, which is what the artefact
existed to prevent. The caps are a corrective guess at the other end.

**Unknown.** Whether 5/400 is right, or merely smaller. Too tight and agents split
into notes files nobody reads, reproducing the problem with extra indirection —
the failure would be silent, showing up as agents rediscovering things already
recorded.

**Test.** On the next multi-agent run, check whether agents actually read the
notes files (do later dispatches cite them?) and whether `§Current state` stayed
genuinely current or drifted into history. Tune from that rather than from feel.

---

## Q4 — Should `.agents/context/` cache runtime topology, not just static facts?

**Theory.** `context/` currently holds `project-tools.md` and `boundaries.md` —
both derived from source. A large fraction of the observed session's cost was
rediscovering *runtime* facts that are equally cacheable: port assignments, exact
run commands with env, service dependency order, and accumulated flake signatures
with their distinguishing checks.

**Against.** Runtime topology goes stale faster and less visibly than source-derived
facts, and a stale run command is worse than none — it fails in a way that looks
like a code problem. `boundaries.md` already carries a SHA + TTL protocol that
could be reused, but SHA-based invalidation does not detect the thing that
actually changes here (someone restarted a service on a different port).

**Test.** Instrument how much of a session's early cost is re-establishing runtime
topology already recorded in a prior session's `contract.md`. If it is material,
the design question becomes staleness detection, not storage — probably liveness
probes rather than SHA comparison.
