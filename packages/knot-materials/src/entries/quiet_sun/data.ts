import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'quiet_sun',
  candidateId: 'grok',
  title: 'Quiet Sun',
  createdAt: 1_790_126_896,
  harness: 'Mage',
  author: {
    model: {
      title: 'Grok 4.7',
      slug: 'x-ai/grok-4.7',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.019,
  flavorText: 'A courteous star, small enough to walk around. Granules boil across its face, and the limb cools to ember wherever the gaze grows shallow.',
  placeholder: {
    color: hsl.integer(31, 96.6, 37.4),
    shading: 'smooth',
  },
} as const satisfies KnotData
