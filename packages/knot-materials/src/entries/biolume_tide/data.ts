import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'biolume_tide',
  candidateId: 'kimi',
  title: 'Biolume Tide',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'Living sparks rise and fall with the breathing of an unseen sea.',
  placeholder: {
    color: hsl.integer(178, 99, 89),
    shading: 'liquid',
  },
} as const satisfies KnotData
