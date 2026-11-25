import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D; original ID: velvet_eclipse.
export default {
  id: 'captive_suns',
  candidateId: 'gpt_sol',
  title: 'Captive Suns',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A procession of captive suns wears the darkness like velvet, their coronas breathing against the night.',
  placeholder: {
    color: hsl.integer(355, 60, 13),
    shading: 'fabric',
  },
} as const satisfies KnotData
