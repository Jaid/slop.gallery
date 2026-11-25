import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5RXWnszENQQH6u3; fixture: knot-material-shaders; result: success.
export default {
  id: 'nightjar',
  candidateId: 'space_bunny',
  title: 'Nightjar',
  createdAt: 1_791_064_898,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'A bird that hunts by sound grew wings from a material older than feathers, then wore them down to a whisper.',
  placeholder: {
    color: hsl.integer(88, 11, 45),
    shading: 'fabric',
  },
} as const satisfies KnotData
