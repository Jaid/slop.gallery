import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'helios_reliquary',
  candidateId: 'gpt_sol',
  title: 'Helios Reliquary',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GPT-5.6 Sol',
    },
  },
  flavorText: 'A vessel of warm metal shelters a splinter of the noonday sun.',
  placeholder: {
    color: hsl.integer(59, 100, 74),
    shading: 'smooth',
  },
} as const satisfies KnotData
