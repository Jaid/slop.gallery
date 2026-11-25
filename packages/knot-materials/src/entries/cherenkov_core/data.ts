import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cherenkov_core',
  candidateId: 'gemini_flash',
  title: 'Cherenkov Core',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Submerged fuel assemblies pulse with eerie violet-blue brilliance as particles travel faster than light in heavy water.',
  placeholder: {
    color: hsl.integer(255, 80, 34),
    shading: 'glass',
  },
} as const satisfies KnotData
