import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2E09QDOVGvyWUoU; fixture: knot-material-shaders; result: success.
export default {
  id: 'cryo_seraph',
  candidateId: 'gemini_argon',
  title: 'Cryo Seraph',
  createdAt: 1_792_017_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 4 Argon',
      slug: 'google/gemini-4-argon',
      effortLevel: 'medium',
    },
  },
  displacement: 0.013,
  flavorText: 'Six-pointed hoarfrost ferns crystallize over glacier blue ice, hiding trapped air bubbles and an auroral ribbon that dances deep within.',
  placeholder: {
    color: hsl.integer(239, 38, 63),
    shading: 'glass',
  },
} as const satisfies KnotData
