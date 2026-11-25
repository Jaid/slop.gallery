import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'captured_tempest',
  candidateId: 'gpt_sol',
  title: 'Captured Tempest',
  createdAt: 1_789_293_909,
  harness: 'none',
  author: {
    model: {
      title: 'GPT-5.6 Sol',
      slug: 'openai/gpt-5.6-sol',
      effortLevel: 'max',
    },
  },
  flavorText: 'A storm circles its own eye, unable to remember the open sky.',
  placeholder: {
    color: hsl.integer(262, 100, 87),
    shading: 'smooth',
  },
} as const satisfies KnotData
