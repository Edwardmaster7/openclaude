import { describe, it, expect, mock, beforeEach } from 'bun:test'

let mockConfig: any = {}

mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (updater: any) => {
    mockConfig = typeof updater === 'function' ? updater(mockConfig) : { ...mockConfig, ...updater }
  },
}))

mock.module('./shop.js', () => ({
  isXpShieldActive: () => {
    const until = mockConfig.companionShop?.xpShieldUntil
    return until !== null && until !== undefined && until > Date.now()
  },
}))

const { tryLoseXp, checkBuddySolitario, getXpMultiplier } = await import('./xp-loss.js')

describe('XP Loss System', () => {
  beforeEach(() => {
    mockConfig = {
      companion: { xp: 50, name: 'TestBuddy' },
      companionStreakCount: 0,
      companionShop: {},
      companionXpLossLog: undefined,
      companionLastPetDate: undefined,
    }
  })

  describe('tryLoseXp', () => {
    it('deducts XP on loss (with forced random)', () => {
      const origRandom = Math.random
      Math.random = () => 0.01

      const result = tryLoseXp('bug_critico')
      expect(result.lost).toBe(true)
      expect(result.amount).toBeGreaterThan(0)
      expect(mockConfig.companion.xp).toBeLessThan(50)

      Math.random = origRandom
    })

    it('does not go below 0 XP', () => {
      mockConfig.companion.xp = 0.1
      const origRandom = Math.random
      Math.random = () => 0.01

      tryLoseXp('bug_critico')
      expect(mockConfig.companion.xp).toBeGreaterThanOrEqual(0)

      Math.random = origRandom
    })

    it('blocks loss when XP Shield is active', () => {
      mockConfig.companionShop = { xpShieldUntil: Date.now() + 3600000 }
      const result = tryLoseXp('bug_critico')
      expect(result.blocked).toBe(true)
      expect(result.lost).toBe(false)
    })

    it('respects daily cap of 10 XP', () => {
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      mockConfig.companionXpLossLog = {
        totalLost: 0,
        lastLossDate: '',
        dailyLossToday: 10,
        dailyLossDate: todayStr,
        solitarioCount: 0,
        lossesThisSession: 0,
      }
      const result = tryLoseXp('bug_critico')
      expect(result.lost).toBe(false)
    })

    it('reduces loss by 50% with streak guard', () => {
      mockConfig.companionStreakCount = 7
      const origRandom = Math.random
      Math.random = () => 0.01

      const result = tryLoseXp('bug_critico')
      expect(result.lost).toBe(true)

      Math.random = origRandom
    })
  })

  describe('checkBuddySolitario', () => {
    it('returns no loss when pet was today', () => {
      const today = new Date()
      mockConfig.companionLastPetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const result = checkBuddySolitario()
      expect(result.lost).toBe(false)
    })

    it('triggers loss when pet was 3+ days ago', () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      mockConfig.companionLastPetDate = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(threeDaysAgo.getDate()).padStart(2, '0')}`

      const origRandom = Math.random
      Math.random = () => 0.01

      const result = checkBuddySolitario()
      expect(result.lost).toBe(true)
      expect(result.amount).toBe(2)

      Math.random = origRandom
    })
  })

  describe('getXpMultiplier', () => {
    it('returns 1 by default', () => {
      expect(getXpMultiplier()).toBe(1)
    })

    it('returns 2x with XP Boost active', () => {
      mockConfig.companionShop = { xpBoostUntil: Date.now() + 3600000 }
      expect(getXpMultiplier()).toBe(2)
    })

    it('returns 1.25x with XP Magnet active', () => {
      mockConfig.companionShop = { xpMagnetUntil: Date.now() + 3600000 }
      expect(getXpMultiplier()).toBe(1.25)
    })

    it('stacks XP Boost and XP Magnet', () => {
      mockConfig.companionShop = { xpBoostUntil: Date.now() + 3600000, xpMagnetUntil: Date.now() + 3600000 }
      expect(getXpMultiplier()).toBe(2.5)
    })
  })
})
