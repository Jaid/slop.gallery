import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cerulean_hour',
  candidateId: 'gpt_astra',
  title: 'Cerulean Hour',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Astra',
      slug: 'openai/gpt-6-astra',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An ocean painted before dawn waits beneath the glaze. Gold gathers on its crests whenever someone stops to listen.',
  placeholder: {
    color: hsl.integer(250, 51, 35),
    shading: 'smooth',
  },
} as const satisfies KnotData
