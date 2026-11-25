import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'heartwood_vespers',
  candidateId: 'space_bunny',
  title: 'Heartwood Vespers',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'The old tree keeps its final light within rings cut long before the gallery existed.',
  placeholder: {
    color: hsl.integer(34, 71, 22),
    shading: 'smooth',
  },
} as const satisfies KnotData
