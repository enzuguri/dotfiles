# Bootstrap (first run)

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
