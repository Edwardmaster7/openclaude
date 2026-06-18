import { describe, expect, test, mock, beforeEach } from 'bun:test'

// Mock config before importing module under test
let mockConfig: Record<string, any> = {}

mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (fn: (prev: any) => any) => {
    mockConfig = fn(mockConfig)
  },
}))

import { getUnlockedAchievements, checkAndGrantAchievementXp } from './achievements.js'

describe('Feedback Achievements', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'TestBuddy',
        hat: 'none',
        xp: 50,
        hatchedAt: Date.now(),
      },
      companionStats: {
        totalBashes: 10,
        totalTasks: 5,
        totalErrors: 1,
        totalPets: 3,
        daysActive: 5,
        totalFeedbackRules: 0,
        totalFeedbackConfirms: 0,
      },
      companionMemory: [],
      companionOutfits: [],
      companionStreakCount: 0,
    }
  })

  test('no feedback achievements unlock at 0 confirms', () => {
    const achievements = getUnlockedAchievements()
    const feedbackAchievements = achievements.filter(a => a.id.startsWith('feedback-'))
    expect(feedbackAchievements).toHaveLength(0)
  })

  test('feedback-aprendiz unlocks at 5 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 5
    const achievements = getUnlockedAchievements()
    const aprendiz = achievements.find(a => a.id === 'feedback-aprendiz')
    expect(aprendiz).toBeDefined()
    expect(aprendiz!.name).toBe('Aprendiz')
  })

  test('feedback-aprendiz locked at 4 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 4
    const achievements = getUnlockedAchievements()
    const aprendiz = achievements.find(a => a.id === 'feedback-aprendiz')
    expect(aprendiz).toBeUndefined()
  })

  test('feedback-mestre unlocks at 15 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 15
    const achievements = getUnlockedAchievements()
    const mestre = achievements.find(a => a.id === 'feedback-mestre')
    expect(mestre).toBeDefined()
    expect(mestre!.name).toBe('Mestre')
  })

  test('feedback-mestre locked at 14 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 14
    const achievements = getUnlockedAchievements()
    const mestre = achievements.find(a => a.id === 'feedback-mestre')
    expect(mestre).toBeUndefined()
  })

  test('feedback-sabio unlocks at 30 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 30
    const achievements = getUnlockedAchievements()
    const sabio = achievements.find(a => a.id === 'feedback-sabio')
    expect(sabio).toBeDefined()
    expect(sabio!.name).toBe('Sabio')
  })

  test('feedback-sabio locked at 29 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 29
    const achievements = getUnlockedAchievements()
    const sabio = achievements.find(a => a.id === 'feedback-sabio')
    expect(sabio).toBeUndefined()
  })

  test('all feedback achievements unlock at 30 confirms', () => {
    mockConfig.companionStats.totalFeedbackConfirms = 30
    const achievements = getUnlockedAchievements()
    const feedbackAchievements = achievements.filter(a => a.id.startsWith('feedback-'))
    expect(feedbackAchievements).toHaveLength(3)
    expect(feedbackAchievements.map(a => a.id)).toEqual(
      expect.arrayContaining(['feedback-aprendiz', 'feedback-mestre', 'feedback-sabio'])
    )
  })
})

describe('Tool Stats Achievements', () => {
  beforeEach(() => {
    mockConfig = {
      companion: { species: 'duck', name: 'TestBuddy', hat: 'none', xp: 0, hatchedAt: Date.now() },
      companionStats: {
        totalBashes: 0, totalTasks: 0, totalErrors: 0, totalPets: 0, daysActive: 0,
        totalReads: 0, totalWrites: 0, totalEdits: 0, totalSearches: 0,
        totalTokensSaved: 0, totalFeedbackRules: 0, totalFeedbackConfirms: 0,
      },
      companionMemory: [], companionOutfits: [], companionStreakCount: 0, companionAchievements: [],
    }
  })

  test('reader unlocks at 100 reads', () => {
    mockConfig.companionStats.totalReads = 100
    expect(getUnlockedAchievements().find(a => a.id === 'reader')).toBeDefined()
  })

  test('reader locked at 99 reads', () => {
    mockConfig.companionStats.totalReads = 99
    expect(getUnlockedAchievements().find(a => a.id === 'reader')).toBeUndefined()
  })

  test('bookworm unlocks at 500 reads', () => {
    mockConfig.companionStats.totalReads = 500
    expect(getUnlockedAchievements().find(a => a.id === 'bookworm')).toBeDefined()
  })

  test('librarian unlocks at 2000 reads', () => {
    mockConfig.companionStats.totalReads = 2000
    expect(getUnlockedAchievements().find(a => a.id === 'librarian')).toBeDefined()
  })

  test('writer unlocks at 50 writes', () => {
    mockConfig.companionStats.totalWrites = 50
    expect(getUnlockedAchievements().find(a => a.id === 'writer')).toBeDefined()
  })

  test('author unlocks at 200 writes', () => {
    mockConfig.companionStats.totalWrites = 200
    expect(getUnlockedAchievements().find(a => a.id === 'author')).toBeDefined()
  })

  test('publisher unlocks at 1000 writes', () => {
    mockConfig.companionStats.totalWrites = 1000
    expect(getUnlockedAchievements().find(a => a.id === 'publisher')).toBeDefined()
  })

  test('editor unlocks at 50 edits', () => {
    mockConfig.companionStats.totalEdits = 50
    expect(getUnlockedAchievements().find(a => a.id === 'editor')).toBeDefined()
  })

  test('refactorer unlocks at 200 edits', () => {
    mockConfig.companionStats.totalEdits = 200
    expect(getUnlockedAchievements().find(a => a.id === 'refactorer')).toBeDefined()
  })

  test('architect unlocks at 1000 edits', () => {
    mockConfig.companionStats.totalEdits = 1000
    expect(getUnlockedAchievements().find(a => a.id === 'architect')).toBeDefined()
  })

  test('detective unlocks at 100 searches', () => {
    mockConfig.companionStats.totalSearches = 100
    expect(getUnlockedAchievements().find(a => a.id === 'detective')).toBeDefined()
  })

  test('bloodhound unlocks at 500 searches', () => {
    mockConfig.companionStats.totalSearches = 500
    expect(getUnlockedAchievements().find(a => a.id === 'bloodhound')).toBeDefined()
  })

  test('stoneage-diamond unlocks at 50000 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 50000
    expect(getUnlockedAchievements().find(a => a.id === 'stoneage-diamond')).toBeDefined()
  })

  test('stoneage-diamond locked at 49999 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 49999
    expect(getUnlockedAchievements().find(a => a.id === 'stoneage-diamond')).toBeUndefined()
  })
})

describe('checkAndGrantAchievementXp', () => {
  let reactions: string[] = []

  beforeEach(() => {
    reactions = []
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'TestBuddy',
        hat: 'none',
        xp: 10,
        hatchedAt: Date.now(),
      },
      companionStats: {
        totalBashes: 0,
        totalTasks: 0,
        totalErrors: 0,
        totalPets: 0,
        daysActive: 1,
        totalFeedbackRules: 0,
        totalFeedbackConfirms: 0,
      },
      companionMemory: [],
      companionOutfits: [],
      companionStreakCount: 0,
      companionAchievements: [],
    }
  })

  test('grants XP and sends reaction when new achievement unlocks', () => {
    // Unlock "Primeiro Commit" achievement (+1 XP)
    mockConfig.companionStats.totalBashes = 1

    checkAndGrantAchievementXp('TestBuddy', (msg) => {
      reactions.push(msg)
    })

    expect(mockConfig.companion.xp).toBe(11) // 10 + 1 XP
    expect(mockConfig.companionAchievements).toContain('first-commit')
    expect(reactions).toHaveLength(1)
    expect(reactions[0]).toContain('Primeiro Commit')
    expect(reactions[0]).toContain('+1 XP')
  })

  test('grants correct scaled XP and levels up when complex achievement unlocks', () => {
    // Unlock "Maratonista" (+10 XP), "Code Reviewer" (+10 XP) and "Primeiro Commit" (+1 XP)
    mockConfig.companionStats.totalBashes = 100

    checkAndGrantAchievementXp('TestBuddy', (msg) => {
      reactions.push(msg)
    })

    expect(mockConfig.companion.xp).toBe(31) // 10 + 1 + 10 + 10 XP
    expect(mockConfig.companionAchievements).toContain('first-commit')
    expect(mockConfig.companionAchievements).toContain('maratonista')
    expect(mockConfig.companionAchievements).toContain('code-reviewer')
    expect(reactions).toHaveLength(3)
  })

  test('does not grant XP or trigger notification if achievement was already unlocked', () => {
    // Pre-populate companionAchievements with 'first-commit'
    mockConfig.companionAchievements = ['first-commit']
    mockConfig.companionStats.totalBashes = 1 // Eligible for first-commit

    checkAndGrantAchievementXp('TestBuddy', (msg) => {
      reactions.push(msg)
    })

    expect(mockConfig.companion.xp).toBe(10) // Unchanged
    expect(reactions).toHaveLength(0)
  })
})
