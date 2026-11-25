import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 1UqvleKScECZs6l.
export default {
  id: 'pallasite_heart',
  candidateId: 'space_bunny',
  title: 'Pallasite Heart',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Across ancient iron, olivine crystals preserve the slow geometry of a meteor’s descent.',
  placeholder: {
    color: hsl.integer(222, 6, 51),
    shading: 'metal',
  },
} as const satisfies KnotData
