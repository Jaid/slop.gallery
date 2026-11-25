import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: MDsU2CH3XEff3jd; fixture: knot-material-shaders; result: success.
export default {
  id: 'kintsugi_embers',
  candidateId: 'space_bunny',
  title: 'Kintsugi Embers',
  createdAt: 1_790_868_534,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  displacement: 0.0035,
  flavorText: 'The bowl was broken and mended so carefully that the light now prefers the scar; a slow warmth still travels the length of the gold.',
  placeholder: {
    color: hsl.integer(13, 43, 7.5),
    shading: 'smooth',
  },
} as const satisfies KnotData
