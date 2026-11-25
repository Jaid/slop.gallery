import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'saffron_cathedral',
  candidateId: 'gpt_astra',
  title: 'Saffron Cathedral',
  createdAt: 1_789_075_137,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6 Astra',
    },
  },
  flavorText: 'Golden warmth fills a small sanctuary carved from the colors of spice.',
  placeholder: {
    color: hsl.integer(78, 100, 82.6),
    shading: 'smooth',
  },
} as const satisfies KnotData
