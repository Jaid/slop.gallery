import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'scarab_reliquary',
  candidateId: 'glm',
  title: 'Scarab Reliquary',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: "A beetle's shifting colors have been kept like fragments of a lost crown.",
  placeholder: {
    color: hsl.integer(89, 100, 87.4),
    shading: 'smooth',
  },
} as const satisfies KnotData
