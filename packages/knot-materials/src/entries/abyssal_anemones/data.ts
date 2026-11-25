import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: Am1BnNRHvHbHCa2; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_anemones',
  candidateId: 'muse_wonder',
  title: 'Abyssal Anemones',
  createdAt: 1_791_867_537,
  harness: 'Mage',
  author: {
    model: {
      title: 'Muse Wonder 1.0',
      slug: 'meta/muse-wonder-1.0',
      effortLevel: 'max',
    },
  },
  displacement: 0.07,
  flavorText: 'Ten thousand patient mouths breathe in the dark, and a slow tide of light passes from lip to lip, asking each one to open.',
  placeholder: {
    color: hsl.integer(253, 69, 11),
    shading: 'glass',
  },
} as const satisfies KnotData
