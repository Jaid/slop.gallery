import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: NKvaWYy8hA4AWQ9.
export default {
  id: 'clockwork_eclipse',
  candidateId: 'grok',
  title: 'Clockwork Eclipse',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Brass teeth counting a darker orbit, bright only where the shadow lifts.',
  placeholder: {
    color: hsl.integer(70, 56, 55),
    shading: 'metal',
  },
} as const satisfies KnotData
