import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';
import * as React from 'react';
import { getProjectRoot } from '../../bootstrap/state.js';
import { getAutoMemPath } from '../../memdir/paths.js';
import type { LocalJSXCommandCall } from '../../types/command.js';

export const call: LocalJSXCommandCall = async (onDone) => {
  try {
    const projectRoot = getProjectRoot();
    const globalMemPath = getAutoMemPath();
    const localClaudeDir = join(projectRoot, '.claude');
    const localMemPath = join(localClaudeDir, 'memory');

    // 1. Create local .claude/ directory if it doesn't exist
    if (!existsSync(localClaudeDir)) {
      mkdirSync(localClaudeDir, { recursive: true });
    }
    if (!existsSync(localMemPath)) {
      mkdirSync(localMemPath, { recursive: true });
    }

    // 2. Generate the sync script
    const scriptPath = join(localClaudeDir, 'sync-claude-memory.sh');
    const scriptContent = `#!/bin/bash

# Determine project root and sanitized path (matches OpenClaude's logic)
PROJECT_ROOT=$(git rev-parse --show-toplevel)
SANITIZED_PATH=$(echo "$PROJECT_ROOT" | sed 's/[^a-zA-Z0-9]/-/g')

# Resolve OpenClaude config home (~/.openclaude or fallback to ~/.claude)
CONFIG_HOME="$HOME/.openclaude"
if [ ! -d "$CONFIG_HOME" ] && [ -d "$HOME/.claude" ]; then
  CONFIG_HOME="$HOME/.claude"
fi

GLOBAL_MEM_PATH="$CONFIG_HOME/projects/$SANITIZED_PATH/memory/"
LOCAL_MEM_PATH="$PROJECT_ROOT/.claude/memory/"

if [ "$1" == "pull" ]; then
  echo "Pulling team memory from global OpenClaude to local repository..."
  mkdir -p "$LOCAL_MEM_PATH"
  rsync -av --delete --include="*/" --include="*.md" --exclude="*" "$GLOBAL_MEM_PATH" "$LOCAL_MEM_PATH"
  
  # Privacy Guard: Filter out private user profile memories from git tracking
  for file in "$LOCAL_MEM_PATH"*.md; do
    if [ -f "$file" ] && grep -q "type: user" "$file"; then
      rm -f "$file"
    fi
  done

  # Add team memories to git automatically
  git add "$LOCAL_MEM_PATH"
  echo "Team memory pulled successfully (private user memories kept local)."
elif [ "$1" == "push" ]; then
  echo "Pushing team memory from local repository to global OpenClaude..."
  mkdir -p "$GLOBAL_MEM_PATH"
  rsync -av --delete --include="*/" --include="*.md" --exclude="*" "$LOCAL_MEM_PATH" "$GLOBAL_MEM_PATH"
  echo "Team memory pushed successfully."
else
  echo "Usage: ./.claude/sync-claude-memory.sh [pull|push]"
  exit 1
fi
`;

    writeFileSync(scriptPath, scriptContent, 'utf8');
    chmodSync(scriptPath, '0755');

    // 3. Setup git hooks automatically
    const gitHooksDir = join(projectRoot, '.git', 'hooks');
    let preCommitStatus = '';
    let postMergeStatus = '';

    if (existsSync(join(projectRoot, '.git'))) {
      if (!existsSync(gitHooksDir)) {
        mkdirSync(gitHooksDir, { recursive: true });
      }

      // Setup pre-commit (Global -> Local)
      const preCommitPath = join(gitHooksDir, 'pre-commit');
      const preCommitCmd = `\n# Sync OpenClaude memory before commit\n./.claude/sync-claude-memory.sh pull\n`;

      if (existsSync(preCommitPath)) {
        const existingHook = readFileSync(preCommitPath, 'utf8');
        if (!existingHook.includes('sync-claude-memory.sh pull')) {
          writeFileSync(preCommitPath, existingHook + preCommitCmd, 'utf8');
          preCommitStatus = 'Appended to existing .git/hooks/pre-commit';
        } else {
          preCommitStatus = 'Already exists in pre-commit';
        }
      } else {
        const hookContent = `#!/bin/bash${preCommitCmd}`;
        writeFileSync(preCommitPath, hookContent, 'utf8');
        chmodSync(preCommitPath, '0755');
        preCommitStatus = 'Created new .git/hooks/pre-commit';
      }

      // Setup post-merge (Local -> Global)
      const postMergePath = join(gitHooksDir, 'post-merge');
      const postMergeCmd = `\n# Sync OpenClaude memory after git pull\n./.claude/sync-claude-memory.sh push\n`;

      if (existsSync(postMergePath)) {
        const existingHook = readFileSync(postMergePath, 'utf8');
        if (!existingHook.includes('sync-claude-memory.sh push')) {
          writeFileSync(postMergePath, existingHook + postMergeCmd, 'utf8');
          postMergeStatus = 'Appended to existing .git/hooks/post-merge';
        } else {
          postMergeStatus = 'Already exists in post-merge';
        }
      } else {
        const hookContent = `#!/bin/bash${postMergeCmd}`;
        writeFileSync(postMergePath, hookContent, 'utf8');
        chmodSync(postMergePath, '0755');
        postMergeStatus = 'Created new .git/hooks/post-merge';
      }

    } else {
      preCommitStatus = 'No .git directory found.';
      postMergeStatus = 'No .git directory found.';
    }

    const message = `✅ Memory Sync Setup Complete!

Created sync script at: ${scriptPath}
Hooks Status:
  - Pre-commit (pull): ${preCommitStatus}
  - Post-merge (push): ${postMergeStatus}

- Every time you commit, OpenClaude's global memory will be copied to ./.claude/memory so it can be versioned.
- Every time you do a git pull, the incoming team memory will be pushed to your local OpenClaude environment.`;

    onDone(message, { display: 'system' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    onDone(`❌ Failed to setup memory sync: ${errorMessage}`, { display: 'system' });
  }

  return null;
};
