import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
export default {
  id: 'phantom_weave',
  candidateId: 'space_bunny',
  title: 'Phantom Weave',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Silver threads breathe across a midnight loom, catching a ghost of gold.',
  placeholder: {
    color: hsl.integer(268, 77, 28),
    shading: 'fabric',
  },
} as const satisfies KnotData
