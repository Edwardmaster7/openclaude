# Subagent Panel and Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make openclaude's existing subagent chat-and-messaging feature reachable and visually identical to Claude Code v2.1.259.

**Architecture:** Nearly the whole feature already exists in this repo (decompiled Claude Code source) but is unreachable because `CoordinatorTaskPanel` is never rendered. Task 1 mounts it, which unlocks transcript viewing and message routing that already work. Tasks 2-4 close three cosmetic/affordance gaps found by comparing against the live v2.1.259 TUI.

**Tech Stack:** TypeScript, React (react-compiler output in some components), Ink TUI, `bun:test`.

**Spec:** `docs/ai/specs/2026-09-03-subagent-panel-and-messaging-design.md`

## Global Constraints

- Test runner is `bun test`. Run a single file with `bun test <path>`.
- Component tests render through `createRoot` from `src/ink.js`, wrapped in
  `<AppStateProvider>` and `<KeybindingSetup>`, asserting on `stripAnsi`-cleaned
  frames. Follow `src/components/agents/AgentDetailDialog.test.tsx` exactly.
- Any test that renders must take the shared mutation lock in `beforeEach`
  (`acquireSharedMutationLock`) and release it in `afterEach`.
- Do **not** add feature gates. This feature ships on by default.
- Do **not** touch `viewSelectionMode: 'selecting-agent'`, `useBackgroundTaskNavigation`,
  `Spinner`/`TeammateSpinnerTree`, or in-process teammate code. Out of scope.
- `src/components/tasks/AsyncAgentDetailDialog.tsx` is react-compiler output with a
  manual memo cache (`_c(54)`). When adding dependencies, **grow the cache and use
  new slot indices at the end** — never renumber existing slots.
- Full pre-push contract lives in `CONTRIBUTING.md § Validation`; run it before pushing.

---

### Task 1: Mount the agent panel

This is the unlock. Everything else in the feature already works and becomes
reachable the moment this component renders.

**Files:**
- Modify: `src/components/PromptInput/PromptInput.tsx:102` (import), and the line
  immediately after the `<PromptInputFooter … />` element at `:2350`
- Test: `src/components/CoordinatorAgentStatus.test.ts` (create)

**Interfaces:**
- Consumes: `CoordinatorTaskPanel` and `getVisibleAgentTasks` from
  `src/components/CoordinatorAgentStatus.js`
- Produces: nothing new; makes existing behaviour reachable.

**Placement matters.** In Claude Code the panel sits *below* the footer, separated
by one blank line (the component's own `marginTop={1}`), not above the input:

```
  ⏵⏵ don't ask on (shift+tab to cycle) · ← 1 agent · ↓ to manage    ← PromptInputFooter
                                                                    ← marginTop={1}
  ◯ main                                                            ← CoordinatorTaskPanel
  ⏺ Explore  Find formatDuration definition      19s · ↓ 23.1k tokens
```

- [ ] **Step 1: Write a regression guard for the panel's task filter**

`getVisibleAgentTasks` is pure and currently untested. This test does **not** go
red first — the function already behaves correctly. It is a characterization test
that locks the filter/sort contract before we make the panel user-visible. Do not
fake a red phase here; the real verification for this task is Step 5.

Create `src/components/CoordinatorAgentStatus.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import type { AppState } from '../state/AppStateStore.js'
import { getVisibleAgentTasks } from './CoordinatorAgentStatus.js'

function agentTask(
  id: string,
  startTime: number,
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    id,
    type: 'local_agent',
    agentType: 'general-purpose',
    status: 'running',
    startTime,
    pendingMessages: [],
    ...overrides,
  }
}

describe('getVisibleAgentTasks', () => {
  test('returns panel agents sorted by start time', () => {
    const tasks = {
      b: agentTask('b', 200),
      a: agentTask('a', 100),
    } as unknown as AppState['tasks']

    expect(getVisibleAgentTasks(tasks).map(t => t.id)).toEqual(['a', 'b'])
  })

  test('excludes the main session and dismissed agents', () => {
    const tasks = {
      main: agentTask('main', 100, { agentType: 'main-session' }),
      dismissed: agentTask('dismissed', 200, { evictAfter: 0 }),
      visible: agentTask('visible', 300),
    } as unknown as AppState['tasks']

    expect(getVisibleAgentTasks(tasks).map(t => t.id)).toEqual(['visible'])
  })
})
```

- [ ] **Step 2: Run the test**

Run: `bun test src/components/CoordinatorAgentStatus.test.ts`
Expected: PASS (2 tests). If it fails, the filter contract differs from the spec —
stop and report before changing production code.

- [ ] **Step 3: Import the panel**

In `src/components/PromptInput/PromptInput.tsx`, extend the existing import at
line 102 — do not add a second import statement from the same module:

```ts
import { CoordinatorTaskPanel, getVisibleAgentTasks, useCoordinatorTaskCount } from '../CoordinatorAgentStatus.js';
```

- [ ] **Step 4: Render the panel below the footer**

In the same file, find the `<PromptInputFooter … />` element (a single long line
at `:2350`). Insert the panel on the line immediately after that element's
closing `/>`, as a sibling inside the same `<Box flexDirection="column">`:

```tsx
      <CoordinatorTaskPanel />
```

Add nothing else — no wrapper `<Box>`, no conditional. The component already
returns `null` when there are no visible agents, and carries its own `marginTop={1}`.

- [ ] **Step 5: Verify in the running app**

This is the real verification for this task; there is no unit test for JSX placement.

```bash
bun run build
```

Then start the app and drive it:

1. Run `node bin/openclaude` in a repo checkout.
2. Send a prompt that spawns a background subagent, e.g.
   `Use the Explore subagent to find where formatDuration is defined.`
3. While it runs, confirm a panel appears **below** the footer showing
   `◯ main` and a row like
   `◯ Explore  <description>   6s · ↑ 50 tokens`, and that the footer reads `↓ to manage`.
4. Press `↓`, then `↓` again to select the agent row, then `Enter`.
5. Confirm the main transcript is replaced by the agent's transcript, the input
   border shows the agent's name/description, and the placeholder reads
   `Message @<agent>…`.
6. Type a message and press Enter. Confirm it is echoed into the agent's
   transcript immediately.
7. Press `↓`, `↑` to select `main`, `Enter` to return to the leader.

If step 3 shows no panel, stop: the mount is wrong. If steps 4-6 fail, stop and
report — that would mean a second gap exists beyond this plan's scope.

- [ ] **Step 6: Typecheck and commit**

```bash
bun run typecheck
git add src/components/CoordinatorAgentStatus.test.ts src/components/PromptInput/PromptInput.tsx
git commit -m "feat(agents): mount the coordinator task panel so subagents are selectable"
```

---

### Task 2: Route from /tasks into the agent view with `f`

In Claude Code, a running `local_agent` in `/tasks` offers `f to foreground`,
which enters the inline agent view. `in_process_teammate` already has this in our
repo (`BackgroundTasksDialog.tsx:385`); `local_agent` does not.

**Files:**
- Modify: `src/components/tasks/AsyncAgentDetailDialog.tsx`
- Modify: `src/components/tasks/BackgroundTasksDialog.tsx:380`
- Test: `src/components/tasks/AsyncAgentDetailDialog.foreground.test.tsx` (create)

**Interfaces:**
- Consumes: `enterTeammateView(taskId, setAppState)` from `src/state/teammateViewHelpers.js`
- Produces: `AsyncAgentDetailDialog` gains an optional prop
  `onForeground?: () => void`. When set, the dialog renders a
  `f` / `foreground` hint and invokes the callback on the `f` key.

Target footer, copied from the live v2.1.259 dialog:

```
← to go back · Esc/Enter/Space to close · x to stop · f to foreground
```

- [ ] **Step 1: Write the failing test**

Create `src/components/tasks/AsyncAgentDetailDialog.foreground.test.tsx`:

```tsx
import { PassThrough } from 'node:stream'

import { afterEach, beforeEach, expect, test } from 'bun:test'
import React from 'react'
import stripAnsi from 'strip-ansi'

import { createRoot } from '../../ink.js'
import { KeybindingSetup } from '../../keybindings/KeybindingProviderSetup.js'
import { AppStateProvider } from '../../state/AppState.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../../test/sharedMutationLock.js'
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import { AsyncAgentDetailDialog } from './AsyncAgentDetailDialog.js'

const SYNC_START = '\x1B[?2026h'
const SYNC_END = '\x1B[?2026l'

function extractLastFrame(output: string): string {
  let lastFrame: string | null = null
  let cursor = 0
  while (cursor < output.length) {
    const start = output.indexOf(SYNC_START, cursor)
    if (start === -1) break
    const contentStart = start + SYNC_START.length
    const end = output.indexOf(SYNC_END, contentStart)
    if (end === -1) break
    const frame = output.slice(contentStart, end)
    if (frame.trim().length > 0) lastFrame = frame
    cursor = end + SYNC_END.length
  }
  return lastFrame ?? output
}

function createTestStreams() {
  let output = ''
  const stdout = new PassThrough()
  const stdin = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: () => void
    ref: () => void
    unref: () => void
  }
  stdin.isTTY = true
  stdin.setRawMode = () => {}
  stdin.ref = () => {}
  stdin.unref = () => {}
  ;(stdout as unknown as { columns: number }).columns = 120
  stdout.on('data', chunk => {
    output += chunk.toString()
  })
  return { stdout, stdin, getOutput: () => output }
}

async function waitForOutput(
  getOutput: () => string,
  predicate: (frame: string) => boolean,
): Promise<string> {
  const startedAt = Date.now()
  let frame = ''
  while (Date.now() - startedAt < 2500) {
    frame = stripAnsi(extractLastFrame(getOutput()))
    if (predicate(frame)) return frame
    await Bun.sleep(10)
  }
  throw new Error(`Timed out waiting for async agent detail output:\n${frame}`)
}

function runningAgent(): LocalAgentTaskState {
  return {
    id: 'agent-1',
    type: 'local_agent',
    agentId: 'agent-1',
    agentType: 'general-purpose',
    description: 'Find formatDuration definition',
    prompt: 'Find where formatDuration is defined',
    status: 'running',
    startTime: Date.now() - 5000,
    pendingMessages: [],
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    retain: false,
    diskLoaded: false,
  } as unknown as LocalAgentTaskState
}

beforeEach(async () => {
  await acquireSharedMutationLock(
    'components/tasks/AsyncAgentDetailDialog.foreground.test.tsx',
  )
})

afterEach(() => {
  releaseSharedMutationLock()
})

test('offers f to foreground and fires the callback on f', async () => {
  const { stdout, stdin, getOutput } = createTestStreams()
  const root = await createRoot({
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    patchConsole: false,
  })
  let foregroundCalls = 0

  try {
    root.render(
      <AppStateProvider>
        <KeybindingSetup>
          <AsyncAgentDetailDialog
            agent={runningAgent()}
            onDone={() => {}}
            onForeground={() => {
              foregroundCalls += 1
            }}
          />
        </KeybindingSetup>
      </AppStateProvider>,
    )

    const frame = await waitForOutput(getOutput, f => f.includes('foreground'))
    expect(frame).toContain('foreground')

    stdin.write('f')
    await Bun.sleep(150)
    expect(foregroundCalls).toBe(1)
  } finally {
    root.unmount()
    stdin.end()
    stdout.end()
    await Bun.sleep(0)
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/tasks/AsyncAgentDetailDialog.foreground.test.tsx`
Expected: FAIL — the timeout error from `waitForOutput`, because the dialog
renders no `foreground` hint today.

- [ ] **Step 3: Add the prop and grow the memo cache**

In `src/components/tasks/AsyncAgentDetailDialog.tsx`:

Add the prop to the `Props` type:

```ts
type Props = {
  agent: DeepImmutable<LocalAgentTaskState>;
  onDone: () => void;
  onKillAgent?: () => void;
  onBack?: () => void;
  onForeground?: () => void;
};
```

Grow the memo cache and destructure the new prop:

```ts
  const $ = _c(56);
  const {
    agent,
    onDone,
    onKillAgent,
    onBack,
    onForeground
  } = t0;
```

- [ ] **Step 4: Handle the `f` key**

Replace the `handleKeyDown` memo block (the `t4` block, around `:63-89`) so the
guard also tracks `onForeground` using **new slot 54**, leaving every existing
index untouched:

```ts
  let t4;
  if ($[4] !== agent.status || $[5] !== onBack || $[6] !== onDone || $[7] !== onKillAgent || $[54] !== onForeground) {
    t4 = e => {
      if (e.key === " ") {
        e.preventDefault();
        onDone();
      } else {
        if (e.key === "left" && onBack) {
          e.preventDefault();
          onBack();
        } else {
          if (e.key === "f" && onForeground) {
            e.preventDefault();
            onForeground();
          } else {
            if (e.key === "x" && agent.status === "running" && onKillAgent) {
              e.preventDefault();
              onKillAgent();
            }
          }
        }
      }
    };
    $[4] = agent.status;
    $[5] = onBack;
    $[6] = onDone;
    $[7] = onKillAgent;
    $[54] = onForeground;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  const handleKeyDown = t4;
```

- [ ] **Step 5: Add the footer hint**

Replace the input-guide memo block (the `t14` block, around `:158-167`) so it
tracks `onForeground` in **new slot 55** and renders the hint last, matching
Claude Code's order:

```ts
  let t14;
  if ($[27] !== agent.status || $[28] !== onBack || $[29] !== onKillAgent || $[55] !== onForeground) {
    t14 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>{onBack && <KeyboardShortcutHint shortcut={"←"} action="go back" />}<KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />{agent.status === "running" && onKillAgent && <KeyboardShortcutHint shortcut="x" action="stop" />}{agent.status === "running" && onForeground && <KeyboardShortcutHint shortcut="f" action="foreground" />}</Byline>;
    $[27] = agent.status;
    $[28] = onBack;
    $[29] = onKillAgent;
    $[55] = onForeground;
    $[30] = t14;
  } else {
    t14 = $[30];
  }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `bun test src/components/tasks/AsyncAgentDetailDialog.foreground.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 7: Wire the caller**

In `src/components/tasks/BackgroundTasksDialog.tsx`, replace the `local_agent`
case at `:380` so it passes `onForeground`, mirroring the `in_process_teammate`
case directly below it:

```tsx
      case 'local_agent':
        return <AsyncAgentDetailDialog agent={task_0} onDone={onDone} onKillAgent={() => void killAgentTask(task_0.id)} onBack={goBackToList} onForeground={task_0.status === 'running' ? () => {
          enterTeammateView(task_0.id, setAppState);
          onDone('Viewing agent', {
            display: 'system'
          });
        } : undefined} key={`agent-${task_0.id}`} />;
```

`enterTeammateView` and `setAppState` are already imported and in scope in this file.

- [ ] **Step 8: Typecheck, test, commit**

```bash
bun run typecheck
bun test src/components/tasks/
git add src/components/tasks/AsyncAgentDetailDialog.tsx src/components/tasks/AsyncAgentDetailDialog.foreground.test.tsx src/components/tasks/BackgroundTasksDialog.tsx
git commit -m "feat(agents): add f to foreground from the /tasks subagent detail"
```

---

### Task 3: Show the model on the /tasks subagent row

Claude Code v2.1.259 renders `Find formatDuration definition (done) · Haiku 4.5`.
Our row label is only `task.description`.

**Files:**
- Modify: `src/components/tasks/BackgroundTasksDialog.tsx:493` (export `toListItem`) and `:511-517`
- Test: `src/components/tasks/BackgroundTasksDialog.listItem.test.ts` (create)

**Interfaces:**
- Consumes: `getPublicModelDisplayName(model: ModelName): string | null` from
  `src/utils/model/model.js` — returns short names such as `'Haiku 4.5'`.
- Produces: `toListItem(task: BackgroundTaskState): ListItem` becomes exported.

- [ ] **Step 1: Write the failing test**

Create `src/components/tasks/BackgroundTasksDialog.listItem.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { toListItem } from './BackgroundTasksDialog.js'

function agentTask(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'agent-1',
    type: 'local_agent',
    agentType: 'general-purpose',
    description: 'Find formatDuration definition',
    status: 'completed',
    startTime: Date.now(),
    pendingMessages: [],
    ...overrides,
  }
}

describe('toListItem for local_agent', () => {
  test('appends the model display name when the task has a model', () => {
    const item = toListItem(
      agentTask({ model: 'claude-haiku-4-5-20251001' }) as never,
    )

    expect(item.label).toBe('Find formatDuration definition · Haiku 4.5')
  })

  test('leaves the label alone when the task has no model', () => {
    const item = toListItem(agentTask() as never)

    expect(item.label).toBe('Find formatDuration definition')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/components/tasks/BackgroundTasksDialog.listItem.test.ts`
Expected: FAIL — `toListItem` is not exported, so the import throws.

- [ ] **Step 3: Export the mapper and append the model**

In `src/components/tasks/BackgroundTasksDialog.tsx`, export the function at `:493`:

```ts
export function toListItem(task: BackgroundTaskState): ListItem {
```

Add the import near the other `src/utils` imports at the top of the file:

```ts
import { getPublicModelDisplayName } from '../../utils/model/model.js';
```

Replace the `local_agent` case at `:511-517`:

```ts
    case 'local_agent': {
      const modelName = task.model ? getPublicModelDisplayName(task.model) : null;
      return {
        id: task.id,
        type: 'local_agent',
        label: modelName ? `${task.description} · ${modelName}` : task.description,
        status: task.status,
        task
      };
    }
```

If `getPublicModelDisplayName` returns `null` for an unrecognised model id, the
label falls back to the bare description — that is the intended behaviour and the
second test covers the no-model half of it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/components/tasks/BackgroundTasksDialog.listItem.test.ts`
Expected: PASS (2 tests).

`getPublicModelDisplayName` (`src/utils/model/model.ts:651-758`) has two return
paths: a map at `:682-686` that yields the long form `'Claude Haiku 4.5'`, and a
switch at `:740-757` that yields the short form `'Haiku 4.5'`. Which one fires
depends on how the model id normalises. Claude Code's `/tasks` row shows the
**short** form, so if the first test fails, print the actual value:

- Short form returned → the test expectation is right; the failure is elsewhere.
- Long form returned → strip the leading `'Claude '` in `toListItem` rather than
  changing the expectation, so the row keeps matching Claude Code.

- [ ] **Step 5: Typecheck and commit**

```bash
bun run typecheck
git add src/components/tasks/BackgroundTasksDialog.tsx src/components/tasks/BackgroundTasksDialog.listItem.test.ts
git commit -m "feat(agents): show the subagent model on the /tasks row"
```

---

### Task 4: Move the stop/clear hint out of the agent row

Our `AgentLine` appends `· x to stop` / `· x to clear` inside the row text.
Claude Code keeps the row clean and puts `Enter to view · x to stop` in the
footer. This task removes the inline hint; the footer half is already provided by
the selection footer that appears when the panel has focus.

This is the lowest-value task in the plan. If Task 1's manual verification shows
our footer already carries the hint, do this; if our build shows no selection
footer at all, stop and report rather than inventing one.

**Files:**
- Modify: `src/components/CoordinatorAgentStatus.tsx` (the `hintPart` / `suffixPart` lines)
- Test: `src/components/CoordinatorAgentStatus.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AgentLine` row text no longer contains `x to stop` / `x to clear`.

- [ ] **Step 1: Confirm the footer already carries the hint**

Re-run Task 1 Step 5's manual verification. With an agent row selected, read the
footer. Proceed only if it shows a stop/clear hint. Record what it says.

- [ ] **Step 2: Write the failing test**

Append to `src/components/CoordinatorAgentStatus.test.ts`. `buildAgentRowSuffix`
does not exist yet — Step 3 extracts it, which is what makes the row text testable
without rendering Ink:

```ts
import { buildAgentRowSuffix } from './CoordinatorAgentStatus.js'

describe('buildAgentRowSuffix', () => {
  test('keeps elapsed, tokens and queued count', () => {
    const suffix = buildAgentRowSuffix({
      isRunning: true,
      elapsed: '19s',
      tokenCount: 23_100,
      hasActivity: true,
      queuedCount: 2,
    })

    expect(suffix).toContain('19s')
    expect(suffix).toContain('23.1k tokens')
    expect(suffix).toContain('2 queued')
  })

  test('never contains the stop or clear hint', () => {
    const running = buildAgentRowSuffix({
      isRunning: true,
      elapsed: '19s',
      tokenCount: 0,
      hasActivity: false,
      queuedCount: 0,
    })
    const terminal = buildAgentRowSuffix({
      isRunning: false,
      elapsed: '19s',
      tokenCount: 0,
      hasActivity: false,
      queuedCount: 0,
    })

    expect(running).not.toContain('x to')
    expect(terminal).not.toContain('x to')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src/components/CoordinatorAgentStatus.test.ts`
Expected: FAIL — `buildAgentRowSuffix` is not exported.

- [ ] **Step 4: Extract the suffix builder without the hint**

In `src/components/CoordinatorAgentStatus.tsx`, add above `AgentLine`:

```tsx
export function buildAgentRowSuffix({
  isRunning,
  elapsed,
  tokenCount,
  hasActivity,
  queuedCount
}: {
  isRunning: boolean;
  elapsed: string;
  tokenCount: number | undefined;
  hasActivity: boolean;
  queuedCount: number;
}): string {
  const arrow = hasActivity ? figures.arrowDown : figures.arrowUp;
  const tokenText = tokenCount !== undefined && tokenCount > 0 ? ` · ${arrow} ${formatNumber(tokenCount)} tokens` : "";
  const queuedText = queuedCount > 0 ? ` · ${queuedCount} queued` : "";
  const sep = isRunning ? PLAY_ICON : PAUSE_ICON;
  return ` ${sep} ${elapsed}${tokenText}${queuedText}`;
}
```

Then in `AgentLine`, delete the `hintPart` constant entirely and replace the
`tokenText` / `queuedText` / `sep` / `suffixPart` locals with a single call:

```tsx
  const suffixPart = buildAgentRowSuffix({
    isRunning,
    elapsed,
    tokenCount,
    hasActivity: lastActivity !== undefined,
    queuedCount: task.pendingMessages.length
  });
```

`isSelected` stays in use for `prefix`; if the compiler-style memo guards
referenced `hintPart`, drop those references. Keep `availableForDesc` computing
from the new `suffixPart`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src/components/CoordinatorAgentStatus.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Verify the row visually**

```bash
bun run build
```

Repeat Task 1 Step 5's manual verification. Confirm the selected agent row shows
only description, elapsed, tokens and any queued count — no `x to stop` inside
the row — and that the footer still tells the user how to stop it.

- [ ] **Step 7: Typecheck and commit**

```bash
bun run typecheck
git add src/components/CoordinatorAgentStatus.tsx src/components/CoordinatorAgentStatus.test.ts
git commit -m "refactor(agents): move the stop hint out of the agent row text"
```

---

## Final verification

- [ ] Run the full pre-push contract from `CONTRIBUTING.md § Validation`.
- [ ] Rebuild the knowledge graph with `.claude/rebuild-graph.sh` (never
      `graphify update .` — it hangs on this repo).
- [ ] Side-by-side check against Claude Code: spawn a subagent in both, compare
      the panel rows, the agent view, the `/tasks` detail footer, and sending a
      message to a running agent.
