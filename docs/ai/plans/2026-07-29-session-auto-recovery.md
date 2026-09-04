# Session Auto-Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect interrupted sessions caused by computer crashes/power loss and prompt the user to auto-resume on CLI startup.

**Architecture:** Maintain an `active-session.json` state file per project updated during session turns and marked `cleanExit: true` on graceful shutdown. On CLI boot, if `cleanExit: false` and process is inactive, prompt the user to auto-resume.

**Tech Stack:** TypeScript, Bun test framework, Node.js `fs/promises`, React/Ink (REPL CLI).

## Global Constraints
- TypeScript strict mode, ESM imports.
- Bun test runner (`bun test`).
- Project directory path derived via `getSessionProjectDir()` or `getProjectsDir()`.

---

### Task 1: Add `autoResumeOnCrash` Setting Configuration

**Files:**
- Modify: `openclaude/src/utils/settings/types.ts`
- Modify: `openclaude/src/utils/config.ts`
- Test: `openclaude/src/utils/config.test.ts`

**Interfaces:**
- Produces: `GlobalConfig.autoResumeOnCrash?: 'prompt' | 'always' | 'never'`

- [ ] **Step 1: Write failing test for configuration setting**

Edit `openclaude/src/utils/config.test.ts` to add a test for `autoResumeOnCrash` default value and parsing:

```typescript
import { expect, test } from 'bun:test'
import { getConfig } from './config.js'

test('config includes autoResumeOnCrash default value', () => {
  const config = getConfig()
  expect(config.autoResumeOnCrash ?? 'prompt').toBe('prompt')
})
```

- [ ] **Step 2: Run test to verify failure or missing property**

Run: `bun test openclaude/src/utils/config.test.ts`

- [ ] **Step 3: Update `Settings` and `GlobalConfig` interfaces**

In `openclaude/src/utils/settings/types.ts`, add:
```typescript
export type AutoResumeOnCrashOption = 'prompt' | 'always' | 'never'
```
Add `autoResumeOnCrash?: AutoResumeOnCrashOption` to `GlobalConfig` interface.

In `openclaude/src/utils/config.ts`, set default fallback for `autoResumeOnCrash` to `'prompt'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test openclaude/src/utils/config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openclaude/src/utils/settings/types.ts openclaude/src/utils/config.ts openclaude/src/utils/config.test.ts
git commit -m "feat: add autoResumeOnCrash setting configuration"
```

---

### Task 2: Implement Active Session Lock State Manager (`sessionLock.ts`)

**Files:**
- Create: `openclaude/src/utils/sessionLock.ts`
- Test: `openclaude/src/utils/sessionLock.test.ts`

**Interfaces:**
- Produces:
  - `saveActiveSessionLock(sessionId: string, projectDir: string): Promise<void>`
  - `updateSessionLockTimestamp(projectDir: string): Promise<void>`
  - `markCleanExit(projectDir: string): Promise<void>`
  - `getActiveSessionLock(projectDir: string): Promise<ActiveSessionState | null>`

- [ ] **Step 1: Write failing unit test for `sessionLock.ts`**

Create `openclaude/src/utils/sessionLock.test.ts`:

```typescript
import { expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import {
  saveActiveSessionLock,
  markCleanExit,
  getActiveSessionLock,
} from './sessionLock.js'

const TEST_DIR = join(import.meta.dirname, '../../test-tmp-session-lock')

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

test('creates active session lock file with cleanExit false', async () => {
  await saveActiveSessionLock('test-session-123', TEST_DIR)
  const lock = await getActiveSessionLock(TEST_DIR)
  expect(lock).not.toBeNull()
  expect(lock?.sessionId).toBe('test-session-123')
  expect(lock?.cleanExit).toBe(false)
})

test('marks clean exit on shutdown', async () => {
  await saveActiveSessionLock('test-session-123', TEST_DIR)
  await markCleanExit(TEST_DIR)
  const lock = await getActiveSessionLock(TEST_DIR)
  expect(lock?.cleanExit).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test openclaude/src/utils/sessionLock.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `sessionLock.ts`**

Create `openclaude/src/utils/sessionLock.ts`:

```typescript
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'

export interface ActiveSessionState {
  sessionId: string
  startedAt: number
  lastUpdatedAt: number
  pid: number
  cleanExit: boolean
}

function getLockFilePath(projectDir: string): string {
  return join(projectDir, 'active-session.json')
}

export async function saveActiveSessionLock(
  sessionId: string,
  projectDir: string,
): Promise<void> {
  await mkdir(projectDir, { recursive: true })
  const state: ActiveSessionState = {
    sessionId,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    pid: process.pid,
    cleanExit: false,
  }
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function updateSessionLockTimestamp(projectDir: string): Promise<void> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return
  state.lastUpdatedAt = Date.now()
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function markCleanExit(projectDir: string): Promise<void> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return
  state.cleanExit = true
  await writeFile(getLockFilePath(projectDir), JSON.stringify(state, null, 2), 'utf-8')
}

export async function getActiveSessionLock(
  projectDir: string,
): Promise<ActiveSessionState | null> {
  try {
    const data = await readFile(getLockFilePath(projectDir), 'utf-8')
    return JSON.parse(data) as ActiveSessionState
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test openclaude/src/utils/sessionLock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openclaude/src/utils/sessionLock.ts openclaude/src/utils/sessionLock.test.ts
git commit -m "feat: add active session lock state manager"
```

---

### Task 3: Implement Startup Session Recovery Evaluator (`sessionRecoveryCheck.ts`)

**Files:**
- Create: `openclaude/src/utils/sessionRecoveryCheck.ts`
- Test: `openclaude/src/utils/sessionRecoveryCheck.test.ts`

**Interfaces:**
- Consumes: `getActiveSessionLock` from Task 2
- Produces: `checkCrashRecoveryCandidate(projectDir: string): Promise<ActiveSessionState | null>`

- [ ] **Step 1: Write failing unit test for `sessionRecoveryCheck.ts`**

Create `openclaude/src/utils/sessionRecoveryCheck.test.ts`:

```typescript
import { expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { checkCrashRecoveryCandidate } from './sessionRecoveryCheck.js'

const TEST_DIR = join(import.meta.dirname, '../../test-tmp-recovery-check')

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true })
})

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true })
})

test('returns null if cleanExit is true', async () => {
  await writeFile(
    join(TEST_DIR, 'active-session.json'),
    JSON.stringify({
      sessionId: 'sess-1',
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      pid: 999999,
      cleanExit: true,
    }),
  )
  const candidate = await checkCrashRecoveryCandidate(TEST_DIR)
  expect(candidate).toBeNull()
})

test('returns candidate if cleanExit is false and pid is not running', async () => {
  await writeFile(
    join(TEST_DIR, 'active-session.json'),
    JSON.stringify({
      sessionId: 'sess-crash',
      startedAt: Date.now() - 10000,
      lastUpdatedAt: Date.now() - 5000,
      pid: 999999, // Unlikely PID
      cleanExit: false,
    }),
  )
  const candidate = await checkCrashRecoveryCandidate(TEST_DIR)
  expect(candidate).not.toBeNull()
  expect(candidate?.sessionId).toBe('sess-crash')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test openclaude/src/utils/sessionRecoveryCheck.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `sessionRecoveryCheck.ts`**

Create `openclaude/src/utils/sessionRecoveryCheck.ts`:

```typescript
import { getActiveSessionLock, type ActiveSessionState } from './sessionLock.js'

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function checkCrashRecoveryCandidate(
  projectDir: string,
): Promise<ActiveSessionState | null> {
  const state = await getActiveSessionLock(projectDir)
  if (!state) return null
  if (state.cleanExit) return null

  // If same process PID or process is still running, it's not a crashed session
  if (state.pid === process.pid || isPidRunning(state.pid)) {
    return null
  }

  // Ignore sessions older than 7 days
  if (Date.now() - state.lastUpdatedAt > SEVEN_DAYS_MS) {
    return null
  }

  return state
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test openclaude/src/utils/sessionRecoveryCheck.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openclaude/src/utils/sessionRecoveryCheck.ts openclaude/src/utils/sessionRecoveryCheck.test.ts
git commit -m "feat: add crash recovery candidate evaluator"
```

---

### Task 4: Wire Session Lock Hooks and Startup Auto-Resume Prompt

**Files:**
- Modify: `openclaude/src/bootstrap/state.ts` / `openclaude/src/utils/sessionStorage.ts`
- Modify: `openclaude/src/utils/gracefulShutdown.ts`
- Modify: `openclaude/src/screens/REPL.tsx` or `openclaude/src/entrypoints/cli.tsx`

**Interfaces:**
- Integrates session lock creation on session start, timestamp updates on message logging, cleanExit on shutdown, and recovery prompt on REPL boot.

- [ ] **Step 1: Register session lock lifecycle calls**

In `openclaude/src/utils/sessionStorage.ts`:
- Call `saveActiveSessionLock(sessionId, projectDir)` inside `initSession()` / `switchSession()`.
- Call `updateSessionLockTimestamp(projectDir)` inside `appendMessageToSessionLog()`.

In `openclaude/src/utils/gracefulShutdown.ts`:
- Register `markCleanExit(projectDir)` inside `registerCleanup` / shutdown handlers.

- [ ] **Step 2: Add startup recovery prompt in REPL boot**

Before REPL input prompt renders, if `autoResumeOnCrash` is `"prompt"` or `"always"`:
- Check `checkCrashRecoveryCandidate(projectDir)`.
- If candidate exists and config is `"prompt"`:
  - Ask user: `"Voltar para a sessão interrompida (ID: ${sessionId})? (Sim / Não) [S/n]"`
  - If Yes: trigger `resumeConversation(candidate.sessionId)`.
  - If No: mark clean exit to dismiss recovery prompt and proceed with new session.
- If config is `"always"`:
  - Auto-resume `candidate.sessionId` directly.

- [ ] **Step 3: Run full build and smoke test**

Run:
```bash
bun run build
bun run check
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add openclaude/src/
git commit -m "feat: wire session lock lifecycle and startup auto-resume prompt"
```
