import type {KnotData} from '../../types.ts'

import hsl from 'okhsl'

export default {
  id: 'astral_loom',
  candidateId: 'gemini_flash',
  title: 'Astral Loom',
  createdAt: 1_789_075_137,
  harness: 'none',
  author: {
    model: {
      title: 'Gemini 3.8 Flash',
      slug: 'google/gemini-3.8-flash',
      effortLevel: 'high',
    },
  },
  flavorText: 'Constellations unravel into threads, then find another pattern.',
  placeholder: {
    color: hsl.integer(350, 85, 68),
    shading: 'fabric',
  },
} as const satisfies KnotData
