import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IBraVE33noBp60D.
export default {
  id: 'amber_aeons',
  candidateId: 'gpt_sol',
  title: 'Amber Aeons',
  createdAt: 1_790_311_863,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'In honey-colored time, the vanished sea keeps its spiral souls suspended just beneath the surface.',
  placeholder: {
    color: hsl.integer(65, 84, 68),
    shading: 'glass',
  },
} as const satisfies KnotData
