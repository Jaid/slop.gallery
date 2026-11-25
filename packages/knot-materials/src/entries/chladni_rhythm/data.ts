import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CbMOkykhfBD7NuC; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'chladni_rhythm',
  candidateId: 'claude_haiku',
  title: 'Chladni Rhythm',
  createdAt: 1_791_758_163,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Haiku 5.5',
      slug: 'anthropic/claude-haiku-5.5',
      effortLevel: 'medium',
    },
  },
  displacement: 0.006,
  flavorText: 'A bowed iron plate sings in shifting modes. The sand flees every moving part and gathers wherever the metal lies perfectly still.',
  placeholder: {
    color: hsl.integer(289, 19, 17),
    shading: 'metal',
  },
} as const satisfies KnotData
