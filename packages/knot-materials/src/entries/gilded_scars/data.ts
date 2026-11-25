import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'gilded_scars',
  candidateId: 'mimo',
  title: 'Gilded Scars',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Porcelain taught itself to break, and gold taught it to sing again. The seams shine where the light gets out.',
  placeholder: {
    color: hsl.integer(157, 26, 68),
    shading: 'smooth',
  },
} as const satisfies KnotData
