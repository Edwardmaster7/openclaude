import { getGlobalConfig } from '../utils/config.js'
import { scanMemoryFiles } from '../memdir/memoryScan.js'
import { getAutoMemPath } from '../memdir/paths.js'

export type BuddyMood = {
  emoji: string
  text: string
  mood: 'feliz' | 'orgulhoso' | 'preocupado' | 'sonolento' | 'empolgado' | 'neutro' | 'refrescado'
}

async function getFeedbackMood(): Promise<BuddyMood | null> {
  try {
    const memories = await scanMemoryFiles(getAutoMemPath(), AbortSignal.timeout(1000))
    const feedbackRules = memories.filter(m => m.type === 'feedback' && !m.ignored)

    if (feedbackRules.length === 0) {
      return { emoji: '📝', text: 'Ainda nao aprendi regras. Me corrija quando eu errar!', mood: 'neutro' }
    }

    const avgScore = feedbackRules.reduce((sum, m) => sum + (m.score ?? 50), 0) / feedbackRules.length

    if (avgScore >= 80) {
      return {
        emoji: '🧠',
        text: `Voce tem ${feedbackRules.length} regras consolidadas! Aprendendo rapido.`,
        mood: 'orgulhoso',
      }
    }

    if (avgScore < 40) {
      return {
        emoji: '🤔',
        text: `Tenho ${feedbackRules.length} regras esquecidas... quer revisar?`,
        mood: 'preocupado',
      }
    }

    return null
  } catch {
    return null
  }
}

export async function getMood(): Promise<BuddyMood> {
  const config = getGlobalConfig()
  const stats = config.companionStats
  const lastPetDate = config.companionLastPetDate
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Premium mood
  const premiumUntil = config.companion?.premiumUntil ?? 0
  if (premiumUntil > Date.now()) {
    const isEven = Math.floor(Date.now() / 60000) % 2 === 0
    return {
      emoji: isEven ? '🔥' : '⭐',
      text: 'Modo premium ativado! Tô em chamas!',
      mood: 'empolgado',
    }
  }

  // Refrescado: tomou água / posturou recentemente (30 mins)
  const lastHidratei = config.companionLastAction?.hidratei ?? 0
  if (now.getTime() - lastHidratei < 30 * 60 * 1000) {
    return { emoji: '🧊', text: 'Bem hidratado e com boa postura!', mood: 'refrescado' }
  }

  // Sonolento: não pet hoje
  if (lastPetDate !== today) {
    return { emoji: '😴', text: 'Tô com sono... me dá um pet?', mood: 'sonolento' }
  }

  // Feedback moods (async, best-effort)
  try {
    const feedbackMood = await getFeedbackMood()
    if (feedbackMood) return feedbackMood
  } catch {
    // Ignore feedback mood errors
  }

  if (!stats) {
    return { emoji: '😊', text: 'Feliz em estar aqui!', mood: 'feliz' }
  }

  const errorRate = stats.totalBashes > 0 ? stats.totalErrors / stats.totalBashes : 0

  // Preocupado: muitos erros recentes
  if (errorRate > 0.4 && stats.totalBashes > 10) {
    return { emoji: '😟', text: 'Tem dado muitos erros... quer ajuda?', mood: 'preocupado' }
  }

  // Empolgado: muitas tasks completadas
  if (stats.totalTasks > 0 && stats.totalTasks % 10 === 0) {
    return { emoji: '🤩', text: `${stats.totalTasks} tasks concluídas! Incrível!`, mood: 'empolgado' }
  }

  // Orgulhoso: streak alto
  const streak = config.companionStreakCount ?? 0
  if (streak >= 7) {
    return { emoji: '😤', text: `${streak} dias seguidos! Orgulhoso de você!`, mood: 'orgulhoso' }
  }

  // Feliz: pet do dia feito, sem problemas
  return { emoji: '😄', text: 'Tudo fluindo bem!', mood: 'feliz' }
}
