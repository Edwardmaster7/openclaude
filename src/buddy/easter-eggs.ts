import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'

export type EasterEggResult = {
  triggered: boolean
  message?: string
  xpBonus?: number
  memoryTrigger?: string
}

// ─── 1. Konami Code ─────────────────────────────────────────────────────────

const KONAMI_SEQUENCE = 'upupdowndownleftrightleftrightba'

export function checkKonamiCode(input: string, konamiUsed?: boolean): EasterEggResult {
  if (konamiUsed) return { triggered: false }
  const lower = input.toLowerCase().slice(-KONAMI_SEQUENCE.length)
  if (lower === KONAMI_SEQUENCE) {
    return {
      triggered: true,
      message: '↑↑↓↓←→←→BA... A CHEAT CODE! +10 XP!',
      xpBonus: 10,
      memoryTrigger: 'konami',
    }
  }
  return { triggered: false }
}

// ─── 2. Shiny Bug ───────────────────────────────────────────────────────────

export function checkShinyBug(): EasterEggResult {
  if (Math.random() < 0.005) {
    return {
      triggered: true,
      message: 'encontrou um bug brilhante escondido! +5 XP bonus!',
      xpBonus: 5,
      memoryTrigger: 'easterEgg',
    }
  }
  return { triggered: false }
}

// ─── 3. Resposta 42 ─────────────────────────────────────────────────────────

export function checkAnswer42(lastMessage: string): EasterEggResult {
  if (/\b42\s*[.!?,;:)}\]]?\s*$/m.test(lastMessage)) {
    return {
      triggered: true,
      message: 'A resposta para a vida, o universo e tudo mais! 42!',
      xpBonus: 3,
      memoryTrigger: 'answer42',
    }
  }
  return { triggered: false }
}

// ─── 4. Midnight Hatch ──────────────────────────────────────────────────────

export function checkMidnightHatch(hatchedAt: number): EasterEggResult {
  const hour = new Date(hatchedAt).getHours()
  if (hour >= 0 && hour < 1) {
    return {
      triggered: true,
      message: 'Nasceu na meia-noite... é um fantasma especial!',
    }
  }
  return { triggered: false }
}

// ─── 5. Loop Infinito ───────────────────────────────────────────────────────

export function checkLoopInfinite(recentCommands: string[]): EasterEggResult {
  if (recentCommands.length >= 3) {
    const last3 = recentCommands.slice(-3)
    if (last3[0] === last3[1] && last3[1] === last3[2]) {
      return {
        triggered: true,
        message: 'Tô preso num loop infinito! Me tira daqui! 😵‍💫',
        xpBonus: 2,
        memoryTrigger: 'loopInfinite',
      }
    }
  }
  return { triggered: false }
}

// ─── 6. Double Rainbow ──────────────────────────────────────────────────────

export function checkDoubleRainbow(shiny: boolean, activeOutfit: string | null): EasterEggResult {
  if (shiny && activeOutfit === 'arco-iris') {
    return {
      triggered: true,
      message: 'DOUBLE RAINBOW! 🌈🌈 Que espetáculo!',
      xpBonus: 20,
      memoryTrigger: 'doubleRainbow',
    }
  }
  return { triggered: false }
}

// ─── 7. Midnight Evolve ─────────────────────────────────────────────────────

export function checkMidnightEvolve(): EasterEggResult {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 1) {
    return {
      triggered: true,
      message: 'Evoluiu na meia-noite... poder das trevas! +10 XP bônus!',
      xpBonus: 10,
      memoryTrigger: 'midnightEvolve',
    }
  }
  return { triggered: false }
}
