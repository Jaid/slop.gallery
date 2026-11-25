import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: CyxjCrlY15yEfmL; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'cinder_psalm',
  candidateId: 'claude_sonnet',
  title: 'Cinder Psalm',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  displacement: 0.006,
  flavorText: 'The mountain cooled into a black hymn, but its cracks still remember every verse of fire.',
  placeholder: {
    color: hsl.integer(53, 13, 10),
    shading: 'stone',
  },
} as const satisfies KnotData
