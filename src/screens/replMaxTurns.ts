import { getGlobalConfig } from '../utils/config.js'

// Default local interactive REPL cap. Configured via global config
// (config.replMaxTurns). 0 means "no limit".
export const DEFAULT_REPL_MAX_TURNS = 0

export function resolveReplMaxTurns(maxTurns?: number | null): number {
  const resolved = maxTurns ?? (() => {
    try {
      return getGlobalConfig().replMaxTurns
    } catch {
      return undefined
    }
  })() ?? DEFAULT_REPL_MAX_TURNS
  // 0, null, undefined all collapse to "no limit" — callers can disable
  // the cap by passing 0 or omitting the prop. Negative values fall back
  // to the default to keep backwards compatibility with any code that
  // passed -1 to mean "none".
  if (resolved === undefined || resolved === null || resolved < 1) {
    return Infinity
  }
  return resolved
}
