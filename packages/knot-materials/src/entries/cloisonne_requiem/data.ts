import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: ActJg0bLJQHug14.
export default {
  id: 'cloisonne_requiem',
  candidateId: 'space_bunny',
  title: 'Cloisonné Requiem',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'Space Bunny Alpha',
      slug: 'stealth/space-bunny-alpha',
      effortLevel: 'max',
    },
  },
  flavorText: 'Gold remembers every fracture; the enamel answers in midnight blue.',
  placeholder: {
    color: hsl.integer(261, 77, 19),
    shading: 'smooth',
  },
} as const satisfies KnotData
