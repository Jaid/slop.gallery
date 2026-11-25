import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DZoyAbZAQlwnlPj; fixture: knot-material-shaders; result: success.
export default {
  id: 'ctenophora',
  candidateId: 'claude_opus',
  title: 'Ctenophora',
  createdAt: 1_792_085_143,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Eight rows of beating cilia scatter rainbows down a body of living glass. Come too close and the startled creature answers in cold blue fire.',
  placeholder: {
    color: hsl.integer(253, 14, 39),
    shading: 'glass',
  },
} as const satisfies KnotData
