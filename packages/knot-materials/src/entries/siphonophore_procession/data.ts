import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4AEfQg7Qgj1dEVQ; original ID: abyssal_siphonophore.
export default {
  id: 'siphonophore_procession',
  candidateId: 'gemini_flash',
  title: 'Siphonophore Procession',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'A colonial spirit of the deep ocean drifts through eternal black, waving prismatic comb plates and bioluminescent lures.',
  placeholder: {
    color: hsl.integer(226, 74, 27),
    shading: 'glass',
  },
} as const satisfies KnotData
