import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 5WDU20J87Ktg4fx; fixture: knot-material-shaders; result: mixed.
export default {
  id: 'harlequin_mosaic',
  candidateId: 'claude_sonnet',
  title: 'Harlequin Mosaic',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Sonnet 5.5',
      slug: 'anthropic/claude-sonnet-5.5',
      effortLevel: 'high',
    },
  },
  flavorText: 'Ten million years of silica rain settled into a lattice of tiny spheres. Turn it slowly and each mosaic tile lights, one hue at a time.',
  placeholder: {
    color: hsl.integer(266, 53, 17),
    shading: 'glass',
  },
} as const satisfies KnotData
