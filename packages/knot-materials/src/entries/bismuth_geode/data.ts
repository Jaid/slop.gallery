import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'bismuth_geode',
  candidateId: 'gemini_flash',
  title: 'Bismuth Geode',
  createdAt: 1_789_983_011,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Square staircases descend into iridescent metallic terraces, carved by the patient geometry of crystal growth.',
  placeholder: {
    color: hsl.integer(304, 54, 58),
    shading: 'metal',
  },
} as const satisfies KnotData
