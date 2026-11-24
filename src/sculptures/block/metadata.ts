import type {SculptureMetadata} from '../base/Sculpture.ts'

// Codex session 01a1eae7-a580-7920-8c9a-8b68eb03d97a, first shown as the Salon's carving block in 3403d10e.
export default {
  createdAt: 1_794_943_622,
  harness: 'Codex',
  author: {
    model: {
      title: 'GPT-6.2 Astra',
      slug: 'openai/gpt-6.2-astra',
      effortLevel: 'high',
    },
  },
} as const satisfies SculptureMetadata
