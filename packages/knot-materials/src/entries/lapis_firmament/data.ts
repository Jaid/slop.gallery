import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'lapis_firmament',
  candidateId: 'claude_opus',
  title: 'Lapis Firmament',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Painters ground this stone to make their skies. Uncut, it still keeps a sky of its own, where gold stars wake one by one as you come near.',
  placeholder: {
    color: hsl.integer(267, 95, 23.5),
    shading: 'stone',
  },
} as const satisfies KnotData
