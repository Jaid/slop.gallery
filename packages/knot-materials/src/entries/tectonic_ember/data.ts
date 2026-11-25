import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
export default {
  id: 'tectonic_ember',
  candidateId: 'space_bunny',
  title: 'Tectonic Ember',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Beneath the quiet stone, a sleeping ember listens to your orbit.',
  placeholder: {
    color: hsl.integer(44, 15, 25),
    shading: 'stone',
  },
} as const satisfies KnotData
