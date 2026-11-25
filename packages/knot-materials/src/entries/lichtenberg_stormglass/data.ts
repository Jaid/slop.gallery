import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'lichtenberg_stormglass',
  candidateId: 'grok',
  title: 'Lichtenberg Stormglass',
  createdAt: 1_789_231_507,
  harness: 'grok.com Build',
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'Glass holds the branching roots of a thunderstorm that never touched the ground.',
  placeholder: {
    color: hsl.integer(246, 100, 90.7),
    shading: 'glass',
  },
} as const satisfies KnotData
