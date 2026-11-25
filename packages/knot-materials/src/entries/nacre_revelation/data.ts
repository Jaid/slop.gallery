import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'nacre_revelation',
  candidateId: 'space_bunny',
  title: 'Nacre Revelation',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Layered mother-of-pearl turns the smallest turn of the eye into a quiet aurora.',
  placeholder: {
    color: hsl.integer(205, 21, 77),
    shading: 'smooth',
  },
  displacement: 0.003,
} as const satisfies KnotData
