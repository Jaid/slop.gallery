import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ; original ID: scarab_chitin.
export default {
  id: 'scarab_armor',
  candidateId: 'gemini_flash',
  title: 'Scarab Armor',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Interlocking plates of tempered chitin deflect the light with microscopic grooves, shimmering between emerald and royal amethyst.',
  placeholder: {
    color: hsl.integer(169, 77, 42),
    shading: 'metal',
  },
} as const satisfies KnotData
