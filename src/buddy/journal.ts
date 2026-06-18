import { getGlobalConfig } from '../utils/config.js'

export type JournalEntry = {
  date: string
  tasks: number
  bashes: number
  errors: number
  xpGained: number
  streak: number
  events: string[]
}

export function getTodayJournal(): JournalEntry {
  const config = getGlobalConfig()
  const stats = config.companionStats
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return {
    date,
    tasks: stats?.totalTasks ?? 0,
    bashes: stats?.totalBashes ?? 0,
    errors: stats?.totalErrors ?? 0,
    xpGained: config.companion?.xp ?? 0,
    streak: config.companionStreakCount ?? 0,
    events: [],
  }
}

export function formatJournal(entry: JournalEntry): string {
  return `📖 Diário do Buddy — ${entry.date}
━━━━━━━━━━━━━━━━━━━━━━
Tasks concluídas: ${entry.tasks}
Comandos executados: ${entry.bashes}
Erros encontrados: ${entry.errors}
XP total: ${entry.xpGained}
Streak: ${entry.streak} dias
${entry.events.length > 0 ? `\nEventos:\n${entry.events.map(e => `  • ${e}`).join('\n')}` : ''}`
}

export function saveJournal(): void {
  const entry = getTodayJournal()
  const memories = getGlobalConfig().companionMemory ?? []
  const today = entry.date
  entry.events = memories
    .filter(m => {
      const memDate = new Date(m.timestamp).toISOString().split('T')[0]
      return memDate === today
    })
    .map(m => m.text)

  const formatted = formatJournal(entry)
  // Journal is displayed via /buddy journal command
  // Storage is handled by the command handler
  void formatted
}
