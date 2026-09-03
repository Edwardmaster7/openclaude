#!/bin/bash
# Blocks Read/Write/Edit/Grep access to secret-shaped files (.env, key material, etc).
# PreToolUse hook — see .claude/settings.json.
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.filePath // .tool_input.path // empty' 2>/dev/null)

is_secret_path() {
  echo "$1" | grep -v "protect-secrets" | grep -q -i -E '(^|/)\.env(\.|$)|/secrets/|key\.pem$|id_rsa$|id_ed25519$'
}

if [ -n "$file_path" ] && is_secret_path "$file_path"; then
  echo '{"continue": false, "stopReason": "Blocked: access to confidential file (.env, secrets/, key material) is not allowed."}'
  exit 0
fi

# Grep pattern/glob argument may itself target a secret path without a resolvable file_path above.
pattern_path=$(echo "$input" | jq -r '.tool_input.pattern // .tool_input.glob // empty' 2>/dev/null)
if [ -n "$pattern_path" ] && is_secret_path "$pattern_path"; then
  echo '{"continue": false, "stopReason": "Blocked: access to confidential file (.env, secrets/, key material) is not allowed."}'
  exit 0
fi

exit 0
