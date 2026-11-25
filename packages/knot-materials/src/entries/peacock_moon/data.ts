import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'peacock_moon',
  candidateId: 'space_bunny',
  title: 'Peacock Moon',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A thousand feathered eyes open as the metal moon turns, each revealing another constellation.',
  placeholder: {
    color: hsl.integer(207, 93, 41),
    shading: 'metal',
  },
  displacement: 0.008,
} as const satisfies KnotData
