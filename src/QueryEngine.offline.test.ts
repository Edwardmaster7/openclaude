import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { QueryEngine } from './QueryEngine.js'
import { setOfflineMode } from 'src/services/api/offlineState.js'
import type { CanUseToolFn } from './hooks/useCanUseTool.js'

describe('QueryEngine Offline Mode', () => {
  beforeAll(() => {
    setOfflineMode(true)
    // Setup global MACRO properties required by prompts
    ;(globalThis as any).MACRO = {
      VERSION: 'test-version',
      BUILD_TIME: 'test-time',
      ISSUES_EXPLAINER: 'test-issues-explainer',
    } as any
  })

  afterAll(() => {
    setOfflineMode(false)
    delete (globalThis as any).MACRO
  })

  test('QueryEngine submitMessage yields offline warning and result', async () => {
    const mockCanUseTool: CanUseToolFn = async () => ({ behavior: 'allow' })
    const engine = new QueryEngine({
      cwd: process.cwd(),
      tools: [],
      commands: [],
      mcpClients: [],
      agents: [],
      canUseTool: mockCanUseTool,
      getAppState: () => ({
        toolPermissionContext: {
          additionalWorkingDirectories: new Map(),
          mode: 'default',
        },
        sessionHooks: new Map(),
        mcp: { tools: [], clients: [] },
      } as any),
      setAppState: () => {},
      readFileCache: new Map() as any,
      query: (async function* () {}) as any,
    })

    const messages: any[] = []
    for await (const msg of engine.submitMessage('hello')) {
      messages.push(msg)
    }

    expect(messages.length).toBe(2)
    expect(messages[0].type).toBe('assistant')
    expect(messages[0].message.content).toContain('You are currently offline')
    expect(messages[1].type).toBe('result')
    expect(messages[1].subtype).toBe('success')
    expect(messages[1].stop_reason).toBe('offline')
  })
})
