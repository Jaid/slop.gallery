import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

// Mage run: 2tmj6W7XIniDLsB; fixture: knot-material-shaders; result: success.
export default {
  id: 'opal_oracle',
  candidateId: 'gpt_sol',
  title: 'Opal Oracle',
  createdAt: 1_790_802_275,
  harness: 'Mage',
  author: {
    model: {
      title: 'GPT-6.1 Sol',
      slug: 'openai/gpt-6.1-sol',
      effortLevel: 'xhigh',
    },
  },
  flavorText: 'A pale stone answers without words. Buried shards trade lilac, sea-green and apricot fire as you move, revealing a different omen to every gaze.',
  placeholder: {
    color: hsl.integer(229, 9, 87),
    shading: 'glass',
  },
} as const satisfies KnotData
