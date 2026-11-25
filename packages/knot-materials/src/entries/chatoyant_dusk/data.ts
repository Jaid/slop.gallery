import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1o1ree11eGriGjv; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'chatoyant_dusk',
  candidateId: 'claude_sonnet',
  title: 'Chatoyant Dusk',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'A thousand golden fibers hold one thin line of sunset, and it walks along the stone wherever you do.',
  placeholder: {
    color: hsl.integer(68, 90, 56),
    shading: 'stone',
  },
} as const satisfies KnotData
