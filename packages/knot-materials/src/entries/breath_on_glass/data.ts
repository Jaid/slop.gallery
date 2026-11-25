import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: DZoyAbZAQlwnlPj; fixture: knot-material-shaders; result: success.
export default {
  id: 'breath_on_glass',
  candidateId: 'claude_opus',
  title: 'Breath on Glass',
  createdAt: 1_792_085_143,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Frost ferns overgrow a winter window. Lean in and your warmth melts a clearing, and beyond the glass a fire is still burning.',
  placeholder: {
    color: hsl.integer(31, 10, 55),
    shading: 'glass',
  },
} as const satisfies KnotData
