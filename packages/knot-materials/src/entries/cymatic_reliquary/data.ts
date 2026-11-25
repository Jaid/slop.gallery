import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'cymatic_reliquary',
  candidateId: 'space_bunny',
  title: 'Cymatic Reliquary',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Porcelain remembers every note, holding blue harmonics in its skin like winter rivers.',
  placeholder: {
    color: hsl.integer(209, 23, 78),
    shading: 'smooth',
  },
  displacement: 0.01,
} as const satisfies KnotData
