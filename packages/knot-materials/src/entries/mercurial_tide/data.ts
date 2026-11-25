import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: KKRUCJSg0WdighD; fixture: knot-material-shaders.
export default {
  id: 'mercurial_tide',
  candidateId: 'claude_fable',
  title: 'Mercurial Tide',
  createdAt: 1_790_695_541,
  harness: 'Mage',
  author: {
    model: {
      title: 'Claude Fable 5.1',
      slug: 'anthropic/claude-fable-5.1',
      effortLevel: 'high',
    },
  },
  displacement: 0.03,
  flavorText: 'Quicksilver holds still for no one. Approach and it shivers, rings racing away from you across a mirror that was never solid; every lamp in the room is somewhere on its skin.',
  placeholder: {
    color: hsl.integer(253, 9, 82),
    shading: 'liquid',
  },
} as const satisfies KnotData
