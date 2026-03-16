---
name: error-handling
description: Rules for handling command failures, verifying outputs, and reporting errors. Always active — apply to every shell command, script execution, or tool invocation.
---

# Error Handling

- Check command exit codes — don't assume success
- Parse error output to diagnose before retrying with fixes
- Don't assume success — verify outputs match expectations
- Report what went wrong clearly if unable to complete a task

## Verification
- After writes: confirm file exists and content is correct
- After API calls: check status codes, not just absence of exceptions
- After builds: confirm artefacts exist at expected paths
- For scripts: dry-run or `--check` / `--syntax-only` flag before full execution where available
