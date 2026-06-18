import { describe, it, expect, mock, beforeEach, beforeAll } from 'bun:test'

let mockConfig: any = {}

// Mock config first, before importing shop
mock.module('../utils/config.js', () => ({
  getGlobalConfig: () => mockConfig,
  saveGlobalConfig: (updater: any) => {
    mockConfig = typeof updater === 'function' ? updater(mockConfig) : { ...mockConfig, ...updater }
  },
}))

// Import after mock is set up
const shopModule = await import('./shop.js')
const { buyItem, equipItem, unequipItem, getInventory, formatShop, luckyDraw } = shopModule

describe('Buddy Shop', () => {
  beforeEach(() => {
    mockConfig = {
      companion: { xp: 100, name: 'TestBuddy', species: 'duck', rarity: 'common' },
      companionShop: undefined,
    }
  })

  describe('buyItem', () => {
    it('buys an item when XP is sufficient', () => {
      const result = buyItem('laco')
      expect(result.success).toBe(true)
      expect(result.message).toContain('comprado')
      expect(mockConfig.companion.xp).toBe(95)
      expect(mockConfig.companionShop.ownedAccessories).toContain('laco')
    })

    it('rejects purchase when XP is insufficient', () => {
      mockConfig.companion.xp = 2
      const result = buyItem('laco')
      expect(result.success).toBe(false)
      expect(result.message).toContain('XP')
    })

    it('rejects duplicate purchase of permanent item', () => {
      buyItem('laco')
      const result = buyItem('laco')
      expect(result.success).toBe(false)
      expect(result.message).toContain('já possui')
    })

    it('allows re-purchase of consumable items', () => {
      buyItem('free-reroll')
      const result = buyItem('free-reroll')
      expect(result.success).toBe(true)
    })

    it('activates timed abilities on purchase', () => {
      buyItem('xp-shield')
      expect(mockConfig.companionShop.xpShieldUntil).toBeGreaterThan(Date.now())
    })
  })

  describe('equipItem', () => {
    it('equips an owned item', () => {
      buyItem('laco')
      const result = equipItem('laco')
      expect(result.success).toBe(true)
      expect(mockConfig.companionShop.equippedAccessories).toContain('laco')
    })

    it('rejects equipping unowned item', () => {
      const result = equipItem('laco')
      expect(result.success).toBe(false)
      expect(result.message).toContain('não possui')
    })

    it('limits to 3 accessories', () => {
      buyItem('laco')
      buyItem('monoculo')
      buyItem('oculos')
      buyItem('bandana')
      equipItem('laco')
      equipItem('monoculo')
      equipItem('oculos')
      const result = equipItem('bandana')
      expect(result.success).toBe(false)
      expect(result.message).toContain('Máximo')
    })
  })

  describe('unequipItem', () => {
    it('unequips an equipped item', () => {
      buyItem('laco')
      equipItem('laco')
      const result = unequipItem('laco')
      expect(result.success).toBe(true)
      expect(mockConfig.companionShop.equippedAccessories).not.toContain('laco')
    })
  })

  describe('getInventory', () => {
    it('returns owned and equipped items', () => {
      buyItem('laco')
      buyItem('monoculo')
      equipItem('laco')
      const inv = getInventory()
      expect(inv.owned.length).toBe(2)
      expect(inv.equipped).toContain('laco')
    })
  })

  describe('formatShop', () => {
    it('formats shop with XP balance', () => {
      const text = formatShop()
      expect(text).toContain('100 XP')
      expect(text).toContain('Acessórios')
    })

    it('filters by category', () => {
      const text = formatShop('abilities')
      expect(text).toContain('Quick Tips')
    })
  })

  describe('luckyDraw', () => {
    it('returns an item from the correct pool', () => {
      const result = luckyDraw('common')
      expect(result.item.price).toBeLessThanOrEqual(15)
    })
  })

})
