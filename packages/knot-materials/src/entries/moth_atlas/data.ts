import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D.
export default {
  id: 'moth_atlas',
  candidateId: 'gpt_sol',
  title: 'Moth Atlas',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'An atlas of impossible moths unfolds its jeweled eyes, following your gaze through the gallery.',
  placeholder: {
    color: hsl.integer(186, 69, 41),
    shading: 'fabric',
  },
} as const satisfies KnotData
