import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { isXpShieldActive } from './shop.js'

// ─── XP Loss Log ─────────────────────────────────────────────────────────────

function getLossLog() {
  const config = getGlobalConfig()
  return config.companionXpLossLog ?? {
    totalLost: 0,
    lastLossDate: '',
    dailyLossToday: 0,
    dailyLossDate: '',
    solitarioCount: 0,
    lossesThisSession: 0,
  }
}

function saveLossLog(updater: (log: ReturnType<typeof getLossLog>) => ReturnType<typeof getLossLog>) {
  saveGlobalConfig(curr => ({
    ...curr,
    companionXpLossLog: updater(curr.companionXpLossLog ?? {
      totalLost: 0,
      lastLossDate: '',
      dailyLossToday: 0,
      dailyLossDate: '',
      solitarioCount: 0,
      lossesThisSession: 0,
    }),
  }))
}

function getTodayString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// ─── Protections ─────────────────────────────────────────────────────────────

function isStreakGuardActive(): boolean {
  return (getGlobalConfig().companionStreakCount ?? 0) >= 7
}

function isBugBuddyActive(): boolean {
  const shop = getGlobalConfig().companionShop
  return shop?.bugBuddyUnlocked ?? false
}

function isVeteranLuckActive(): boolean {
  const shop = getGlobalConfig().companionShop
  return shop?.veteranLuckUnlocked ?? false
}

// ─── Core Loss Function ──────────────────────────────────────────────────────

const LOSS_REACTIONS = [
  'Ops! Acho que eu errei... perdemos {xp} XP 😅',
  'Culpa minha! Perdemos {xp} XP, desculpa!',
  'Bug meu! -{xp} XP... vou tentar melhorar!',
  'Confusão aqui! -{xp} XP, mas a gente se recupera!',
  'Poxa, vacilei... -{xp} XP!',
]

const SOLITARIO_REACTIONS = [
  'Tô sozinho há {dias} dias... -{xp} XP 😢',
  'Saudades suas! Faz {dias} dias que não me visita... -{xp} XP',
  'Cadê você? Tô aqui sozinho há {dias} dias... -{xp} XP 😔',
]

const DAILY_LOSS_CAP = 10
const MAX_LOSS_PER_EVENT = 5

export type LossResult = {
  lost: boolean
  amount: number
  reaction: string | null
  blocked: boolean
}

export function tryLoseXp(trigger: 'bug_critico' | 'ferramenta_quebrada' | 'merge_conflict' | 'loop_infinito' | 'wrong_file' | 'buddy_solitario', context?: { days?: number }): LossResult {
  // 1. XP Shield blocks all losses
  if (isXpShieldActive()) {
    return { lost: false, amount: 0, reaction: null, blocked: true }
  }

  const log = getLossLog()
  const today = getTodayString()

  // 2. Reset daily counter if new day
  if (log.dailyLossDate !== today) {
    saveLossLog(curr => ({ ...curr, dailyLossToday: 0, dailyLossDate: today, lossesThisSession: 0 }))
  }

  // 3. Check daily cap
  const currentDaily = log.dailyLossDate === today ? log.dailyLossToday : 0
  if (currentDaily >= DAILY_LOSS_CAP) {
    return { lost: false, amount: 0, reaction: null, blocked: false }
  }

  // 4. Roll dice per trigger
  const chances: Record<string, number> = {
    bug_critico: 0.40,
    ferramenta_quebrada: 0.40,
    merge_conflict: 0.35,
    loop_infinito: 0.05,
    wrong_file: 0.15,
    buddy_solitario: 1.0,
  }

  if (Math.random() > (chances[trigger] ?? 0)) {
    return { lost: false, amount: 0, reaction: null, blocked: false }
  }

  // 5. Calculate base loss
  const ranges: Record<string, [number, number]> = {
    bug_critico: [0.5, 2],
    ferramenta_quebrada: [0.3, 1],
    merge_conflict: [1, 3],
    loop_infinito: [2, 5],
    wrong_file: [0.5, 1.5],
    buddy_solitario: [1, 5],
  }

  let [min, max] = ranges[trigger] ?? [0.5, 1]

  // Buddy Solitário escala com dias sem interação
  if (trigger === 'buddy_solitario' && context?.days) {
    const days = context.days
    if (days >= 10) { min = 5; max = 5 }
    else if (days >= 7) { min = 3; max = 3 }
    else if (days >= 3) { min = 2; max = 2 }
    else { min = 1; max = 1 }
  }

  let loss = min + Math.random() * (max - min)
  loss = Math.round(loss * 100) / 100

  // 6. Apply protections
  if (isStreakGuardActive()) {
    loss = Math.round(loss * 0.5 * 100) / 100
  }
  if (isBugBuddyActive() && ['bug_critico', 'ferramenta_quebrada', 'wrong_file'].includes(trigger)) {
    loss = Math.round(loss * 0.5 * 100) / 100
  }
  if (isVeteranLuckActive() && Math.random() < 0.1) {
    return { lost: false, amount: 0, reaction: null, blocked: true }
  }

  // 7. Cap per event
  loss = Math.min(loss, MAX_LOSS_PER_EVENT)

  // 8. Don't exceed daily cap
  const remaining = DAILY_LOSS_CAP - currentDaily
  loss = Math.min(loss, remaining)
  if (loss <= 0) return { lost: false, amount: 0, reaction: null, blocked: false }

  // 9. Deduct XP (never below 0)
  const config = getGlobalConfig()
  const currentXp = config.companion?.xp ?? 0
  const newXp = Math.max(0, Math.round((currentXp - loss) * 100) / 100)
  const actualLoss = Math.round((currentXp - newXp) * 100) / 100

  saveGlobalConfig(curr => ({
    ...curr,
    companion: curr.companion ? { ...curr.companion, xp: newXp } : undefined,
  }))

  // 10. Update log
  saveLossLog(curr => ({
    ...curr,
    totalLost: curr.totalLost + actualLoss,
    lastLossDate: today,
    dailyLossToday: (curr.dailyLossDate === today ? curr.dailyLossToday : 0) + actualLoss,
    dailyLossDate: today,
    lossesThisSession: curr.lossesThisSession + 1,
    solitarioCount: trigger === 'buddy_solitario' ? curr.solitarioCount + 1 : curr.solitarioCount,
  }))

  // 11. Build reaction
  let reaction: string
  if (trigger === 'buddy_solitario') {
    const template = SOLITARIO_REACTIONS[Math.floor(Date.now() / 1000) % SOLITARIO_REACTIONS.length]!
    reaction = template.replace('{xp}', actualLoss.toString()).replace('{dias}', (context?.days ?? 1).toString())
  } else {
    const template = LOSS_REACTIONS[Math.floor(Date.now() / 1000) % LOSS_REACTIONS.length]!
    reaction = template.replace('{xp}', actualLoss.toString())
  }

  return { lost: true, amount: actualLoss, reaction, blocked: false }
}

// ─── Buddy Solitário ─────────────────────────────────────────────────────────

export function checkBuddySolitario(): LossResult {
  const config = getGlobalConfig()
  const lastPetDate = config.companionLastPetDate
  if (!lastPetDate) return { lost: false, amount: 0, reaction: null, blocked: false }

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const [ly, lm, ld] = lastPetDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const lastDate = new Date(ly!, lm! - 1, ld)
  const todayDate = new Date(ty!, tm! - 1, td)
  const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays < 1) return { lost: false, amount: 0, reaction: null, blocked: false }

  return tryLoseXp('buddy_solitario', { days: diffDays })
}

// ─── Ability Helpers ─────────────────────────────────────────────────────────

export function getXpMultiplier(): number {
  let mult = 1
  const shop = getGlobalConfig().companionShop
  if (shop?.xpBoostUntil && shop.xpBoostUntil > Date.now()) mult *= 2
  if (shop?.xpMagnetUntil && shop.xpMagnetUntil > Date.now()) mult *= 1.25
  return mult
}

export function getXpLossLog() {
  return getLossLog()
}
