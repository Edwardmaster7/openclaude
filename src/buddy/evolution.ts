import {
  duck,
  goose,
  dragon,
  cat,
  chonk,
  lion,
  snail,
  turtle,
  crab,
  rabbit,
  capybara,
  bear,
  penguin,
  axolotl,
  octopus,
  blob,
  robot,
  ufo,
  sprout,
  mushroom,
  cactus,
  bat,
  owl,
  ghost,
} from './types.js'

// 8 cadeias de evolução lógicas (Tier 1 → Tier 2 → Tier 3)
export const EVOLUTION_CHAINS = [
  [duck, goose, dragon],        // Aves da Fúria (o meme)
  [cat, chonk, lion],           // A Realeza Felina
  [snail, turtle, crab],        // Esquadrão da Carapaça
  [rabbit, capybara, bear],     // Os Peludos da Paz
  [penguin, axolotl, octopus],  // Profundezas Aquáticas
  [blob, robot, ufo],           // Vida Artificial & Espacial
  [sprout, mushroom, cactus],   // Botânica de Sobrevivência
  [bat, owl, ghost],            // Criaturas da Noite
] as const

type Species = (typeof EVOLUTION_CHAINS)[number][number]

const chainBySpecies = new Map<string, readonly string[]>()
for (const chain of EVOLUTION_CHAINS) {
  for (const species of chain) {
    chainBySpecies.set(species, chain)
  }
}

const tierBySpecies = new Map<string, number>()
for (const chain of EVOLUTION_CHAINS) {
  tierBySpecies.set(chain[0], 1)
  tierBySpecies.set(chain[1], 2)
  tierBySpecies.set(chain[2], 3)
}

export function getEvolution(currentSpecies: string): string | null {
  const chain = chainBySpecies.get(currentSpecies)
  if (!chain) return null
  const idx = chain.indexOf(currentSpecies as Species)
  if (idx === -1 || idx === chain.length - 1) return null
  return chain[idx + 1]
}

export function getEvolutionChain(species: string): readonly string[] | null {
  return chainBySpecies.get(species) ?? null
}

export function getEvolutionTier(species: string): number {
  return tierBySpecies.get(species) ?? 0
}
