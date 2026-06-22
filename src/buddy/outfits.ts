import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { getLevelInfo } from './progression.js'

export type Outfit = {
  id: string
  name: string
  description: string
  requirement: string
  check: () => boolean
}

export const OUTFITS: Outfit[] = [
  {
    id: 'dourado',
    name: 'Dourado',
    description: 'Skin brilhante para mestres das tasks',
    requirement: 'Completar 100 tasks',
    check: () => (getGlobalConfig().companionStats?.totalTasks ?? 0) >= 100,
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Skin luminosa para devotados',
    requirement: 'Streak de 30 dias',
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 30,
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Skin digital para bash masters',
    requirement: '500 comandos bash',
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 500,
  },
  {
    id: 'fantasma',
    name: 'Fantasma',
    description: 'Skin etérea para os persistentes',
    requirement: 'Streak de 7 dias',
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 7,
  },
  {
    id: 'arco-iris',
    name: 'Arco-Íris',
    description: 'Skin colorida para os sortudos',
    requirement: 'Encontrar um easter egg',
    check: () => {
      const memories = getGlobalConfig().companionMemory ?? []
      const eggTriggers = ['easterEgg', 'konami', 'doubleRainbow', 'loopInfinite', 'answer42', 'midnightEvolve']
      return memories.some(m => eggTriggers.includes(m.trigger))
    },
  },
  {
    id: 'viking',
    name: 'Viking',
    description: 'Skin guerreira',
    requirement: 'Completar 50 tasks e ter streak de 7 dias',
    check: () =>
      (getGlobalConfig().companionStats?.totalTasks ?? 0) >= 50 &&
      (getGlobalConfig().companionStreakCount ?? 0) >= 7,
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    description: 'Skin retro 8-bit',
    requirement: 'Usar o OpenClaude por 100 horas',
    check: () => (getGlobalConfig().companionStats?.totalSessionMinutes ?? 0) >= 6000,
  },
  {
    id: 'invisivel',
    name: 'Invisível',
    description: 'Quase transparente',
    requirement: 'Encontrar 5 easter eggs',
    check: () => {
      const memories = getGlobalConfig().companionMemory ?? []
      const eggTriggers = ['easterEgg', 'konami', 'doubleRainbow', 'loopInfinite', 'answer42', 'midnightEvolve']
      return memories.filter(m => eggTriggers.includes(m.trigger)).length >= 5
    },
  },
  {
    id: 'fogo',
    name: 'Fogo',
    description: 'Flamejante',
    requirement: 'Streak de 60 dias',
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 60,
  },
  {
    id: 'hacker',
    name: 'Hacker',
    description: 'Terminal verde',
    requirement: '1000 comandos bash',
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 1000,
  },
  {
    id: 'festivo',
    name: 'Festivo',
    description: 'Confetti e balões',
    requirement: 'Abrir o OpenClaude em dezembro',
    check: () => new Date().getMonth() === 11,
  },
  {
    id: 'ninja',
    name: 'Ninja',
    description: 'Stealth mode',
    requirement: 'Completar 20 tasks sem erros',
    check: () =>
      (getGlobalConfig().companionStats?.totalTasks ?? 0) >= 20 &&
      (getGlobalConfig().companionStats?.totalErrors ?? 0) === 0,
  },
]

export function getUnlockedOutfits(): string[] {
  return getGlobalConfig().companionOutfits ?? []
}

export function getActiveOutfit(): string | null {
  return getGlobalConfig().companionActiveOutfit ?? null
}

export function checkAndUnlockOutfits(): string[] {
  const config = getGlobalConfig()
  const unlocked = new Set(config.companionOutfits ?? [])
  const newlyUnlocked: string[] = []

  for (const outfit of OUTFITS) {
    if (!unlocked.has(outfit.id) && outfit.check()) {
      unlocked.add(outfit.id)
      newlyUnlocked.push(outfit.name)
    }
  }

  if (newlyUnlocked.length > 0) {
    saveGlobalConfig(curr => ({
      ...curr,
      companionOutfits: [...unlocked],
    }))
  }

  return newlyUnlocked
}

export function equipOutfit(outfitId: string): boolean {
  const unlocked = getUnlockedOutfits()
  if (!unlocked.includes(outfitId)) return false

  saveGlobalConfig(curr => ({
    ...curr,
    companionActiveOutfit: outfitId,
  }))

  return true
}

export function unequipOutfit(): boolean {
  saveGlobalConfig(curr => ({
    ...curr,
    companionActiveOutfit: undefined,
  }))
  return true
}

export function equipHat(hat: string): boolean {
  const hatReqs = getHatRequirements()
  const match = hatReqs.find(h => h.hat === hat && h.unlocked)
  if (!match) return false
  saveGlobalConfig(curr => ({
    ...curr,
    companion: curr.companion ? { ...curr.companion, hat } : undefined,
  }))
  return true
}

export function unequipHat(): boolean {
  saveGlobalConfig(curr => ({
    ...curr,
    companion: curr.companion ? { ...curr.companion, hat: undefined } : undefined,
  }))
  return true
}

export function getOutfitRequirements(): Array<{
  id: string
  name: string
  description: string
  requirement: string
  unlocked: boolean
}> {
  const unlocked = new Set(getUnlockedOutfits())
  return OUTFITS.map(o => ({
    id: o.id,
    name: o.name,
    description: o.description,
    requirement: o.requirement,
    unlocked: unlocked.has(o.id),
  }))
}

const LEVEL_HATS = [
  { hat: 'beanie', level: 2 },
  { hat: 'propeller', level: 3 },
  { hat: 'tophat', level: 4 },
  { hat: 'wizard', level: 5 },
  { hat: 'pirate', level: 6 },
  { hat: 'halo', level: 7 },
  { hat: 'tinyduck', level: 8 },
  { hat: 'chef', level: 9 },
  { hat: 'crown', level: 10 },
] as const

export function getHatRequirements(): Array<{
  hat: string
  requirement: string
  unlocked: boolean
  source: 'level' | 'achievement'
}> {
  const config = getGlobalConfig()
  const xp = config.companion?.xp ?? 0
  const currentLevel = getLevelInfo(xp).level
  const totalBashes = config.companionStats?.totalBashes ?? 0

  const now = new Date()
  const isDec25 = now.getMonth() === 11 && now.getDate() === 25

  const hatchedAt = config.companion?.hatchedAt
  const isHatchAnniversary = (() => {
    if (!hatchedAt) return false
    const hatched = new Date(hatchedAt)
    return (
      now.getMonth() === hatched.getMonth() &&
      now.getDate() === hatched.getDate()
    )
  })()

  const results: Array<{
    hat: string
    requirement: string
    unlocked: boolean
    source: 'level' | 'achievement'
  }> = []

  for (const { hat, level } of LEVEL_HATS) {
    results.push({
      hat,
      requirement: `Alcançar nível ${level}`,
      unlocked: currentLevel >= level,
      source: 'level',
    })
  }

  results.push({
    hat: 'santa',
    requirement: 'Abrir no dia 25 de dezembro',
    unlocked: isDec25,
    source: 'achievement',
  })
  results.push({
    hat: 'party',
    requirement: 'Aniversário do hatch do companion',
    unlocked: isHatchAnniversary,
    source: 'achievement',
  })
  results.push({
    hat: 'headphones',
    requirement: '500 comandos bash',
    unlocked: totalBashes >= 500,
    source: 'achievement',
  })

  return results
}
