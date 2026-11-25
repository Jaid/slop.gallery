import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'clockwork_oracle',
  candidateId: 'deepseek',
  title: 'Clockwork Oracle',
  createdAt: 1_789_235_998,
  harness: 'chat.deepseek.com',
  author: {
    model: {
      title: 'DeepSeek',
      effortLevel: 'DeepThink',
    },
  },
  flavorText: 'A machine of tiny certainties attempts to predict an impossible future.',
  placeholder: {
    color: hsl.integer(87, 100, 84.5),
    shading: 'metal',
  },
} as const satisfies KnotData
