// Default per-prompt cap for every local interactive REPL entrypoint.
// 0 (or undefined) means "no limit" — pass any positive int to cap turns.
// Headless and SDK callers retain their explicit maxTurns contracts.
export const DEFAULT_REPL_MAX_TURNS = 0

export function resolveReplMaxTurns(maxTurns?: number | null): number {
  // 0, null, undefined all collapse to "no limit" — callers can disable
  // the cap by passing 0 or omitting the prop. Negative values fall back
  // to the default to keep backwards compatibility with any code that
  // passed -1 to mean "none".
  if (maxTurns === undefined || maxTurns === null || maxTurns < 1) {
    return Infinity
  }
  return maxTurns
}
