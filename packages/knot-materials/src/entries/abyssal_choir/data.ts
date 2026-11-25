import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2b7SAOfgKTVu0qb; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_choir',
  candidateId: 'muse_wonder',
  title: 'Abyssal Choir',
  createdAt: 1_791_848_912,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.006,
  flavorText: 'Photophores kindle in slow procession along a deep-sea skin, singing light into the dark as you draw near.',
  placeholder: {
    color: hsl.integer(222, 51, 30),
    shading: 'smooth',
  },
} as const satisfies KnotData
