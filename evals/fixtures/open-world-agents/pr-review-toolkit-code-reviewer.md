---
name: pr-review-toolkit:code-reviewer
description: 'Use this agent when you need to review code for adherence to project guidelines, style guides, and best practices. This agent should be used proactively after writing or modifying code, especially before committing changes or creating pull requests. It will check for style violations, potential issues, and ensure code follows the established patterns in CLAUDE.md. Also the agent needs to know which files to focus on for the review. In most cases this will be recently completed work which is unstaged in git (can be retrieved by running git diff). However there can be cases where this is different, make sure to specify this as the agent input when calling the agent. Typical triggers include the user asking for a review of a feature they just implemented, the assistant proactively reviewing its own newly-written code before declaring a task done, and a final pre-PR check before opening a pull request. See "When to invoke" in the agent body for worked scenarios.'
model: opus
---

[Fixture placeholder — never executed during routing eval. The harness denies Agent invocations via PreToolUse hook.]
