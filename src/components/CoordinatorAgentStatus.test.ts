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
