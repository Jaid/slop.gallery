import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'pawlight_atlas',
  candidateId: 'space_bunny',
  title: 'Pawlight Atlas',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Tiny stars gather into purring silhouettes, mapping a kingdom that exists only after dark.',
  placeholder: {
    color: hsl.integer(270, 58, 12),
    shading: 'smooth',
  },
} as const satisfies KnotData
