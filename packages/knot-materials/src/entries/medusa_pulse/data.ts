import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1o1ree11eGriGjv; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'medusa_pulse',
  candidateId: 'claude_sonnet',
  title: 'Medusa Pulse',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  displacement: 0.02,
  flavorText: 'Somewhere in the dark, a body made of water is thinking in light – one slow heartbeat at a time.',
  placeholder: {
    color: hsl.integer(284, 93, 40.5),
    shading: 'glass',
  },
} as const satisfies KnotData
