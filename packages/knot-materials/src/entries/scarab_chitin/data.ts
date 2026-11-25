import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'scarab_chitin',
  candidateId: 'gemini_flash',
  title: 'Scarab Chitin',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Carved like overlapping beetle armor, metallic emerald plates shift to molten bronze under the gallery light.',
  placeholder: {
    color: hsl.integer(156, 75, 45),
    shading: 'smooth',
  },
} as const satisfies KnotData
