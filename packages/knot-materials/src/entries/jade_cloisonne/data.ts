import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'jade_cloisonne',
  candidateId: 'gemini_argon',
  title: 'Jade Cloisonné',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.009,
  flavorText: 'Bent brass cloisons hold pools of cobalt and imperial jade vitreous enamel over engine-turned silver leaf, glittering with aventurine and gilt rims.',
  placeholder: {
    color: hsl.integer(159, 12, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
