import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'vesper_rose',
  candidateId: 'mimo',
  title: 'Vesper Rose',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'MiMo V2.6 Pro',
      slug: 'xiaomi/mimo-v2.6-pro',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Color and patient fire, caged in lead and bent into a loop. Walk past, and the vespers follow you through the panes.',
  placeholder: {
    color: hsl.integer(323, 18, 45),
    shading: 'glass',
  },
} as const satisfies KnotData
