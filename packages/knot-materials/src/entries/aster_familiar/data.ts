import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 29lWdAQmWzVXPwF; fixture: knot-material-br11k.
export default {
  id: 'aster_familiar',
  candidateId: 'gpt_sol',
  title: 'Aster Familiar',
  createdAt: 1_790_327_078,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6 Sol',
      slug: 'openai/gpt-6-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'Between the last stars, small nocturnal gods stitch themselves together, blink at their witnesses and quietly follow them home.',
  placeholder: {
    color: hsl.integer(264, 72, 18),
    shading: 'fabric',
  },
} as const satisfies KnotData
