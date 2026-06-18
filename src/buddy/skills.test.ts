import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Provide a complete mock so transitive imports don't break
const baseMemoryScanMock = {
  scanMemoryFiles: async () => [] as any[],
  formatMemoryManifest: () => '',
}

describe('getFeedbackTip', () => {
  beforeEach(() => {
    mock.restore()
  })

  it('returns null when no feedback rules exist', async () => {
    mock.module('../memdir/memoryScan.js', () => ({
      ...baseMemoryScanMock,
      scanMemoryFiles: async () => [],
    }))

    const { getFeedbackTip } = await import('./skills.js')
    const result = await getFeedbackTip(false, 'some context')
    expect(result).toBeNull()
  })

  it('returns a tip when feedback rules exist and random allows', async () => {
    mock.module('../memdir/memoryScan.js', () => ({
      ...baseMemoryScanMock,
      scanMemoryFiles: async () => [
        {
          filename: 'feedback-testing-patterns.md',
          filePath: '/test/feedback-testing-patterns.md',
          mtimeMs: Date.now(),
          description: 'Padroes de framework de teste',
          type: 'feedback',
          score: 80,
          confirmations: 3,
        },
      ],
    }))

    const originalRandom = Math.random
    Math.random = () => 0

    const { getFeedbackTip } = await import('./skills.js')
    const result = await getFeedbackTip(false, 'jest test failed')
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')

    Math.random = originalRandom
  })
})

describe('buddy species reroll logic', () => {
  it('correctly maps species to candidate pool of the same evolution tier and updates evolvedFrom', async () => {
    const { getEvolutionTier, getEvolutionChain, EVOLUTION_CHAINS } = await import('./evolution.js')

    const currentSpecies = 'crab'
    const tier = getEvolutionTier(currentSpecies) || 1
    expect(tier).toBe(3)

    const tierIndex = tier - 1
    const pool = EVOLUTION_CHAINS.map((chain: any) => chain[tierIndex] as string)
    const candidatePool = pool.filter((s) => s !== currentSpecies)

    expect(candidatePool.length).toBeGreaterThan(0)
    expect(candidatePool.includes('crab')).toBe(false)
    for (const species of candidatePool) {
      expect(getEvolutionTier(species)).toBe(3)
    }

    const newSpecies = 'dragon'
    const newChain = getEvolutionChain(newSpecies)
    expect(newChain).not.toBeNull()

    let newEvolvedFrom: string | undefined = undefined
    if (tier === 2 && newChain) {
      newEvolvedFrom = newChain[0]
    } else if (tier === 3 && newChain) {
      newEvolvedFrom = newChain[1]
    }

    expect(newEvolvedFrom).toBe('goose')
  })

  it('correctly updates evolvedFrom to Tier 1 when rerolling a Tier 2 species', async () => {
    const { getEvolutionTier, getEvolutionChain, EVOLUTION_CHAINS } = await import('./evolution.js')

    const currentSpecies = 'goose'
    const tier = getEvolutionTier(currentSpecies) || 1
    expect(tier).toBe(2)

    const tierIndex = tier - 1
    const pool = EVOLUTION_CHAINS.map((chain: any) => chain[tierIndex] as string)
    const candidatePool = pool.filter((s) => s !== currentSpecies)

    expect(candidatePool.includes('goose')).toBe(false)
    for (const species of candidatePool) {
      expect(getEvolutionTier(species)).toBe(2)
    }

    const newSpecies = 'chonk'
    const newChain = getEvolutionChain(newSpecies)
    expect(newChain).not.toBeNull()

    let newEvolvedFrom: string | undefined = undefined
    if (tier === 2 && newChain) {
      newEvolvedFrom = newChain[0]
    } else if (tier === 3 && newChain) {
      newEvolvedFrom = newChain[1]
    }

    expect(newEvolvedFrom).toBe('cat')
  })
})
