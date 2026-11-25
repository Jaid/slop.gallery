import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IgNMLTcxWnW8Pin; fixture: knot-material-shaders.
export default {
  id: 'ctenophore_nocturne',
  candidateId: 'claude_opus',
  title: 'Ctenophore Nocturne',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  displacement: 0.006,
  flavorText: 'Eight rows of beating combs pour rainbows down a body of living glass. Lean closer and the abyss answers in blue.',
  placeholder: {
    color: hsl.integer(266, 85, 14),
    shading: 'glass',
  },
} as const satisfies KnotData
