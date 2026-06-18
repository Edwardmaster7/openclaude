import type { Command } from '../../commands.js'
const feedback = {
  type: 'local',
  name: 'feedback',
  description: `Gerencia e revisa os feedbacks e aprendizados aprendidos em memória pelo agente`,
  argumentHint: '[confirm | list | review | ignore | synthesize | clear | reset]',
  isEnabled: () => true,
  supportsNonInteractive: true,
  load: () => import('./feedback.js'),
} satisfies Command

export default feedback
