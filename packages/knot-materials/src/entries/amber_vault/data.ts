import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IgNMLTcxWnW8Pin; fixture: knot-material-shaders.
export default {
  id: 'amber_vault',
  candidateId: 'claude_opus',
  title: 'Amber Vault',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Forty million summers sleep in the resin: seeds of air, drowned dust and golden spangles that still remember the sun and flash as you pass.',
  placeholder: {
    color: hsl.integer(54, 89, 44),
    shading: 'glass',
  },
} as const satisfies KnotData
