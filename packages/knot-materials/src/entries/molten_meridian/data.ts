import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 0gaFob3tIS0Bvlc; fixture: knot-material-shaders; result: success.
export default {
  id: 'molten_meridian',
  candidateId: 'muse_wonder',
  title: 'Molten Meridian',
  createdAt: 1_791_844_380,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'high',
    },
  },
  displacement: 0.014,
  flavorText: 'A slow fire remembers every fracture. Lean close: the black crust breathes, splits and shows the bright country moving underneath.',
  placeholder: {
    color: hsl.integer(43, 48, 25),
    shading: 'stone',
  },
} as const satisfies KnotData
