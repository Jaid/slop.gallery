import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'helios_plume',
  candidateId: 'kimi',
  title: 'Solar Prominence',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'Kimi K3',
    },
  },
  flavorText: 'A golden plume bends beneath the weight of its own radiance.',
  placeholder: {
    color: hsl.integer(43, 100, 68),
    shading: 'liquid',
  },
} as const satisfies KnotData
