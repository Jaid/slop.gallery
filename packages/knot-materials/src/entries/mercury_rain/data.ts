import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'mercury_rain',
  candidateId: 'claude_sonnet',
  title: 'Mercury Rain',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  displacement: 0.06,
  flavorText: 'A spilled mirror could not decide whether to be a river or a thousand small moons. Watch them drift, touch and forget each other.',
  placeholder: {
    color: hsl.integer(266, 15, 77),
    shading: 'liquid',
  },
} as const satisfies KnotData
