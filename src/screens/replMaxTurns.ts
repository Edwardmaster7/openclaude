import { getGlobalConfig } from '../utils/config.js'

export const DEFAULT_REPL_MAX_TURNS = 50

export function resolveReplMaxTurns(maxTurns?: number): number {
  try {
    const config = getGlobalConfig()
    return maxTurns ?? config.replMaxTurns ?? DEFAULT_REPL_MAX_TURNS
  } catch {
    return maxTurns ?? DEFAULT_REPL_MAX_TURNS
  }
}
