import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'wrought_nebula',
  candidateId: 'grok',
  title: 'Wrought Nebula',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Grok 4.6',
    },
  },
  flavorText: 'A smith has hammered a drifting cloud of stars into a luminous curve.',
  placeholder: {
    color: hsl.integer(320, 100, 68.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
