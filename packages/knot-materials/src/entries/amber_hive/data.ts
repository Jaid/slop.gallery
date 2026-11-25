import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4ayQMqfdM3WbrB2; fixture: knot-material-shaders; result: success.
export default {
  id: 'amber_hive',
  candidateId: 'claude_fable',
  title: 'Amber Hive',
  createdAt: 1_792_086_001,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Fable 5.1',
    slug: 'anthropic/claude-fable-5.1',
    effortLevel: 'high',
  }},
  flavorText: 'The bees are gone, but the comb still holds a summer. Look down into the open cells and the honey keeps its depth; look along the light and it burns like a stained window.',
  placeholder: {
    color: hsl.integer(72, 30, 58),
    shading: 'glass',
  },
} as const satisfies KnotData
