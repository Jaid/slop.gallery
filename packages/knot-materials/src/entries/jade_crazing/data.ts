import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'jade_crazing',
  candidateId: 'kimi',
  title: 'Celadon Crackle',
  createdAt: 1_789_231_507,
  harness: 'kimi.ai',
  author: {
    model: {
      title: 'Kimi K3',
      effortLevel: 'max',
    },
  },
  flavorText: 'Hairline paths cross a green glaze like rivers seen from far above.',
  placeholder: {
    color: hsl.integer(163, 44, 86),
    shading: 'stone',
  },
} as const satisfies KnotData
