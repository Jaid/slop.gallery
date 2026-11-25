import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 9YA8kP6cid9wkS5; fixture: knot-material-shaders.
// Original identity: kintsugi (Kintsugi).
export default {
  id: 'kintsugi_twilight',
  candidateId: 'space_bunny',
  title: 'Kintsugi Twilight',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'The dark remembers its breaking; gold is the light that chooses to stay.',
  placeholder: {
    color: hsl.integer(285, 37, 17),
    shading: 'smooth',
  },
} as const satisfies KnotData
