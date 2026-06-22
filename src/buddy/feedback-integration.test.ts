import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mutable mock config — shared across all mocks
let mockConfig: Record<string, any> = {}

// Mock config.js (used by observer, companion, memory, easter-eggs)
mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (fn: (prev: any) => any) => {
    mockConfig = fn(mockConfig)
  },
}))

// Mock messages.js to avoid heavy transitive deps (Anthropic SDK, lodash-es, analytics)
mock.module('../utils/messages.js', () => ({
  getUserMessageText: (message: any) => {
    if (message?.type !== 'user') return null
    const content = message?.message?.content ?? message?.content
    if (!content) return null
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join(' ')
    }
    return null
  },
}))

// Mock memoryScan for skills.ts transitive import
mock.module('../memdir/memoryScan.js', () => ({
  scanMemoryFiles: async () => [],
  formatMemoryManifest: () => '',
}))

// Mock paths for skills.ts transitive import
mock.module('../memdir/paths.js', () => ({
  getAutoMemPath: () => '/tmp/test-auto-mem',
  isAutoMemoryEnabled: () => false,
}))

// Mock feedbackLog
let mockEvents: any[] = []
let loggedEvents: any[] = []

mock.module('../memdir/feedbackLog.js', () => ({
  readFeedbackEvents: async () => mockEvents,
  logFeedbackEvent: async (event: any) => {
    loggedEvents.push(event)
  },
  clearFeedbackLog: async () => {},
  resetFeedbackLog: async () => {},
  getFeedbackLogPath: () => '/tmp/feedback-log.jsonl',
}))

import { fireCompanionObserver, notifyFeedbackConfirm } from './observer.js'
import { call as feedbackCall } from '../commands/feedback/feedback.js'

function getTodayString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

describe('buddy-feedback integration', () => {
  beforeEach(() => {
    mockEvents = []
    loggedEvents = []
    mockConfig = {
      companion: {
        name: 'Pixelbud',
        species: 'duck',
        xp: 10,
        hat: 'none',
        hatchedAt: Date.now(),
        personality: 'happy',
      },
      companionStats: {
        totalBashes: 5,
        totalTasks: 2,
        totalErrors: 0,
        totalPets: 1,
        daysActive: 1,
        totalTokensSaved: 0,
        totalFeedbackRules: 0,
        totalFeedbackConfirms: 0,
      },
      companionLastPetDate: new Date().toISOString().split('T')[0],
      companionStreakCount: 1,
      companionMemory: [],
      companionLastActiveDate: getTodayString(),
    }
  })

  it('feedback detection triggers observer reaction', async () => {
    const reactions: string[] = []
    const mockOnReaction = (r: string | undefined) => {
      if (r) reactions.push(r)
    }

    // Need a tool_result as last message for the feedback branch to trigger
    const messages = [
      {
        type: 'user',
        message: {
          content: [{ type: 'text', text: 'some command output' }],
        },
      },
      {
        type: 'tool_result',
        name: 'Bash',
        content: 'some output from tool',
        is_error: false,
      },
    ] as any[]

    await fireCompanionObserver(messages, mockOnReaction, {
      detected: true,
      type: 'correction',
      message: 'correction detected',
    })

    expect(reactions.length).toBeGreaterThan(0)
    expect(reactions.some(r => r.includes('Pixelbud'))).toBe(true)
  })

  it('notifyFeedbackConfirm grants XP and increments stats', () => {
    const result = notifyFeedbackConfirm('Pixelbud')

    expect(result).toContain('Pixelbud')
    expect(mockConfig.companion.xp).toBe(12) // 10 + 2
    expect(mockConfig.companionStats.totalFeedbackConfirms).toBe(1)
  })

  describe('feedback command refinement', () => {
    const sampleContext = {
      abortController: new AbortController(),
      messages: [
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: 'I am running npm test.' }]
          }
        },
        {
          type: 'user',
          message: {
            content: [{ type: 'text', text: 'use bun test instead' }]
          }
        }
      ]
    } as any

    it('confirm command falls back to listing recent interactions when no pending events exist', async () => {
      const result = await feedbackCall('confirm', sampleContext) as any
      expect(result.type).toBe('text')
      expect(result.value).toContain('Nenhum feedback pendente sugerido automaticamente')
      expect(result.value).toContain('use bun test instead')
      expect(result.value).toContain('I am running npm test.')
    })

    it('approve <index> logs confirmed correction and rewards companion', async () => {
      const result = await feedbackCall('approve 1', sampleContext) as any
      expect(result.type).toBe('text')
      expect(result.value).toContain('Interação [1] aprovada e gravada com sucesso!')
      expect(result.value).toContain('Pixelbud') // Reaction from Buddy

      // Check logged event
      expect(loggedEvents.length).toBe(1)
      expect(loggedEvents[0].type).toBe('correction')
      expect(loggedEvents[0].original).toBe('I am running npm test.')
      expect(loggedEvents[0].correction).toBe('use bun test instead')
      expect(loggedEvents[0].confirmed).toBe(true)

      // Companion earned +2 XP
      expect(mockConfig.companion.xp).toBe(12)
      expect(mockConfig.companionStats.totalFeedbackConfirms).toBe(1)
    })

    it('approve <custom rule> logs custom text rule directly and rewards companion', async () => {
      const result = await feedbackCall('approve utilize bun para rodar testes', sampleContext) as any
      expect(result.type).toBe('text')
      expect(result.value).toContain('Regra personalizada criada e gravada com sucesso')
      expect(result.value).toContain('utilize bun para rodar testes')
      expect(result.value).toContain('Pixelbud')

      // Check logged event
      expect(loggedEvents.length).toBe(1)
      expect(loggedEvents[0].type).toBe('correction')
      expect(loggedEvents[0].correction).toBe('utilize bun para rodar testes')
      expect(loggedEvents[0].confirmed).toBe(true)

      // Companion earned +2 XP
      expect(mockConfig.companion.xp).toBe(12)
    })

    it('reject <index> logs outcome/correction event with success = false', async () => {
      const result = await feedbackCall('reject 1', sampleContext) as any
      expect(result.type).toBe('text')
      expect(result.value).toContain('marcada como indesejada')

      // Check logged event
      expect(loggedEvents.length).toBe(1)
      expect(loggedEvents[0].type).toBe('correction')
      expect(loggedEvents[0].original).toBe('I am running npm test.')
      expect(loggedEvents[0].correction).toBe('use bun test instead')
      expect(loggedEvents[0].success).toBe(false)
      expect(loggedEvents[0].confirmed).toBe(true)

      // No XP is granted for reject
      expect(mockConfig.companion.xp).toBe(10)
    })

    it('help command returns the detailed feedback learning guide', async () => {
      const result = await feedbackCall('help', sampleContext) as any
      expect(result.type).toBe('text')
      expect(result.value).toContain('SISTEMA DE APRENDIZADO DE FEEDBACK')
      expect(result.value).toContain('/feedback approve')
      expect(result.value).toContain('/feedback reject')
    })
  })
})
