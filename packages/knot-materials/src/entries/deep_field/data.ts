import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'deep_field',
  candidateId: 'mimo',
  title: 'Deep Field',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A window cut into the deep field: ten thousand suns behind the glass, sliding past one another as you walk.',
  placeholder: {
    color: hsl.integer(263, 45, 7),
    shading: 'glass',
  },
} as const satisfies KnotData
