import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DZoyAbZAQlwnlPj; fixture: knot-material-shaders; result: success.
export default {
  id: 'ironstone_opal',
  candidateId: 'claude_opus',
  title: 'Ironstone Opal',
  createdAt: 1_792_085_143,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Black opal from the ironstone deep: dark as a closed eye until you move, then every patch ignites, each burning one color for one angle only.',
  placeholder: {
    color: hsl.integer(17, 5, 36),
    shading: 'stone',
  },
} as const satisfies KnotData
