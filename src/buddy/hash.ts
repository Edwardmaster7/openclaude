// FNV-1a hash — shared by companion, observer, and buddy command.
export function hashString(s: string): number {
  if (typeof Bun !== 'undefined') {
    return Number(BigInt(Bun.hash(s)) & 0xffffffffn)
  }
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickDeterministic<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length]!
}
