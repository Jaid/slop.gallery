import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'orrery_of_hours',
  candidateId: 'deepseek',
  title: 'Orrery of Hours',
  createdAt: 1_790_125_939,
  harness: 'Mage',
  author: {
    model: {
      title: 'DeepSeek 4.1 Flash',
      slug: 'deepseek/deepseek-4.1-flash',
      effortLevel: 'xhigh',
    },
  },
  displacement: 0.009,
  flavorText: 'A brass movement with no dial to read: only wheels that keep counting something the room cannot name.',
  placeholder: {
    color: hsl.integer(83, 79, 67),
    shading: 'metal',
  },
} as const satisfies KnotData
