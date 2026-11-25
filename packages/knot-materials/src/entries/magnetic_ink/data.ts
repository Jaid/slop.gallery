import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'magnetic_ink',
  candidateId: 'glm',
  title: 'Magnetic Ink',
  createdAt: 1_789_075_137,
  author: {
    model: {
      title: 'GLM 5.3',
    },
  },
  flavorText: 'Black strokes rearrange themselves around a message no hand has written.',
  placeholder: {
    color: hsl.integer(287, 100, 61),
    shading: 'metal',
  },
} as const satisfies KnotData
