import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'magnetic_bloom',
  candidateId: 'claude_sonnet',
  title: 'Magnetic Bloom',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  displacement: 0.09,
  flavorText: 'A black liquid remembers the pull of a distant magnet. Step closer and it rises in ranks of obedient thorns, all leaning toward you.',
  placeholder: {
    color: hsl.integer(278, 11, 15),
    shading: 'liquid',
  },
} as const satisfies KnotData
