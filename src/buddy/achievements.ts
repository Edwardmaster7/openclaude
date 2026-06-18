import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { getLevelInfo } from './progression.js'

export type Achievement = {
  id: string
  name: string
  description: string
  emoji: string
  xpReward: number
  check: () => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-commit',
    name: 'Primeiro Commit',
    description: 'Complete seu primeiro comando bash',
    emoji: '🎯',
    xpReward: 1,
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 1,
  },
  {
    id: 'maratonista',
    name: 'Maratonista',
    description: 'Execute 100 comandos bash',
    emoji: '🏃',
    xpReward: 10,
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 100,
  },
  {
    id: 'maratonista-1k',
    name: 'Maratonista de Elite',
    description: 'Execute 1000 comandos bash',
    emoji: '🏅',
    xpReward: 30,
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 1000,
  },
  {
    id: 'bug-hunter',
    name: 'Bug Hunter',
    description: 'Encontre 20 erros',
    emoji: '🐛',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalErrors ?? 0) >= 20,
  },
  {
    id: 'bug-slayer',
    name: 'Bug Slayer',
    description: 'Encontre 100 erros',
    emoji: '⚔️',
    xpReward: 15,
    check: () => (getGlobalConfig().companionStats?.totalErrors ?? 0) >= 100,
  },
  {
    id: 'task-master',
    name: 'Task Master',
    description: 'Complete 50 tasks',
    emoji: '✅',
    xpReward: 15,
    check: () => (getGlobalConfig().companionStats?.totalTasks ?? 0) >= 50,
  },
  {
    id: 'task-legend',
    name: 'Task Legend',
    description: 'Complete 200 tasks',
    emoji: '🏆',
    xpReward: 40,
    check: () => (getGlobalConfig().companionStats?.totalTasks ?? 0) >= 200,
  },
  {
    id: 'streak-warrior',
    name: 'Streak Warrior',
    description: 'Mantenha um streak de 30 dias',
    emoji: '🔥',
    xpReward: 30,
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 30,
  },
  {
    id: 'streak-obsessed',
    name: 'Streak Obsessed',
    description: 'Mantenha um streak de 90 dias',
    emoji: '💎',
    xpReward: 50,
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 90,
  },
  {
    id: 'pet-lover',
    name: 'Pet Lover',
    description: 'Acaricie seu buddy 100 vezes',
    emoji: '❤️',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalPets ?? 0) >= 100,
  },
  {
    id: 'pet-addict',
    name: 'Pet Addict',
    description: 'Acaricie seu buddy 500 vezes',
    emoji: '💖',
    xpReward: 20,
    check: () => (getGlobalConfig().companionStats?.totalPets ?? 0) >= 500,
  },
  {
    id: 'evolver',
    name: 'Evolver',
    description: 'Evolua seu buddy',
    emoji: '🧬',
    xpReward: 10,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'evolve'),
  },
  {
    id: 'konami-master',
    name: 'Konami Master',
    description: 'Ative o Konami Code',
    emoji: '🎮',
    xpReward: 5,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'konami'),
  },
  {
    id: 'fashionista',
    name: 'Fashionista',
    description: 'Desbloqueie 5 outfits',
    emoji: '👗',
    xpReward: 15,
    check: () => (getGlobalConfig().companionOutfits ?? []).length >= 5,
  },
  {
    id: 'fashion-king',
    name: 'Fashion King',
    description: 'Desbloqueie 10 outfits',
    emoji: '👑',
    xpReward: 30,
    check: () => (getGlobalConfig().companionOutfits ?? []).length >= 10,
  },
  {
    id: 'legendary',
    name: 'Lendário',
    description: 'Alcance o Level 10',
    emoji: '👑',
    xpReward: 50,
    check: () => (getGlobalConfig().companion?.xp ?? 0) >= 400,
  },
  {
    id: 'easter-hunter',
    name: 'Easter Hunter',
    description: 'Encontre 3 easter eggs diferentes',
    emoji: '🥚',
    xpReward: 15,
    check: () => {
      const memories = getGlobalConfig().companionMemory ?? []
      const eggTriggers = ['easterEgg', 'konami', 'doubleRainbow', 'loopInfinite', 'answer42', 'midnightEvolve']
      const found = new Set(memories.filter(m => eggTriggers.includes(m.trigger)).map(m => m.trigger))
      return found.size >= 3
    },
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Use o buddy entre 00:00 e 01:00',
    emoji: '🦉',
    xpReward: 5,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'midnightEvolve'),
  },
  {
    id: 'rainbow-warrior',
    name: 'Rainbow Warrior',
    description: 'Ative o Double Rainbow',
    emoji: '🌈',
    xpReward: 25,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'doubleRainbow'),
  },
  {
    id: 'premium-user',
    name: 'Premium User',
    description: 'Use o modo premium',
    emoji: '⭐',
    xpReward: 5,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'petPremium'),
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Receba 10 dicas de code review',
    emoji: '🔍',
    xpReward: 10,
    check: () => (getGlobalConfig().companionStats?.totalBashes ?? 0) >= 50,
  },
  {
    id: 'stoneage-first',
    name: 'Primeiro Contato',
    description: 'Ative o stoneage pela primeira vez',
    emoji: '🪨',
    xpReward: 2,
    check: () => (getGlobalConfig().companionMemory ?? []).some(m => m.trigger === 'stoneageFirst'),
  },
  {
    id: 'stoneage-fire',
    name: 'Economia de Fogo',
    description: 'Economize 1000 tokens estimados com stoneage',
    emoji: '🔥',
    xpReward: 10,
    check: () => (getGlobalConfig().companionStats?.totalTokensSaved ?? 0) >= 1000,
  },
  {
    id: 'stoneage-mammoth',
    name: 'Mamute de Ouro',
    description: 'Economize 10000 tokens estimados com stoneage',
    emoji: '🦣',
    xpReward: 25,
    check: () => (getGlobalConfig().companionStats?.totalTokensSaved ?? 0) >= 10000,
  },
  {
    id: 'stoneage-master',
    name: 'Mestre das Pedras',
    description: 'Ative o stoneage 50 vezes',
    emoji: '⛏️',
    xpReward: 30,
    check: () => (getGlobalConfig().companionStats?.totalTokensSaved ?? 0) >= 25000,
  },
  {
    id: 'feedback-aprendiz',
    name: 'Aprendiz',
    description: 'Confirme 5 regras de feedback',
    emoji: '📚',
    xpReward: 10,
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 5,
  },
  {
    id: 'feedback-mestre',
    name: 'Mestre',
    description: 'Confirme 15 regras de feedback',
    emoji: '🎓',
    xpReward: 20,
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 15,
  },
  {
    id: 'feedback-sabio',
    name: 'Sabio',
    description: 'Confirme 30 regras de feedback',
    emoji: '🧙',
    xpReward: 35,
    check: () => (getGlobalConfig().companionStats?.totalFeedbackConfirms ?? 0) >= 30,
  },
  // Reads
  {
    id: 'reader',
    name: 'Leitor',
    description: 'Leia 100 arquivos',
    emoji: '📖',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalReads ?? 0) >= 100,
  },
  {
    id: 'bookworm',
    name: 'Bookworm',
    description: 'Leia 500 arquivos',
    emoji: '📚',
    xpReward: 15,
    check: () => (getGlobalConfig().companionStats?.totalReads ?? 0) >= 500,
  },
  {
    id: 'librarian',
    name: 'Librarian',
    description: 'Leia 2000 arquivos',
    emoji: '🏛️',
    xpReward: 40,
    check: () => (getGlobalConfig().companionStats?.totalReads ?? 0) >= 2000,
  },
  // Writes
  {
    id: 'writer',
    name: 'Escritor',
    description: 'Escreva 50 arquivos',
    emoji: '✏️',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalWrites ?? 0) >= 50,
  },
  {
    id: 'author',
    name: 'Autor',
    description: 'Escreva 200 arquivos',
    emoji: '📝',
    xpReward: 15,
    check: () => (getGlobalConfig().companionStats?.totalWrites ?? 0) >= 200,
  },
  {
    id: 'publisher',
    name: 'Publisher',
    description: 'Escreva 1000 arquivos',
    emoji: '📰',
    xpReward: 40,
    check: () => (getGlobalConfig().companionStats?.totalWrites ?? 0) >= 1000,
  },
  // Edits
  {
    id: 'editor',
    name: 'Editor',
    description: 'Edite 50 arquivos',
    emoji: '🔧',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalEdits ?? 0) >= 50,
  },
  {
    id: 'refactorer',
    name: 'Refactorer',
    description: 'Edite 200 arquivos',
    emoji: '♻️',
    xpReward: 15,
    check: () => (getGlobalConfig().companionStats?.totalEdits ?? 0) >= 200,
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'Edite 1000 arquivos',
    emoji: '🏗️',
    xpReward: 40,
    check: () => (getGlobalConfig().companionStats?.totalEdits ?? 0) >= 1000,
  },
  // Searches
  {
    id: 'detective',
    name: 'Detective',
    description: 'Faça 100 buscas',
    emoji: '🔎',
    xpReward: 5,
    check: () => (getGlobalConfig().companionStats?.totalSearches ?? 0) >= 100,
  },
  {
    id: 'bloodhound',
    name: 'Bloodhound',
    description: 'Faça 500 buscas',
    emoji: '🐕',
    xpReward: 20,
    check: () => (getGlobalConfig().companionStats?.totalSearches ?? 0) >= 500,
  },
  // Stoneage extra tier
  {
    id: 'stoneage-diamond',
    name: 'Diamante Bruto',
    description: 'Economize 50000 tokens estimados com stoneage',
    emoji: '💎',
    xpReward: 50,
    check: () => (getGlobalConfig().companionStats?.totalTokensSaved ?? 0) >= 50000,
  },
  // ─── XP Loss Achievements ──────────────────────────────────────────────────
  {
    id: 'phoenix',
    name: 'Phoenix',
    description: 'Recuperar 50 XP perdidos total',
    emoji: '🔥',
    xpReward: 10,
    check: () => (getGlobalConfig().companionXpLossLog?.totalLost ?? 0) >= 50,
  },
  {
    id: 'descuidado',
    name: 'Descuidado',
    description: 'Tomar penalidade de Buddy Solitário 3 vezes',
    emoji: '😢',
    xpReward: 5,
    check: () => (getGlobalConfig().companionXpLossLog?.solitarioCount ?? 0) >= 3,
  },
  {
    id: 'cuidador-devoto',
    name: 'Cuidador Devoto',
    description: 'Fazer pet 30 dias seguidos sem falhar',
    emoji: '💝',
    xpReward: 25,
    check: () => (getGlobalConfig().companionStreakCount ?? 0) >= 30,
  },
  {
    id: 'shield-master',
    name: 'Shield Master',
    description: 'Usar XP Shield 10 vezes',
    emoji: '🛡️',
    xpReward: 20,
    check: () => (getGlobalConfig().companionShop?.shieldUseCount ?? 0) >= 10,
  },
  {
    id: 'resiliente',
    name: 'Resiliente',
    description: 'Perder 20 XP em uma sessão e continuar',
    emoji: '💪',
    xpReward: 5,
    check: () => (getGlobalConfig().companionXpLossLog?.lossesThisSession ?? 0) >= 20,
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    description: 'Veteran\'s Luck bloquear 5 perdas',
    emoji: '🍀',
    xpReward: 10,
    check: () => (getGlobalConfig().companionShop?.luckyBlocks ?? 0) >= 5,
  },
  {
    id: 'shopaholic',
    name: 'Shopaholic',
    description: 'Comprar 10 itens na loja',
    emoji: '🛍️',
    xpReward: 15,
    check: () => {
      const shop = getGlobalConfig().companionShop
      if (!shop) return false
      const total = shop.ownedAccessories.length + shop.ownedThemes.length + shop.ownedEmotes.length + shop.ownedAbilities.length
      return total >= 10
    },
  },
]

export function getUnlockedAchievements(): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.check())
}

export function getAchievementProgress(): Array<{
  achievement: Achievement
  unlocked: boolean
}> {
  return ACHIEVEMENTS.map(a => ({
    achievement: a,
    unlocked: a.check(),
  }))
}

export function checkAndGrantAchievementXp(
  companionName: string,
  onReaction: (msg: string) => void,
): void {
  const config = getGlobalConfig()
  const previouslyUnlocked = config.companionAchievements ?? []

  // Get currently unlocked achievements
  const currentUnlocked = ACHIEVEMENTS.filter(a => a.check())

  // Find newly unlocked achievements
  const newlyUnlocked = currentUnlocked.filter(a => !previouslyUnlocked.includes(a.id))

  if (newlyUnlocked.length === 0) return

  saveGlobalConfig(curr => {
    if (!curr.companion) return curr

    const existingAchievements = curr.companionAchievements ?? []
    const updatedAchievements = [...new Set([...existingAchievements, ...newlyUnlocked.map(a => a.id)])]

    // Compute total XP to add
    const totalXpToAdd = newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0)
    const currentXp = curr.companion.xp ?? 0
    const newXp = Math.round((currentXp + totalXpToAdd) * 1000) / 1000
    const newInfo = getLevelInfo(newXp)

    return {
      ...curr,
      companionAchievements: updatedAchievements,
      companion: {
        ...curr.companion,
        xp: newXp,
        hat: newInfo.hat ?? curr.companion.hat,
      },
    }
  })

  // Notify for each newly unlocked achievement
  for (const ach of newlyUnlocked) {
    onReaction(
      `${companionName}: 🏆 Conquista Desbloqueada! ${ach.emoji} **${ach.name}** — *${ach.description}* (+${ach.xpReward} XP!)`
    )
  }
}
