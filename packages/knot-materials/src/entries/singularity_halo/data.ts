import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'singularity_halo',
  candidateId: 'claude_opus',
  title: 'Singularity Halo',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A forgotten singularity bent into a knot; its photon ring is the last light that refused to fall.',
  placeholder: {
    color: hsl.integer(295, 56, 11),
    shading: 'smooth',
  },
} as const satisfies KnotData
