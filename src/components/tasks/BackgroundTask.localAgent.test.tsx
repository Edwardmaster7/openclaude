import { PassThrough } from 'node:stream'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'
import stripAnsi from 'strip-ansi'

import { createRoot } from '../../ink.js'
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask.js'
import { BackgroundTask } from './BackgroundTask.js'

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
  throw new Error(`Timed out waiting for BackgroundTask output:\n${frame}`)
}

function localAgentTask(
  overrides: Partial<LocalAgentTaskState> = {},
): LocalAgentTaskState {
  return {
    id: 'agent-1',
    type: 'local_agent',
    agentId: 'agent-1',
    agentType: 'general-purpose',
    description: 'Find formatDuration definition',
    prompt: 'Find where formatDuration is defined',
    status: 'completed',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    pendingMessages: [],
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    retain: false,
    diskLoaded: false,
    notified: true,
    ...overrides,
  } as unknown as LocalAgentTaskState
}

// BackgroundTask doesn't read AppState/keybindings for the local_agent case
// (it's a pure props -> Text renderer), so it renders standalone without
// AppStateProvider/KeybindingSetup and without the shared mutation lock.
describe('BackgroundTask local_agent row', () => {
  let root: Awaited<ReturnType<typeof createRoot>> | null = null
  let stdin: ReturnType<typeof createTestStreams>['stdin'] | null = null

  beforeEach(() => {
    root = null
    stdin = null
  })

  afterEach(async () => {
    root?.unmount()
    stdin?.end()
    await Bun.sleep(0)
  })

  test('appends the model display name after the status when the task has a model', async () => {
    const streams = createTestStreams()
    stdin = streams.stdin
    root = await createRoot({
      stdout: streams.stdout as unknown as NodeJS.WriteStream,
      stdin: streams.stdin as unknown as NodeJS.ReadStream,
      patchConsole: false,
    })

    root.render(
      <BackgroundTask
        task={localAgentTask({ model: 'claude-haiku-4-5-20251001' })}
      />,
    )

    const frame = await waitForOutput(streams.getOutput, f =>
      f.includes('Find formatDuration definition'),
    )
    expect(frame).toContain('· Haiku 4.5')
    // Model comes after the status, not between description and status.
    expect(frame).toContain('(done) · Haiku 4.5')
  })

  test('does not render a model separator when the task has no model', async () => {
    const streams = createTestStreams()
    stdin = streams.stdin
    root = await createRoot({
      stdout: streams.stdout as unknown as NodeJS.WriteStream,
      stdin: streams.stdin as unknown as NodeJS.ReadStream,
      patchConsole: false,
    })

    root.render(<BackgroundTask task={localAgentTask({ model: undefined })} />)

    const frame = await waitForOutput(streams.getOutput, f =>
      f.includes('Find formatDuration definition'),
    )
    expect(frame).not.toContain('·')
  })
})
