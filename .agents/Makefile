# GNU Make 3.81 (macOS default): no .ONESHELL/.SHELLFLAGS, so each multi-step
# recipe is one backslash-continued shell line that opens with `set -euo pipefail`.
SHELL := /bin/bash
.DEFAULT_GOAL := help

AGENTS_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
CLAUDE_DIR ?= $(HOME)/.claude
CURSOR_DIR ?= $(HOME)/.cursor

UNAME := $(shell uname -s)
ifeq ($(UNAME),Darwin)
CURSOR_STATE_DB ?= $(HOME)/Library/Application Support/Cursor/User/globalStorage/state.vscdb
else ifeq ($(UNAME),Linux)
CURSOR_STATE_DB ?= $(HOME)/.config/Cursor/User/globalStorage/state.vscdb
endif
CURSOR_RULES_KEY := aicontext.personalContext

# `rules` and `skills` are NOT interchangeable, and the split is the whole point:
#   rules/  → auto-loaded by Claude Code, in full, into every session AND every
#             subagent. Verified empirically: content under ~/.claude/rules is
#             present in a subagent's context with zero tool calls. Cost is paid
#             per agent spawn, so keep this directory small.
#   skills/ → only each skill's one-line description is always in context; bodies
#             load by name on demand, and bundled `references/` resolve relative
#             to the skill. Nothing reaches harness files by absolute path
#             (see decisions/0003-plugin-portability-by-name.md).
# Do not "tidy" knowledge skills into rules — that silently re-adds ~40KB to every spawn.
# Entries are <source relative to .agents>:<destination>.
LINKS := \
	AGENTS.md:$(CLAUDE_DIR)/CLAUDE.md \
	agents:$(CLAUDE_DIR)/agents \
	skills:$(CLAUDE_DIR)/skills \
	rules:$(CLAUDE_DIR)/rules \
	agents:$(CURSOR_DIR)/agents \
	skills:$(CURSOR_DIR)/skills \
	rules:$(CURSOR_DIR)/rules

.PHONY: help install link sync-cursor count-tokens

help: ## List targets
	@awk -F ':.*## ' '/^[a-z-]+:.*## / { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: link sync-cursor ## Symlink the harness into ~/.claude and ~/.cursor, then sync Cursor user rules

link: ## Symlink agents/, skills/, rules/ and AGENTS.md; back up anything already in the way
	@set -euo pipefail; \
	echo "Installing agent harness symlinks..."; \
	for entry in $(LINKS); do \
		src="$(AGENTS_DIR)/$${entry%%:*}"; dest="$${entry#*:}"; \
		mkdir -p "$$(dirname "$$dest")"; \
		if [ -L "$$dest" ]; then \
			current="$$(readlink "$$dest")"; \
			if [ "$$current" = "$$src" ]; then echo "✓ $$dest already linked"; continue; fi; \
			echo "→ Replacing existing symlink $$dest (was → $$current)"; \
			rm "$$dest"; \
		elif [ -e "$$dest" ]; then \
			backup="$$dest.bak.$$(date +%s)"; \
			echo "→ Backing up existing $$dest to $$backup"; \
			mv "$$dest" "$$backup"; \
		fi; \
		ln -s "$$src" "$$dest"; \
		echo "✓ Linked $$dest → $$src"; \
	done

# readfile()/writefile() are sqlite3 CLI built-ins, so no Python is needed to move
# AGENTS.md in and out of Cursor's ItemTable. CAST keeps the value TEXT, as Cursor stores it.
sync-cursor: ## Write AGENTS.md into Cursor's user rules (state.vscdb), backing up any differing value
	@set -euo pipefail; \
	echo "Syncing Cursor user rules..."; \
	db="$(CURSOR_STATE_DB)"; rules="$(AGENTS_DIR)/AGENTS.md"; \
	if [ -z "$$db" ]; then echo "→ Unsupported OS for Cursor user rules sync; skipping"; exit 0; fi; \
	if [ ! -f "$$db" ]; then echo "→ Cursor state database not found; skipping user rules sync"; exit 0; fi; \
	if ! command -v sqlite3 >/dev/null; then echo "→ sqlite3 not found; skipping Cursor user rules sync"; exit 0; fi; \
	test -f "$$rules"; \
	mkdir -p "$(CURSOR_DIR)"; \
	backup="$(CURSOR_DIR)/user-rules.bak.$$(date +%s)"; \
	written="$$(sqlite3 "$$db" "SELECT writefile('$$backup', value) FROM ItemTable \
		WHERE key = '$(CURSOR_RULES_KEY)' AND value <> '' AND value IS NOT CAST(readfile('$$rules') AS TEXT)")"; \
	if [ -n "$$written" ]; then echo "→ Backed up existing Cursor user rules to $$backup"; fi; \
	sqlite3 "$$db" "INSERT INTO ItemTable (key, value) VALUES ('$(CURSOR_RULES_KEY)', CAST(readfile('$$rules') AS TEXT))"; \
	synced="$$(sqlite3 "$$db" "SELECT value = CAST(readfile('$$rules') AS TEXT) FROM ItemTable WHERE key = '$(CURSOR_RULES_KEY)'")"; \
	if [ "$$synced" != 1 ]; then echo "✗ Cursor user rules do not match AGENTS.md after write" >&2; exit 1; fi; \
	echo "✓ Synced AGENTS.md → Cursor user rules ($(CURSOR_RULES_KEY))"; \
	echo "  Restart Cursor for user rules to reload. Enterprise accounts may sync rules from the cloud."

# tiktoken is OpenAI's tokenizer, so counts approximate Claude's — fine for relative cost between files.
count-tokens: FILE ?= $(AGENTS_DIR)
count-tokens: ## Count tokens in FILE=<path> (file or directory; defaults to all of .agents)
	@test -e "$(FILE)" || { echo "not found: $(FILE)" >&2; exit 1; }
	@npx -y tiktoken-cli "$(FILE)"
