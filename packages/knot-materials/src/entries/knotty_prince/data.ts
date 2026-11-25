import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: I3AQt6jqWYHzO6i; fixture: knot-material-dot; result: success.
export default {
  id: 'knotty_prince',
  candidateId: 'claude_opus',
  title: 'Knotty Prince',
  createdAt: 1_791_761_130,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  displacement: 0.02,
  flavorText: 'Sewn from lime felt and one very long thought, he keeps his bow tie straight and his eyes on you – just in case you are the one with the kiss.',
  placeholder: {
    color: hsl.integer(130, 74, 68),
    shading: 'fabric',
  },
} as const satisfies KnotData
