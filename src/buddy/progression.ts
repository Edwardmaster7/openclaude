export type LevelBracket = {
  level: number
  minXp: number
  hat: string | undefined
  status: string
}

export const DEFAULT_LEVEL_BRACKETS: readonly LevelBracket[] = [
  { level: 1, minXp: 0, hat: undefined, status: 'Buddy is learning the workflow.' },
  { level: 2, minXp: 5, hat: 'beanie', status: 'Buddy is enjoying the progress!' },
  { level: 3, minXp: 25, hat: 'propeller', status: 'Buddy is hard at work!' },
  { level: 4, minXp: 50, hat: 'tophat', status: 'Buddy is cooking up code!' },
  { level: 5, minXp: 80, hat: 'wizard', status: 'Buddy has mastered the arts!' },
  { level: 6, minXp: 120, hat: 'pirate', status: 'Buddy is sailing the seas!' },
  { level: 7, minXp: 170, hat: 'halo', status: 'Buddy is angelic!' },
  { level: 8, minXp: 230, hat: 'tinyduck', status: 'Buddy has a tiny friend!' },
  { level: 9, minXp: 300, hat: 'chef', status: 'Buddy is a master chef!' },
  { level: 10, minXp: 400, hat: 'crown', status: 'Buddy is legendary!' },
] as const

export function getLevelInfo(
  xp = 0,
  brackets: readonly LevelBracket[] = DEFAULT_LEVEL_BRACKETS,
) {
  let currentBracket = brackets[0]!
  for (const bracket of brackets) {
    if (xp >= bracket.minXp) {
      currentBracket = bracket
    } else {
      break
    }
  }
  return currentBracket
}
