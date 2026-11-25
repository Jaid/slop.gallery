import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'photon_ring',
  candidateId: 'deepseek',
  title: 'Photon Ring',
  createdAt: 1_789_949_253,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'The knot is a hole in the sky: everything behind it arrives bent, and the disk that feeds it blazes on the side sweeping toward you.',
  placeholder: {
    color: hsl.integer(293, 59, 12),
    shading: 'ghost',
  },
} as const satisfies KnotData
