import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: GsOIgdKyNa5oEPr; fixture: knot-material-shaders; result: success.
export default {
  id: 'golden_scar',
  candidateId: 'muse_wonder',
  title: 'Golden Scar',
  createdAt: 1_791_879_378,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'high',
    },
  },
  flavorText: 'Broken porcelain remembers its wounds in gold; circle it and every healed seam catches the light at once.',
  placeholder: {
    color: hsl.integer(85, 50, 76),
    shading: 'smooth',
  },
} as const satisfies KnotData
