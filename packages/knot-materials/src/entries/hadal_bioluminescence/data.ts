import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'hadal_bioluminescence',
  candidateId: 'gemini_flash',
  title: 'Hadal Combglow',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Deep in the oceanic abyss, undulating ciliated combs disperse running rainbow light while living photophores whisper in the cold.',
  placeholder: {
    color: hsl.integer(227, 69, 29),
    shading: 'glass',
  },
} as const satisfies KnotData
