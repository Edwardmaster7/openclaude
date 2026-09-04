import { PassThrough } from 'node:stream'

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { stripVTControlCharacters as stripAnsi } from 'node:util'

import { createRoot, Text } from '../ink.js'
import { AppStateProvider } from '../state/AppState.js'
import { type AppState, getDefaultAppState } from '../state/AppStateStore.js'
import {
  acquireSharedMutationLock,
  releaseSharedMutationLock,
} from '../test/sharedMutationLock.js'
import { getVisibleAgentTasks, useCoordinatorTaskCount } from './CoordinatorAgentStatus.js'

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

function createTestStreams(): {
  stdout: PassThrough
  stdin: PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => void
    ref: () => void
    unref: () => void
  }
  getOutput: () => string
} {
  let output = ''
  const stdout = new PassThrough()
  const stdin = new PassThrough() as PassThrough & {
    isTTY: boolean
    setRawMode: (mode: boolean) => void
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

async function waitForFrame(
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
  throw new Error(`Timed out waiting for useCoordinatorTaskCount output:\n${frame}`)
}

function Probe(): React.ReactNode {
  const count = useCoordinatorTaskCount()
  return React.createElement(Text, null, `count:${count}`)
}

describe('useCoordinatorTaskCount', () => {
  test('returns the number of visible panel agent tasks, not a hardcoded 0', async () => {
    await acquireSharedMutationLock('components/CoordinatorAgentStatus.test.ts')
    let root: Awaited<ReturnType<typeof createRoot>> | null = null
    try {
      const { stdout, stdin, getOutput } = createTestStreams()
      root = await createRoot({
        stdout: stdout as unknown as NodeJS.WriteStream,
        stdin: stdin as unknown as NodeJS.ReadStream,
        patchConsole: false,
      })

      const tasks = {
        a: agentTask('a', 100),
        b: agentTask('b', 200),
        main: agentTask('main', 300, { agentType: 'main-session' }),
        dismissed: agentTask('dismissed', 400, { evictAfter: 0 }),
      } as unknown as AppState['tasks']

      root.render(
        React.createElement(AppStateProvider, {
          initialState: { ...getDefaultAppState(), tasks },
          children: React.createElement(Probe),
        }),
      )

      const frame = await waitForFrame(getOutput, f => f.includes('count:'))
      expect(frame).toContain('count:2')

      stdin.end()
    } finally {
      root?.unmount()
      releaseSharedMutationLock()
    }
  })
})
