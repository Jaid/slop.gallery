import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Cp16WUQoUlMTqRD; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_lantern',
  candidateId: 'muse_wonder',
  title: 'Abyssal Lantern',
  createdAt: 1_791_848_243,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.016,
  flavorText: 'A gentle animal of glass drifts in the dark, carrying small violet suns along the seam of its one endless body.',
  placeholder: {
    color: hsl.integer(207, 40, 51),
    shading: 'glass',
  },
} as const satisfies KnotData
