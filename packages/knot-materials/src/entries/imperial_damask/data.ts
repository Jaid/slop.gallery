import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IgNMLTcxWnW8Pin; fixture: knot-material-shaders.
export default {
  id: 'imperial_damask',
  candidateId: 'claude_opus',
  title: 'Imperial Damask',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  displacement: 0.008,
  flavorText: 'Crimson warp, golden weft, one cloth. Pomegranates bloom in the satin only when the light agrees; take a step and the garden trades places with its ground.',
  placeholder: {
    color: hsl.integer(20, 94, 32.6),
    shading: 'fabric',
  },
} as const satisfies KnotData
