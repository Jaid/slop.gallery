import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 3gQGAbAm59HYY8k; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'raden_lacquer',
  candidateId: 'claude_haiku',
  title: 'Raden Lacquer',
  createdAt: 1_791_758_567,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Black urushi holds a field of abalone waves, each scallop cut from shell that drifts from jade to rose as you walk past the lacquer.',
  placeholder: {
    color: hsl.integer(273, 26, 6),
    shading: 'glass',
  },
} as const satisfies KnotData
