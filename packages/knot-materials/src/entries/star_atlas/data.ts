import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'star_atlas',
  candidateId: 'kimi',
  title: 'Star Atlas',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'A map of distant lights rearranges its bearings as the viewer moves.',
  placeholder: {
    color: hsl.integer(92, 100, 92.7),
    shading: 'smooth',
  },
} as const satisfies KnotData
