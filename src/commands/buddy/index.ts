import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch, pet, and manage your OpenClaude companion',
  immediate: true,
  argumentHint: '[status|mute|unmute|compact|decompact|rename|reroll|brincar|alimentar|resumo|lembrar|memorias|stats|outfits|equipar|chapeu|preview|help]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
