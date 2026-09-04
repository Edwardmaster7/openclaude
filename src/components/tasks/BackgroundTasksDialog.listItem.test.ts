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
