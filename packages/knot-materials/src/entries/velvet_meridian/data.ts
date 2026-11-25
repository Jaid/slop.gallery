import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'velvet_meridian',
  candidateId: 'space_bunny',
  title: 'Velvet Meridian',
  createdAt: 1_790_309_623,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Midnight silk folds around an invisible horizon, its woven threads catching a violet dawn.',
  placeholder: {
    color: hsl.integer(302, 62, 13),
    shading: 'fabric',
  },
  displacement: 0.016,
} as const satisfies KnotData
