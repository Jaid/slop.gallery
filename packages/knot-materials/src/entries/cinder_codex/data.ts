import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'cinder_codex',
  candidateId: 'muse_spark',
  title: 'Cinder Codex',
  createdAt: 1_789_231_507,
  harness: 'meta.ai',
  author: {
    model: {
      title: 'Muse Spark',
    },
  },
  flavorText: 'The last page of a burned library still glows between its lines.',
  placeholder: {
    color: hsl.integer(45, 100, 65),
    shading: 'stone',
  },
} as const satisfies KnotData
