import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
export default {
  id: 'abyssal_coral',
  candidateId: 'space_bunny',
  title: 'Abyssal Coral',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'In the midnight garden, small hearts answer the current with cold fire.',
  placeholder: {
    color: hsl.integer(222, 72, 19),
    shading: 'stone',
  },
  displacement: 0.0023,
} as const satisfies KnotData
