import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1o1ree11eGriGjv; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'brilliant_cut',
  candidateId: 'claude_sonnet',
  title: 'Brilliant Cut',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  displacement: 0.011,
  flavorText: 'Light enters as one white thought and leaves as a hundred colors, argued by eight polished faces.',
  placeholder: {
    color: hsl.integer(263, 100, 96),
    shading: 'glass',
  },
} as const satisfies KnotData
