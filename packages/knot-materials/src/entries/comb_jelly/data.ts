import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 4eznRMVv3vZMHhr; fixture: knot-material-shaders; result: success.
export default {
  id: 'comb_jelly',
  candidateId: 'claude_opus',
  title: 'Comb Jelly',
  createdAt: 1_792_086_173,
  harness: 'Mage',
  author: {model: {
    title: 'Claude Opus 5.5',
    slug: 'anthropic/claude-opus-5.5',
    effortLevel: 'high',
  }},
  flavorText: 'Eight ribbons of beating cilia break your torchlight into running rainbows. Come closer and it startles, lighting its own canals in pulses of cold blue fire.',
  placeholder: {
    color: hsl.integer(272, 16, 36),
    shading: 'glass',
  },
} as const satisfies KnotData
