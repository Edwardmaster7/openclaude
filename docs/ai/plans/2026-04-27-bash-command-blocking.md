# Bash Command Blocking Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand BashTool command blocking to prevent file editing and redirection via Bash commands (using static AST parsing), adding an optional LLM-based smart fallback, controlled via a new setting `bashSecurityLevel`.

**Architecture:** We will implement a three-layer validation system in `BashTool.tsx`:
1. **Static AST Analysis:** Modifying the existing static parsing to detect AST redirection nodes (like `>`, `>>`) and in-place modifiers for commands (like `sed -i`), instead of just checking if the base command is `cat`.
2. **LLM Fast Guardrail (Smart Mode):** If a command is complex enough and static parsing doesn't block it, an LLM call (`gemini-3-flash` or `claude-3-5-haiku` via `queryHaiku`/`queryWithModel`) is made.
3. **Settings Integration:** A new `bashSecurityLevel` setting controls if we use just static parsing (`static`) or both static and LLM analysis (`smart`).

**Tech Stack:** TypeScript, Zod (for settings), Bash AST parsing (via our existing utils).

---

### Task 1: Add `bashSecurityLevel` to Settings

**Files:**
- Modify: `src/utils/settings/types.ts`

- [ ] **Step 1: Add the setting type and schema**

In `src/utils/settings/types.ts`, add the property to the `SettingsSchema`:

```typescript
      bashSecurityLevel: z
        .enum(['static', 'smart'])
        .optional()
        .describe(
          'Configures the security level for the Bash tool: "static" uses fast AST/Regex blocking, "smart" adds an LLM fallback for complex commands.',
        ),
```
Ensure you insert it in the `SettingsSchema` inside `lazySchema(() => z.object({ ... }))`.

- [ ] **Step 2: Commit**

```bash
git add src/utils/settings/types.ts
git commit -m "feat(settings): add bashSecurityLevel setting"
```

### Task 2: Implement Static AST Redirect/File Mod Detection

**Files:**
- Create: `src/tools/BashTool/bashCommandValidation.ts`
- Modify: `src/tools/BashTool/bashPermissions.ts` or `src/tools/BashTool/BashTool.tsx` (to update the import/usage)

- [ ] **Step 1: Create the new detection logic**

Create `src/tools/BashTool/bashCommandValidation.ts`:

```typescript
import { splitCommandWithOperators } from '../../utils/bash/commands.js'

/**
 * Checks if a bash command attempts to edit files or use redirection,
 * which should be blocked to encourage usage of FileReadTool/FileWriteTool/FileEditTool.
 */
export function detectBlockedFileModifications(command: string): boolean {
  let partsWithOperators: string[]
  try {
    partsWithOperators = splitCommandWithOperators(command)
  } catch {
    return false
  }
  if (partsWithOperators.length === 0) return false

  let skipNextAsRedirectTarget = false
  for (let i = 0; i < partsWithOperators.length; i++) {
    const part = partsWithOperators[i]!
    
    if (skipNextAsRedirectTarget) {
      skipNextAsRedirectTarget = false
      continue
    }

    // Block file redirection (except to /dev/null or /dev/stderr)
    if (part === '>' || part === '>>' || part === '>&') {
      const nextPart = partsWithOperators[i + 1]?.trim()
      if (nextPart && !nextPart.startsWith('/dev/')) {
        return true
      }
      skipNextAsRedirectTarget = true
      continue
    }

    if (part === '||' || part === '&&' || part === '|' || part === ';') {
      continue
    }

    const tokens = part.trim().split(/\s+/)
    const baseCommand = tokens[0]

    // Block cat
    if (baseCommand === 'cat') {
      return true
    }

    // Block interactive editors
    if (['vi', 'vim', 'nano', 'ed'].includes(baseCommand as string)) {
      return true
    }

    // Block in-place modifiers (like sed -i, perl -i)
    if (['sed', 'perl'].includes(baseCommand as string)) {
      if (tokens.some(t => t === '-i' || t.startsWith('--in-place'))) {
        return true
      }
    }
  }

  return false
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/BashTool/bashCommandValidation.ts
git commit -m "feat(bash): implement AST-based redirection and modifier blocking"
```

### Task 3: Implement LLM Smart Validation

**Files:**
- Modify: `src/tools/BashTool/bashCommandValidation.ts`

- [ ] **Step 1: Add the LLM fallback function**

Append to `src/tools/BashTool/bashCommandValidation.ts`:

```typescript
import { queryWithModel } from '../../services/api/claude.js'
import { getSmallFastModel } from '../../utils/model/modelOptions.js'

/**
 * Uses a fast LLM (e.g. Haiku or Flash Lite) to analyze if a command
 * attempts to modify files locally, acting as a smart fallback.
 */
export async function isBlockedBySmartValidation(
  command: string,
  abortSignal: AbortSignal,
): Promise<boolean> {
  // Only trigger on complex commands (heuristic)
  if (command.length < 100 && !command.includes('|') && !command.includes('EOF')) {
    return false
  }

  const systemPrompt = "Analyze this bash command. Does it attempt to modify, overwrite, or write new content to any file on the local filesystem (excluding /dev/null, temporary stdout manipulation, or purely read operations)? Output ONLY 'yes' or 'no'."

  try {
    const response = await queryWithModel({
      systemPrompt: [systemPrompt],
      userPrompt: command,
      signal: abortSignal,
      options: {
        model: getSmallFastModel(),
        maxTokens: 10,
        temperature: 0,
      },
    })
    
    const text = response.content.find((c): c is {type: 'text', text: string} => c.type === 'text')?.text || ''
    return text.trim().toLowerCase().includes('yes')
  } catch (error) {
    // If the LLM fails, default to passing to not block the user unexpectedly
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/BashTool/bashCommandValidation.ts
git commit -m "feat(bash): add LLM fallback validation for bash commands"
```

### Task 4: Integrate into BashTool validateInput

**Files:**
- Modify: `src/tools/BashTool/BashTool.tsx`

- [ ] **Step 1: Update BashTool to use the new validations**

In `src/tools/BashTool/BashTool.tsx`, remove `detectBlockedCatPattern` and import the new functions.

```typescript
import { detectBlockedFileModifications, isBlockedBySmartValidation } from './bashCommandValidation.js'
import { getSettings } from '../../utils/settings/settings.js'
// Note: You may need to add/update imports in BashTool.tsx as needed.
```

Find the `validateInput` method in `BashTool.tsx` and update it:

```typescript
  async validateInput(input: BashToolInput, abortSignal?: AbortSignal): Promise<ValidationResult> {
    const settings = getSettings()
    const securityLevel = settings.bashSecurityLevel ?? 'smart'

    // Static AST validation
    if (detectBlockedFileModifications(input.command)) {
      return {
        result: false,
        message: `Blocked: File modification or redirection detected. Do not use bash to edit files. Use the Read, Write, and Edit tools instead.`,
        errorCode: 43
      };
    }

    // Smart LLM validation (only if enabled and abortSignal is available)
    if (securityLevel === 'smart' && abortSignal) {
      const isSmartBlocked = await isBlockedBySmartValidation(input.command, abortSignal)
      if (isSmartBlocked) {
        return {
          result: false,
          message: `Blocked (Smart Validation): Complex file modification detected. Do not use bash to edit files. Use the Read, Write, and Edit tools instead.`,
          errorCode: 44
        };
      }
    }

    if (feature('MONITOR_TOOL') && !isBackgroundTasksDisabled && !input.run_in_background) {
      const sleepPattern = detectBlockedSleepPattern(input.command);
// ... keep existing sleepPattern logic
```

*Note: ensure `validateInput` signature has `abortSignal` or you fetch it from context if it's not directly in the arguments. The `validateInput` interface in `Tool.ts` usually receives `(input: Input, context?: ToolContext)`. So you might need to use `context?.abortSignal`.*

- [ ] **Step 2: Fix any test failures**

Run tests related to Bash permissions and settings to ensure no regressions.
`npm run test -- src/tools/BashTool/`

- [ ] **Step 3: Commit**

```bash
git add src/tools/BashTool/BashTool.tsx
git commit -m "feat(bash): wire up bash security level and validation layers"
```
