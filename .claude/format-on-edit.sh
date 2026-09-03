#!/bin/bash
# Best-effort zero-turn formatting after Write/Edit.
# This repo has no local eslint/prettier binary and doesn't run trunk in CI —
# .trunk/trunk.yaml is a locally-opt-in config. If `trunk` isn't installed,
# this is a silent no-op so it never blocks or errors out the tool call.
# PostToolUse hook — see .claude/settings.json.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // .tool_input.filePath // empty' 2>/dev/null)

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

case "$file_path" in
  *.ts|*.tsx|*.mjs|*.cjs|*.js|*.jsx|*.json|*.md|*.yml|*.yaml)
    if command -v trunk >/dev/null 2>&1; then
      trunk fmt "$file_path" >/dev/null 2>&1 || true
    fi
    ;;
esac

exit 0
