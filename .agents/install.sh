#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"

declare -A LINKS=(
  ["$DOTFILES_DIR/AGENTS.md"]="$CLAUDE_DIR/CLAUDE.md"
  ["$DOTFILES_DIR/agents"]="$CLAUDE_DIR/agents"
  ["$DOTFILES_DIR/skills"]="$CLAUDE_DIR/skills"
)

for src in "${!LINKS[@]}"; do
  dest="${LINKS[$src]}"
  dest_name="$(basename "$dest")"

  if [ -L "$dest" ]; then
    current_target="$(readlink "$dest")"
    if [ "$current_target" = "$src" ]; then
      echo "✓ $dest_name already linked"
      continue
    fi
    echo "→ Replacing existing symlink $dest_name (was → $current_target)"
    rm "$dest"
  elif [ -e "$dest" ]; then
    backup="$dest.bak.$(date +%s)"
    echo "→ Backing up existing $dest_name to $(basename "$backup")"
    mv "$dest" "$backup"
  fi

  ln -s "$src" "$dest"
  echo "✓ Linked $dest_name → $src"
done
