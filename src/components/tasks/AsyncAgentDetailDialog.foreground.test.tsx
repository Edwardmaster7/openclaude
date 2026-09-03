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
