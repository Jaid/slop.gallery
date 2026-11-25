import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 7EtWKdJKgEioEdL; fixture: knot-material-shaders.
export default {
  id: 'harlequin_fire',
  candidateId: 'claude_opus',
  title: 'Harlequin Fire',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Night-black silica holds a mosaic of sleeping fires; each one wakes only for the single angle it has been waiting for.',
  placeholder: {
    color: hsl.integer(268, 60, 6),
    shading: 'glass',
  },
} as const satisfies KnotData
