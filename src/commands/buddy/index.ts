import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch, pet, and manage your OpenClaude companion',
  immediate: true,
  argumentHint: '[status|mute|unmute|compact|decompact|preview|rename|reroll|brincar|alimentar|hidratei|quests|stats|outfits|equipar|chapeu|resumo|lembrar|memorias|evolve|requisitos|pet premium|achievements|journal|help]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
