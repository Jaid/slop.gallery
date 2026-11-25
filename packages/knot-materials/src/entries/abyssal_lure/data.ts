import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'abyssal_lure',
  candidateId: 'claude_fable',
  title: 'Abyssal Lure',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'Four thousand meters down, something soft and patient has learned to make its own light. It has noticed you. It is very glad you came.',
  placeholder: {
    color: hsl.integer(226, 16, 44),
    shading: 'smooth',
  },
} as const satisfies KnotData
