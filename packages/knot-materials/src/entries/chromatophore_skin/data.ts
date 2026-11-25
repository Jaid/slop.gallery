import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'chromatophore_skin',
  candidateId: 'gpt_sol',
  title: 'Chromatophore Skin',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'Patterns surface and retreat like thoughts beneath a living hide.',
  placeholder: {
    color: hsl.integer(178, 92, 78),
    shading: 'smooth',
  },
  displacement: 0.014,
} as const satisfies KnotData
