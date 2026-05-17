#!/usr/bin/env bash
# Claude Code SessionEnd hook — append a session entry to the Obsidian
# vault so each working session leaves a trail. Failures are silent and
# non-blocking (we never want a hook to break Claude Code).

# Per-user vault path. If the path doesn't exist on this machine, exit
# cleanly without writing anything.
VAULT="/Users/garryavetissian/Library/Mobile Documents/iCloud~md~obsidian/Documents/SoloOS Sessions"
[ -d "$VAULT" ] || exit 0

# Drain stdin (Claude Code passes JSON about the session; we don't need
# it for this minimal logger but reading it prevents SIGPIPE).
cat > /dev/null 2>&1 || true

CWD="${CLAUDE_PROJECT_DIR:-$PWD}"
PROJECT="$(basename "$CWD")"

# Only log SoloOS sessions; other projects on the same machine shouldn't
# pollute this vault.
[ "$PROJECT" = "soloos" ] || exit 0

INDEX="$VAULT/_session-index.md"
DATE="$(date '+%Y-%m-%d')"
TIME="$(date '+%H:%M')"

{
  if [ ! -f "$INDEX" ]; then
    echo "# SoloOS — Session Index"
    echo ""
    echo "Auto-appended by Claude Code's SessionEnd hook. Each entry"
    echo "captures the date, time, and commits made during the session."
    echo "Use the per-session files in this folder for richer notes."
    echo ""
  fi
  echo "## $DATE $TIME"
  echo ""
  if [ -d "$CWD/.git" ]; then
    BRANCH="$(git -C "$CWD" branch --show-current 2>/dev/null)"
    HEAD_SHA="$(git -C "$CWD" rev-parse --short HEAD 2>/dev/null)"
    echo "- Branch: \`${BRANCH:-unknown}\` @ \`${HEAD_SHA:-no-commits}\`"
    # Commits made within the last 4 hours — a generous window for "this
    # session" without depending on session-start timestamps.
    NEW_COMMITS="$(git -C "$CWD" log --since='4 hours ago' --pretty=format:'%h %s' 2>/dev/null)"
    if [ -n "$NEW_COMMITS" ]; then
      echo "- Recent commits (last 4h):"
      # Wrap the 7-char hash in backticks and indent two spaces.
      echo "$NEW_COMMITS" | sed -E 's/^([a-f0-9]{7,40}) (.*)$/  - `\1` \2/'
    else
      echo "- No new commits in the last 4 hours."
    fi
    # Working-tree state at session end.
    DIRTY="$(git -C "$CWD" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
    if [ "$DIRTY" -gt 0 ]; then
      echo "- Working tree: $DIRTY uncommitted changes at session end"
    else
      echo "- Working tree: clean"
    fi
  fi
  echo ""
  echo "---"
  echo ""
} >> "$INDEX" 2>/dev/null || true

exit 0
