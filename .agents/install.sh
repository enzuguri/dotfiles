#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
CURSOR_DIR="$HOME/.cursor"

cursor_state_db() {
  case "$(uname -s)" in
    Darwin)
      echo "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb"
      ;;
    Linux)
      echo "$HOME/.config/Cursor/User/globalStorage/state.vscdb"
      ;;
    *)
      return 1
      ;;
  esac
}

link_path() {
  local src="$1" dest="$2"
  local dest_name backup current_target

  dest_name="$(basename "$dest")"
  mkdir -p "$(dirname "$dest")"

  if [ -L "$dest" ]; then
    current_target="$(readlink "$dest")"
    if [ "$current_target" = "$src" ]; then
      echo "✓ $dest already linked"
      return 0
    fi
    echo "→ Replacing existing symlink $dest (was → $current_target)"
    rm "$dest"
  elif [ -e "$dest" ]; then
    backup="$dest.bak.$(date +%s)"
    echo "→ Backing up existing $dest to $backup"
    mv "$dest" "$backup"
  fi

  ln -s "$src" "$dest"
  echo "✓ Linked $dest → $src"
}

sync_cursor_user_rules() {
  local state_db agents_md existing backup

  if ! state_db="$(cursor_state_db)"; then
    echo "→ Unsupported OS for Cursor user rules sync; skipping"
    return 0
  fi

  if [ ! -f "$state_db" ]; then
    echo "→ Cursor state database not found; skipping user rules sync"
    return 0
  fi

  if ! command -v sqlite3 >/dev/null; then
    echo "→ sqlite3 not found; skipping Cursor user rules sync"
    return 0
  fi

  agents_md="$DOTFILES_DIR/AGENTS.md"
  existing="$(sqlite3 "$state_db" "SELECT value FROM ItemTable WHERE key = 'aicontext.personalContext';" 2>/dev/null || true)"

  if [ -n "$existing" ] && [ "$existing" != "$(<"$agents_md")" ]; then
    backup="$CURSOR_DIR/user-rules.bak.$(date +%s)"
    mkdir -p "$CURSOR_DIR"
    printf '%s' "$existing" > "$backup"
    echo "→ Backed up existing Cursor user rules to $backup"
  fi

  python3 - "$state_db" "$agents_md" <<'PY'
import sqlite3
import sys

db_path, agents_path = sys.argv[1], sys.argv[2]
content = open(agents_path, encoding="utf-8").read()

conn = sqlite3.connect(db_path)
try:
    row = conn.execute(
        "SELECT 1 FROM ItemTable WHERE key = 'aicontext.personalContext'"
    ).fetchone()
    if row:
        conn.execute(
            "UPDATE ItemTable SET value = ? WHERE key = 'aicontext.personalContext'",
            (content,),
        )
    else:
        conn.execute(
            "INSERT INTO ItemTable (key, value) VALUES ('aicontext.personalContext', ?)",
            (content,),
        )
    conn.commit()
finally:
    conn.close()
PY

  echo "✓ Synced AGENTS.md → Cursor user rules (aicontext.personalContext)"
  echo "  Restart Cursor for user rules to reload. Enterprise accounts may sync rules from the cloud."
}

declare -a SYMLINKS=(
  "$DOTFILES_DIR/AGENTS.md|$CLAUDE_DIR/CLAUDE.md"
  "$DOTFILES_DIR/agents|$CLAUDE_DIR/agents"
  "$DOTFILES_DIR/skills|$CLAUDE_DIR/skills"
  "$DOTFILES_DIR/rules|$CLAUDE_DIR/rules"
  "$DOTFILES_DIR/agents|$CURSOR_DIR/agents"
  "$DOTFILES_DIR/skills|$CURSOR_DIR/skills"
  "$DOTFILES_DIR/rules|$CURSOR_DIR/rules"
)

echo "Installing agent harness symlinks..."
for entry in "${SYMLINKS[@]}"; do
  IFS='|' read -r src dest <<< "$entry"
  link_path "$src" "$dest"
done

echo
echo "Syncing Cursor user rules..."
sync_cursor_user_rules
