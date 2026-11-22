import type {WorldId} from './index.ts'

/**
 * Every module a page waits for before it runs, by the world that loads it, relative to the repository: the world’s own, and for the Sandbox the one its own picks of those of its two rooms.
 * They load behind the top-level await of `current.ts`, so none of them may import it or a chunk of the page, see `worldChunksPlugin`.
 */
const worldModules = {
  gallery: ['src/worlds/gallery/index.ts'],
  knottingham: ['src/worlds/knottingham/index.ts'],
  sandbox: ['src/worlds/sandbox/index.ts', 'src/worlds/sandbox/cell.ts', 'src/worlds/sandbox/studio.ts'],
} as const satisfies Record<WorldId, ReadonlyArray<string>>

export default worldModules
