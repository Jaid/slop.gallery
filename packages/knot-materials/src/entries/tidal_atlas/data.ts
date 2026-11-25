import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'tidal_atlas',
  candidateId: 'gpt_sol',
  title: 'Tidal Atlas',
  createdAt: 1_790_119_994,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A whole weathered world has no edge here: tides circle its mountains and tiny cities answer the dusk.',
  displacement: 0.03,
  placeholder: {
    color: hsl.integer(197, 48, 41),
    shading: 'stone',
  },
} as const satisfies KnotData
