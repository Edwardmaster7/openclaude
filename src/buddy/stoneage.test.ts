import { describe, expect, mock, test, beforeEach } from 'bun:test'

// Mock config before importing module under test
let mockConfig: Record<string, any> = {}

mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (fn: (prev: any) => any) => {
    mockConfig = fn(mockConfig)
  },
}))

import { getUnlockedAchievements } from './achievements.js'
import { addMemory, getMemories } from './memory.js'

describe('Stoneage Achievements', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'TestBuddy',
        hat: 'none',
        xp: 0,
        hatchedAt: Date.now(),
      },
      companionStats: {
        totalBashes: 0,
        totalTasks: 0,
        totalErrors: 0,
        totalPets: 0,
        daysActive: 0,
        totalTokensSaved: 0,
      },
      companionMemory: [],
    }
  })

  test('stoneageFirst achievement unlocks on first activation', () => {
    mockConfig.companionMemory = [{ text: 'Ativou o stoneage pela primeira vez!', timestamp: Date.now(), trigger: 'stoneageFirst' }]
    const achievements = getUnlockedAchievements()
    const stoneageFirst = achievements.find(a => a.id === 'stoneage-first')
    expect(stoneageFirst).toBeDefined()
    expect(stoneageFirst!.name).toBe('Primeiro Contato')
  })

  test('stoneageFirst achievement locked without memory', () => {
    mockConfig.companionMemory = []
    const achievements = getUnlockedAchievements()
    const stoneageFirst = achievements.find(a => a.id === 'stoneage-first')
    expect(stoneageFirst).toBeUndefined()
  })

  test('Economia de Fogo unlocks at 1000 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 1000
    const achievements = getUnlockedAchievements()
    const fire = achievements.find(a => a.id === 'stoneage-fire')
    expect(fire).toBeDefined()
    expect(fire!.name).toBe('Economia de Fogo')
  })

  test('Economia de Fogo locked at 999 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 999
    const achievements = getUnlockedAchievements()
    const fire = achievements.find(a => a.id === 'stoneage-fire')
    expect(fire).toBeUndefined()
  })

  test('Mamute de Ouro unlocks at 10000 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 10000
    const achievements = getUnlockedAchievements()
    const mammoth = achievements.find(a => a.id === 'stoneage-mammoth')
    expect(mammoth).toBeDefined()
    expect(mammoth!.name).toBe('Mamute de Ouro')
  })

  test('Mestre das Pedras unlocks at 25000 tokens', () => {
    mockConfig.companionStats.totalTokensSaved = 25000
    const achievements = getUnlockedAchievements()
    const master = achievements.find(a => a.id === 'stoneage-master')
    expect(master).toBeDefined()
    expect(master!.name).toBe('Mestre das Pedras')
  })

  test('no stoneage achievements unlock at 0 tokens', () => {
    const achievements = getUnlockedAchievements()
    const stoneageAchievements = achievements.filter(a => a.id.startsWith('stoneage-'))
    expect(stoneageAchievements).toHaveLength(0)
  })
})

describe('Stoneage Memory', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'TestBuddy',
        hat: 'none',
        xp: 0,
        hatchedAt: Date.now(),
      },
      companionMemory: [],
    }
  })

  test('addMemory stoneageFirst creates memory entry', () => {
    addMemory('stoneageFirst')
    const memories = getMemories()
    expect(memories.length).toBe(1)
    expect(memories[0].trigger).toBe('stoneageFirst')
    expect(memories[0].text).toContain('stoneage')
  })
})

describe('Stoneage companionStats type', () => {
  test('totalTokensSaved field exists in companionStats', () => {
    mockConfig = {
      companionStats: {
        totalBashes: 10,
        totalTasks: 5,
        totalErrors: 2,
        totalPets: 3,
        daysActive: 7,
        totalTokensSaved: 500,
      },
    }
    expect(mockConfig.companionStats.totalTokensSaved).toBe(500)
  })

  test('totalTokensSaved defaults to 0 when missing', () => {
    mockConfig = {
      companionStats: {
        totalBashes: 10,
        totalTasks: 5,
        totalErrors: 2,
        totalPets: 3,
        daysActive: 7,
      },
    }
    const saved = mockConfig.companionStats?.totalTokensSaved ?? 0
    expect(saved).toBe(0)
  })
})
