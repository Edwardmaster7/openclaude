import { hashString } from './hash.js'
import { companionUserId } from './companion.js'

export interface Quest {
  id: string
  description: string
  xpReward: number
}

// Pool com 12 missões
export const QUEST_POOL: Quest[] = [
  { id: 'bash_long', description: 'Execute um comando bash longo (> 50 caracteres)', xpReward: 3 },
  { id: 'bash_git', description: 'Use o Git no terminal (ex: git status)', xpReward: 2 },
  { id: 'bash_npm', description: 'Use um gerenciador de pacotes (npm, yarn, pnpm)', xpReward: 2 },
  { id: 'bash_error', description: 'Receba um erro no terminal (Faz parte!)', xpReward: 2 },
  { id: 'task_completed', description: 'Conclua uma tarefa (TaskUpdate)', xpReward: 5 },
  { id: 'buddy_pet', description: 'Faça um carinho no Buddy (/buddy)', xpReward: 1 },
  { id: 'buddy_brincar', description: 'Brinque com seu Buddy (/buddy brincar)', xpReward: 1 },
  { id: 'buddy_hidratei', description: 'Beba água e arrume a postura (/buddy hidratei)', xpReward: 1 },
  { id: 'buddy_stats', description: 'Veja as estatísticas do Buddy (/buddy stats)', xpReward: 1 },
  { id: 'buddy_journal', description: 'Leia o diário do Buddy (/buddy journal)', xpReward: 1 },
  { id: 'buddy_outfits', description: 'Olhe o guarda-roupa do Buddy (/buddy outfits)', xpReward: 1 },
  { id: 'buddy_quests', description: 'Verifique suas missões diárias (/buddy quests)', xpReward: 1 },
]

export function getTodayString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function getTodayQuests(): Quest[] {
  const userId = companionUserId()
  const today = getTodayString()
  const seed = `${today}:${userId}`

  const quests: Quest[] = []
  let iteration = 0

  // Seleciona 3 missões de forma determinística
  while (quests.length < 3) {
    const hash = hashString(`${seed}:${iteration}`)
    const quest = QUEST_POOL[hash % QUEST_POOL.length]!

    // Evita duplicatas
    if (!quests.some(q => q.id === quest.id)) {
      quests.push(quest)
    }
    iteration++
  }

  return quests
}