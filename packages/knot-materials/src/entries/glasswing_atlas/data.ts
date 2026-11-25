import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'glasswing_atlas',
  candidateId: 'space_bunny',
  title: 'Glasswing Atlas',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Transparent wings carry whole climates within every trembling pane.',
  placeholder: {
    color: hsl.integer(202, 43, 80),
    shading: 'glass',
  },
} as const satisfies KnotData
