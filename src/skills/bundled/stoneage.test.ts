import { expect, test } from 'bun:test'

// Mock MACRO global used during getBundledSkillsRoot
;(globalThis as any).MACRO = { VERSION: '1.0.0' }

import { getBundledSkills } from '../bundledSkills.js'
import { initBundledSkills } from './index.js'

test('all 14 stoneage and token-economy skills are registered as bundled skills', () => {
  // Inicializa todas as skills bundled
  initBundledSkills()

  const skills = getBundledSkills()
  const skillNames = skills.map(s => s.name)

  const expectedSkills = [
    'stoneage',
    'token-economy',
    'answer-first',
    'code-only',
    'silent-tools',
    'task-batch',
    'context-trim',
    'memory-prune',
    'session-budget',
    'stoneage-commit',
    'stoneage-compress',
    'stoneage-help',
    'stoneage-review',
    'stoneage-stats'
  ]

  for (const expected of expectedSkills) {
    expect(skillNames).toContain(expected)
  }
})
