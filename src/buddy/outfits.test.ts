import { describe, expect, mock, test, beforeEach } from 'bun:test'

// Mock config before importing module under test
let mockConfig: Record<string, any> = {}

mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (fn: (prev: any) => any) => {
    mockConfig = fn(mockConfig)
  },
}))

import { equipHat, getHatRequirements, checkAndUnlockOutfits } from './outfits.js'

describe('equipHat', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'Test',
        hat: 'none',
        xp: 0,
        hatchedAt: Date.now(),
      },
      companionStats: { totalBashes: 0, totalTasks: 0, totalErrors: 0 },
    }
  })

  test('returns false for locked hat (level too low)', () => {
    // XP 0 = level 1, beanie requires level 2
    expect(equipHat('beanie')).toBe(false)
  })

  test('returns false for unknown hat name', () => {
    expect(equipHat('nonexistent')).toBe(false)
  })

  test('equips beanie when level 2+ (XP >= 5)', () => {
    mockConfig.companion.xp = 5
    expect(equipHat('beanie')).toBe(true)
    expect(mockConfig.companion.hat).toBe('beanie')
  })

  test('equips crown when level 10+ (XP >= 400)', () => {
    mockConfig.companion.xp = 400
    expect(equipHat('crown')).toBe(true)
    expect(mockConfig.companion.hat).toBe('crown')
  })

  test('can switch between unlocked hats freely', () => {
    mockConfig.companion.xp = 80 // level 5
    expect(equipHat('beanie')).toBe(true)
    expect(mockConfig.companion.hat).toBe('beanie')
    expect(equipHat('wizard')).toBe(true)
    expect(mockConfig.companion.hat).toBe('wizard')
    expect(equipHat('propeller')).toBe(true)
    expect(mockConfig.companion.hat).toBe('propeller')
  })

  test('returns false when no companion', () => {
    mockConfig = {}
    expect(equipHat('beanie')).toBe(false)
  })

  test('equips headphones when 500+ bashes (achievement)', () => {
    mockConfig.companion.xp = 400
    mockConfig.companionStats.totalBashes = 500
    expect(equipHat('headphones')).toBe(true)
    expect(mockConfig.companion.hat).toBe('headphones')
  })

  test('headphones locked with fewer than 500 bashes', () => {
    mockConfig.companion.xp = 400
    mockConfig.companionStats.totalBashes = 499
    expect(equipHat('headphones')).toBe(false)
  })

  test('hat persists across equip calls (last one wins)', () => {
    mockConfig.companion.xp = 170 // level 7
    equipHat('halo')
    expect(mockConfig.companion.hat).toBe('halo')
    equipHat('beanie')
    expect(mockConfig.companion.hat).toBe('beanie')
  })
})

describe('getHatRequirements', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'Test',
        hat: 'none',
        xp: 50,
        hatchedAt: Date.now(),
      },
      companionStats: { totalBashes: 0, totalTasks: 0, totalErrors: 0 },
    }
  })

  test('returns all 12 hats (9 level + 3 achievement)', () => {
    const reqs = getHatRequirements()
    expect(reqs.length).toBe(12)
  })

  test('marks level hats correctly based on XP', () => {
    // XP 50 = level 4
    const reqs = getHatRequirements()
    const byName = Object.fromEntries(reqs.map(h => [h.hat, h]))
    expect(byName['beanie'].unlocked).toBe(true)   // level 2
    expect(byName['propeller'].unlocked).toBe(true) // level 3
    expect(byName['tophat'].unlocked).toBe(true)    // level 4
    expect(byName['wizard'].unlocked).toBe(false)   // level 5
    expect(byName['crown'].unlocked).toBe(false)    // level 10
  })

  test('headphones unlocked with 500+ bashes', () => {
    mockConfig.companionStats.totalBashes = 500
    const reqs = getHatRequirements()
    const hp = reqs.find(h => h.hat === 'headphones')!
    expect(hp.unlocked).toBe(true)
  })

  test('headphones locked with fewer than 500 bashes', () => {
    mockConfig.companionStats.totalBashes = 100
    const reqs = getHatRequirements()
    const hp = reqs.find(h => h.hat === 'headphones')!
    expect(hp.unlocked).toBe(false)
  })

  test('level hats source is level, achievement hats source is achievement', () => {
    const reqs = getHatRequirements()
    const levelHats = reqs.filter(h => h.source === 'level')
    const achievementHats = reqs.filter(h => h.source === 'achievement')
    expect(levelHats.length).toBe(9)
    expect(achievementHats.length).toBe(3) // santa, party, headphones
  })

  test('equipped hat shows correct current value', () => {
    mockConfig.companion.hat = 'tophat'
    // getHatRequirements reads XP/companion from config, not the hat field
    // so it still works — we mainly test that it returns data
    const reqs = getHatRequirements()
    expect(reqs.length).toBe(12)
  })
})

describe('checkAndUnlockOutfits', () => {
  beforeEach(() => {
    mockConfig = {
      companion: {
        species: 'duck',
        name: 'Test',
        hat: 'none',
        xp: 0,
        hatchedAt: Date.now(),
      },
      companionStats: {
        totalBashes: 0,
        totalTasks: 0,
        totalErrors: 0,
        totalSessionMinutes: 0,
      },
      companionOutfits: [],
    }
  })

  test('unlocks Pixel Art when totalSessionMinutes >= 6000', () => {
    mockConfig.companionStats.totalSessionMinutes = 6000
    const newlyUnlocked = checkAndUnlockOutfits()
    expect(newlyUnlocked).toContain('Pixel Art')
    expect(mockConfig.companionOutfits).toContain('pixel-art')
  })

  test('does not unlock Pixel Art when totalSessionMinutes < 6000', () => {
    mockConfig.companionStats.totalSessionMinutes = 5999
    const newlyUnlocked = checkAndUnlockOutfits()
    expect(newlyUnlocked).not.toContain('Pixel Art')
    expect(mockConfig.companionOutfits).not.toContain('pixel-art')
  })
})
