import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2b7SAOfgKTVu0qb; fixture: knot-material-shaders; result: success.
export default {
  id: 'fire_in_milk',
  candidateId: 'muse_wonder',
  title: 'Fire in Milk',
  createdAt: 1_791_848_912,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  flavorText: 'Precious fire sleeps in milk-white depths, waking in rainbow flashes only for the eye that finds its angle.',
  placeholder: {
    color: hsl.integer(165, 3, 86),
    shading: 'smooth',
  },
} as const satisfies KnotData
