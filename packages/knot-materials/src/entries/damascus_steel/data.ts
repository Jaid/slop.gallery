import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
export default {
  id: 'damascus_steel',
  candidateId: 'space_bunny',
  title: 'Damascus Steel',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A blade remembers every fold, carrying twilight through hammered steel.',
  placeholder: {
    color: hsl.integer(239, 16, 35),
    shading: 'metal',
  },
} as const satisfies KnotData
