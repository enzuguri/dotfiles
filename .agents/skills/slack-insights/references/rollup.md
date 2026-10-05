# Rollup Pipeline

Triggered when the caller asks for a period summary. Reads existing daily report files only — no Slack API calls.

## R1: Determine range

Default to last 7 days if not specified. List available report files:
```bash
ls ~/.config/slack-insights/reports/[0-9]*.md
```
Note which dates in the range have reports and which are missing — mention gaps in the output. Warn and confirm before proceeding if fewer than 3 reports exist.

## R2: Fast-path scan via front-matter

For each report file, read YAML front-matter only. Extract per-peer `signal` and `topics` without reading prose. Use this to identify:
- Peers with High signal on multiple days (read their prose)
- Topics recurring across 2+ days per peer (more significant than one-off)
- Channels appearing in hot-channels across multiple days

Only read prose for High/Medium signal entries and recurring topics — skip the rest.

## R3: Synthesise

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

## R4: Write rollup report

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
