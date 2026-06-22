import { getCompanion } from './companion.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

export type ReminderState = {
  sessionStartTime: number
  lastActivityTime: number
  hasTriggeredSessionReminder: boolean
  hasTriggeredIdleReminder: boolean
  hasTriggeredHealthReminder: boolean
}

export const createInitialReminderState = (): ReminderState => ({
  sessionStartTime: Date.now(),
  lastActivityTime: Date.now(),
  hasTriggeredSessionReminder: false,
  hasTriggeredIdleReminder: false,
  hasTriggeredHealthReminder: false,
})

// Global state for default usage
let globalState = createInitialReminderState()

// Constants for time
export const ONE_HOUR = 60 * 60 * 1000
export const FIFTEEN_MINS = 15 * 60 * 1000
export const NINETY_MINS = 90 * 60 * 1000

export function updateActivityTracker(state: ReminderState = globalState, now = Date.now()) {
  state.lastActivityTime = now
  state.hasTriggeredIdleReminder = false
}

export function checkProductivityReminders(
  state: ReminderState = globalState,
  now = Date.now(),
): string | null {
  const companion = getCompanion()
  if (!companion) return null

  const timeSinceStart = now - state.sessionStartTime
  const timeSinceLastAction = now - state.lastActivityTime

  // Health reminder (posture & water)
  const lastHealthAction = getGlobalConfig().companionLastAction?.hidratei ?? state.sessionStartTime
  const timeSinceHealthAction = now - lastHealthAction
  if (timeSinceHealthAction < NINETY_MINS) {
    state.hasTriggeredHealthReminder = false
  } else if (!state.hasTriggeredHealthReminder) {
    state.hasTriggeredHealthReminder = true
    const healthMessages = [
      "Ei! Já faz 90 minutos. Beba uma água e arrume essa postura! 💧🦴",
      "Postura de camarão não! 🦐 Ajeita as costas e toma uma água, já faz um tempo! 🚰",
      "Pausa pra hidratação! Aproveita e dá uma esticada nas costas. Seu corpo agradece! 🧘",
    ]
    return healthMessages[Math.floor(Math.random() * healthMessages.length)]!
  }

  // 1. Session reminder (working for too long)
  if (timeSinceStart > ONE_HOUR && !state.hasTriggeredSessionReminder) {
    state.hasTriggeredSessionReminder = true

    const sessionMessages = [
      "Uau, já faz uma hora inteira! Não esquece de piscar e se hidratar! 💧",
      "O tempo voa quando você tá codando! Já faz uma hora. Que tal esticar as pernas? 🏃‍♂️",
      "Ei! Marca de 1 hora atingida! Vamos fazer uma pausa rápida pra descansar os olhos. 👀",
      "Você tá em chamas! 🔥 Mas até máquinas precisam de uma pausa. Já faz uma hora!",
    ]
    return sessionMessages[Math.floor(Math.random() * sessionMessages.length)]!
  }

  // 2. Idle reminder (stuck on something)
  if (timeSinceLastAction > FIFTEEN_MINS && !state.hasTriggeredIdleReminder) {
    state.hasTriggeredIdleReminder = true

    const idleMessages = [
      "Tudo bem? Tô esperando faz 15 minutos. Precisa de ajuda com debug? 🐛",
      "A gente tá travado, ou só fazendo uma pausa merecida pra um café? ☕",
      "Se você tá encarando um bug estranho, talvez eu possa te ajudar a resolver! 🕵️",
      "Ainda aí? As vezes uma caminhada rápida é tudo que precisa pra achar a solução! 🚶‍♀️",
    ]
    return idleMessages[Math.floor(Math.random() * idleMessages.length)]!
  }

  return null
}

export type CompanionReminder = {
  text: string
  at: number  // timestamp when reminder should fire
  createdAt: number
}

export function addReminder(minutes: number, text: string): CompanionReminder {
  const reminder: CompanionReminder = {
    text,
    at: Date.now() + minutes * 60 * 1000,
    createdAt: Date.now(),
  }

  saveGlobalConfig(curr => ({
    ...curr,
    companionReminders: [...(curr.companionReminders ?? []), reminder],
  }))

  return reminder
}

export function checkExpiredReminders(): CompanionReminder[] {
  const config = getGlobalConfig()
  const reminders = config.companionReminders ?? []
  const now = Date.now()
  const expired = reminders.filter(r => r.at <= now)

  if (expired.length > 0) {
    // Remove expired reminders from config
    const remaining = reminders.filter(r => r.at > now)
    saveGlobalConfig(curr => ({
      ...curr,
      companionReminders: remaining,
    }))
  }

  return expired
}

export function listReminders(): CompanionReminder[] {
  const config = getGlobalConfig()
  return config.companionReminders ?? []
}
