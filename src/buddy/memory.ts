import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { hasAbility } from './shop.js'

const MAX_MEMORIES = 20
const MAX_MEMORIES_BOOSTED = 30

const MEMORY_TRIGGERS = {
  firstLevelUp: (level: number) => `Subiu para o Nível ${level} pela primeira vez!`,
  streak7: () => 'Alcançou 7 dias seguidos de uso!',
  streak30: () => 'Incrível! 30 dias seguidos!',
  bashes100: () => 'Completou 100 comandos bash!',
  tasks50: () => 'Concluiu 50 tasks!',
  easterEgg: () => 'Encontrou um bug brilhante!',
  reroll: () => 'Mudou de aparência com um reroll!',
  rename: (name: string) => `Recebeu o nome "${name}"!`,
  evolve: (from: string, to: string) => `Evoluiu de ${from} para ${to}!`,
  konami: () => 'Ativou o Konami Code!',
  petPremium: () => 'Ativou modo premium!',
  doubleRainbow: () => '🌈🌈 DOUBLE RAINBOW!',
  midnightEvolve: () => 'Evoluiu na meia-noite! Poder das trevas!',
  loopInfinite: () => 'Sobreviveu a um loop infinito!',
  answer42: () => 'Encontrou a resposta para tudo!',
  stoneageFirst: () => 'Ativou o stoneage pela primeira vez! Pedra afiada!',
  feedbackDetected: () => 'Feedback detectado e aprendido!',
} as const

export type MemoryTrigger = keyof typeof MEMORY_TRIGGERS

export function addMemory(trigger: MemoryTrigger, ...args: unknown[]): void {
  const config = getGlobalConfig()
  const existing = config.companionMemory ?? []

  const memoryFn = MEMORY_TRIGGERS[trigger]
  if (!memoryFn) return
  const text = (memoryFn as any)(...args)

  if (existing.some(m => m.text === text)) return

  const memory = {
    text,
    timestamp: Date.now(),
    trigger,
  }

  const max = hasAbility('memory-boost') ? MAX_MEMORIES_BOOSTED : MAX_MEMORIES
  const updated = [...existing, memory].slice(-max)

  saveGlobalConfig(curr => ({
    ...curr,
    companionMemory: updated,
  }))
}

export function getMemories(): Array<{ text: string; timestamp: number; trigger: string }> {
  const config = getGlobalConfig()
  return config.companionMemory ?? []
}

export function getRandomMemory(): string | null {
  const memories = getMemories()
  if (memories.length === 0) return null

  const memory = memories[Math.floor(Date.now() / 1000) % memories.length]!
  const date = new Date(memory.timestamp).toLocaleDateString('pt-BR')
  return `${memory.text} (${date})`
}
