import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: IgNMLTcxWnW8Pin; fixture: knot-material-shaders.
export default {
  id: 'harlequin_night_opal',
  candidateId: 'claude_opus',
  title: 'Harlequin Night Opal',
  createdAt: 1_790_461_810,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Opus 5.5',
      slug: 'anthropic/claude-opus-5.5',
      effortLevel: 'medium',
    },
  },
  flavorText: 'Silica spheres, stacked in the dark for a hundred thousand years, hold their fire for whoever keeps moving.',
  placeholder: {
    color: hsl.integer(268, 60, 6),
    shading: 'glass',
  },
} as const satisfies KnotData
