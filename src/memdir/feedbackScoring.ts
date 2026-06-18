export type ScoreChangeType = 'error' | 'correction' | 'success' | 'synthesis'

export const SCORE_LIMITS = {
  MIN: 0,
  MAX: 100,
  INITIAL: 50,
  CRITICAL: 80,
  STALE: 20,
} as const

export const SCORE_CHANGES: Record<ScoreChangeType, number> = {
  error: -10,      // Tool failure, undo, revert
  correction: -5,  // User explicitly corrected behavior (constructive feedback)
  success: 5,      // Turn completed without error/undo
  synthesis: 3,    // Freshly synthesized theme/pattern
}

/**
 * Calculates the new score after applying a reinforcement change,
 * clamping the result between 0 and 100.
 */
export function calculateScore(currentScore: number, change: ScoreChangeType): number {
  const delta = SCORE_CHANGES[change]
  const newScore = currentScore + delta
  return Math.min(SCORE_LIMITS.MAX, Math.max(SCORE_LIMITS.MIN, newScore))
}
