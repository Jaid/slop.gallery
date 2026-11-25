import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'harlequin_lattice_opal',
  candidateId: 'claude_fable',
  title: 'Harlequin Lattice Opal',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  flavorText: 'Silica spheres settled in rows a million years ago and now bend light into patches of fire. No two viewers see the same stone; take one step and the colors have moved on.',
  placeholder: {
    color: hsl.integer(251, 42, 93),
    shading: 'glass',
  },
} as const satisfies KnotData
