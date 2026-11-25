import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'dragon_opal',
  candidateId: 'kimi',
  title: 'Dragon Opal',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'A sleeping creature turns once beneath a shell of shifting fire.',
  placeholder: {
    color: hsl.integer(333, 100, 79),
    shading: 'glass',
  },
} as const satisfies KnotData
