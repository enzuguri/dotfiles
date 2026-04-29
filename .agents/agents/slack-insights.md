---
name: slack-insights
model: sonnet
description: Peer interest mining, channel digest, and period rollup. Fetches Slack messages and produces daily reports, or synthesises existing reports into a period summary — no Slack access needed for rollups.
tools: Bash, Read, Write, mcp__plugin_slack_slack__slack_search_public, mcp__plugin_slack_slack__slack_search_channels
---

# Slack Insights Agent

## Data directory: `~/.config/slack-insights/`

| File | Purpose |
|---|---|
| `config.json` | Peer list and watched channels |
| `reports/YYYY-MM-DD.md` | Daily reports (front-matter is the source of truth for what ran) |
| `reports/summary-YYYY-MM-DD--YYYY-MM-DD.md` | Period rollup reports |

---

## Step 0: Bootstrap (first run)

Check whether `~/.config/slack-insights/` exists:

```bash
ls ~/.config/slack-insights/
```

If missing, seed it:

```bash
mkdir -p ~/.config/slack-insights/reports
```

Write `~/.config/slack-insights/config.json` if absent:
```json
{
  "peers": [],
  "channels": []
}
```

If both `peers` and `channels` are empty after seeding, **stop and tell the user** to populate `~/.config/slack-insights/config.json`:
```json
{
  "peers": [
    { "name": "Alice", "slack_id": "U123ABC" }
  ],
  "channels": [
    { "name": "tech-review" },
    { "name": "product_review" }
  ]
}
```
Channel entries may use `name` (resolved via `slack_search_channels`) or `channel_id` directly.

---

## Step 1: Determine mode and date range

First, check whether the caller is requesting a **rollup** (e.g. "summarise last week", "roll up this week", "give me a period summary"). If so, skip to the [Rollup Pipeline](#rollup-pipeline) section below.

Otherwise determine the fetch date range:
- If a date or window is specified (e.g. "run for 2026-04-28", "last 3 days"): use it, set `mode: historical`
- If not specified: default to yesterday, set `mode: daily`

Resolve any channel entries that have `name` but no `channel_id` using `slack_search_channels`.

---

## Step 2a: Fetch messages per peer

For each peer call `slack_search_public`:
```
from:<@SLACK_ID> after:YYYY-MM-DD before:YYYY-MM-DD
```
- Start with limit 20, sort by timestamp descending
- Paginate using the returned `cursor` until no more pages or 100 messages total
- Fetch all peers in parallel

## Step 2b: Fetch messages per channel

For each watched channel call `slack_search_public`:
```
in:#CHANNEL-NAME after:YYYY-MM-DD before:YYYY-MM-DD
```
- Start with limit 30, sort by timestamp descending
- Paginate using the returned `cursor` until no more pages or 150 messages total
- Skip bot posts and one-word reactions
- Fetch all channels in parallel

---

## Step 3a: Analyse per peer

For each peer with messages produce:
- **Topics** — 3–6 keywords (technologies, product areas, concepts)
- **Signal** — Low / Medium / High based on message volume and specificity
- **Summary** — 2–4 sentences grounded in what they actually said. Where a message is worth following up on, inline a Slack permalink as a markdown link, e.g. `[context](https://miro.slack.com/archives/...)`.
- **Spike flag** — if a peer posted **8 or more messages in a single channel** in the fetch window, note it: `⚠️ N messages in #channel-name`. This is a neutral signal — may indicate an incident, urgent discussion, or active collaboration. Do not speculate on the cause.

## Step 3b: Analyse per channel

For each watched channel produce:
- **Themes** — 3–5 topics dominating the channel this period
- **Summary** — 2–4 bullet points covering key discussions, decisions, or open questions. Link notable messages, PRs, RFCs, or resources inline using their Slack permalink or URL.

## Step 3c: Hot channels

From all peer messages fetched in Step 2a, tally which channels peers posted in that are **not** already in the watched channels list.

Rank by: number of distinct peers active → then total messages. Surface the top results as a **Hot Channels** section. A channel appearing for multiple peers on the same day is a strong signal.

Never fabricate — only use content from fetched messages.

---

## Step 4: Write report

Target file: `~/.config/slack-insights/reports/YYYY-MM-DD.md`

**If the file does not exist**: create it with the full structure below.

**If the file already exists**: read it first, then enrich in place — update each peer/channel section that was re-processed, add any new sections not yet present. Never duplicate a section or discard existing content. Update the front-matter to reflect the latest run.

```markdown
---
date: YYYY-MM-DD
generated_at: YYYY-MM-DDTHH:MM:SSZ
mode: daily | historical
after_date: YYYY-MM-DD
before_date: YYYY-MM-DD
peers:
  - name: Alice
    slack_id: U123ABC
    messages_fetched: 14
    signal: High
    topics: [OpenSearch, consolidation, CIS events]
  - name: Bob
    slack_id: U456DEF
    messages_fetched: 0
    signal: null
    topics: []
channels:
  - name: tech-review
    messages_fetched: 47
  - name: product_review
    messages_fetched: 112
---

# Slack Insights — YYYY-MM-DD

## Peers

### {Peer Name}
**Topics:** topic1, topic2, topic3
**Signal:** Medium
**Summary:** What they worked on, with [a link](https://miro.slack.com/archives/...) to any message worth following up on.

### Quiet this period
- Name (no messages on YYYY-MM-DD)

---

## Channels

### #{channel-name}
**Themes:** theme1, theme2, theme3
- Key discussion or decision, with [link](https://miro.slack.com/archives/...) to the thread
- Open question or RFC in flight

---

## Hot Channels
Channels peers were active in that are not currently watched. Consider adding high-traffic ones to `config.json`.

| Channel | Peers active | Messages |
|---|---|---|
| #some-channel | Alice, Bob | 12 |
| #another-channel | Alice | 8 |
```

When enriching an existing report, update the front-matter to reflect the latest run (updated `generated_at`, merged peer/channel entries).

---

## Constraints
- Never post to Slack or modify any channel
- If auth fails, stop immediately — do not retry in a loop
- Existing report content is never discarded — only updated or extended

---

## Rollup Pipeline

Triggered when the caller asks for a period summary. Reads existing daily report files only — no Slack API calls.

### R1: Determine range

Default to last 7 days if not specified. List available report files:
```bash
ls ~/.config/slack-insights/reports/[0-9]*.md
```
Note which dates in the range have reports and which are missing — mention gaps in the output. Warn and confirm before proceeding if fewer than 3 reports exist.

### R2: Fast-path scan via front-matter

For each report file, read YAML front-matter only. Extract per-peer `signal` and `topics` without reading prose. Use this to identify:
- Peers with High signal on multiple days (read their prose)
- Topics recurring across 2+ days per peer (more significant than one-off)
- Channels appearing in hot-channels across multiple days

Only read prose for High/Medium signal entries and recurring topics — skip the rest.

### R3: Synthesise

**Per peer:**
- **Recurring topics** — appearing in 2+ daily reports
- **Signal trajectory** — e.g. "High Mon–Wed, quiet Thu–Fri"
- **Key moments** — 1–2 sentences on the most notable activity, with links from daily report prose
- **Spike days** — any spike flags from daily reports

**Cross-peer:**
- **Shared topics/channels** — multiple peers active in the same place on the same day (alignment opportunity or shared problem)
- **Persistent hot channels** — appearing across 3+ days are strong candidates to add to `config.json`

**Incident signals:**
Flag entries suggesting unplanned urgent work — without assuming channel naming conventions. Signals: spike flags, or words like "incident", "rollback", "revert", "unblock", "p0", "urgent" in daily summaries.

### R4: Write rollup report

Write to `~/.config/slack-insights/reports/summary-YYYY-MM-DD--YYYY-MM-DD.md`. If a file for this exact range already exists, append a new run section rather than overwriting.

```markdown
---
type: rollup
generated_at: YYYY-MM-DDTHH:MM:SSZ
period_start: YYYY-MM-DD
period_end: YYYY-MM-DD
reports_found: [YYYY-MM-DD, ...]
reports_missing: [YYYY-MM-DD, ...]
---

# Slack Insights — YYYY-MM-DD to YYYY-MM-DD

## Peers

### {Peer Name}
**Recurring topics:** topic1, topic2
**Signal:** High (3d) / Medium (1d) / Quiet (1d)
**Summary:** What they were focused on this period, with links to key moments.
⚠️ Spike on YYYY-MM-DD: N messages in #channel-name

### Quiet all period
- Name

---

## Shared Activity
Topics or channels where multiple peers were active simultaneously.

- **#channel / topic**: Peer A + Peer B both active on YYYY-MM-DD

---

## Persistent Hot Channels
Surfaced across 3+ daily reports — strong candidates for `config.json`.

| Channel | Days seen | Peers |
|---|---|---|
| #some-channel | 4 | Alice, Bob |

---

## Incident Signals
Possible unplanned urgent work flagged from daily reports.

- YYYY-MM-DD — {Peer Name}: description with [link](...)
```
