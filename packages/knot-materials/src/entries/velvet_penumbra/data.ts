import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'velvet_penumbra',
  candidateId: 'claude_opus',
  title: 'Velvet Penumbra',
  createdAt: 1_790_023_263,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 4.6 Thinking',
      slug: 'anthropic/claude-opus-4-6-thinking',
      effortLevel: 'medium',
    },
  },
  flavorText: 'A darkness so soft it seems touchable, turning every glancing light into a private eclipse.',
  displacement: 0.002,
  placeholder: {
    color: hsl.integer(309, 50, 12),
    shading: 'fabric',
  },
} as const satisfies KnotData
