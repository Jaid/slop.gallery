import optis from 'optis'
import readPermalink from 'read-permalink'

const spawnSchema = optis({
  defaults: {
    spawn: '',
  },
  normalizations: {
    spawn(value: unknown) {
      return typeof value === 'string' ? value : ''
    },
  },
})

/** Read the `?spawn` bookmark ID the session starts at, or an empty string. */
export function readSpawn(input: URL | string = typeof location === 'undefined' ? '' : location.href): string {
  return readPermalink(input, {schema: spawnSchema}).spawn
}

const roomSchema = optis({
  defaults: {
    room: '',
  },
  normalizations: {
    room(value: unknown) {
      return typeof value === 'string' ? value : ''
    },
  },
})

/** Read the `?room` ID whose default spawn the session starts at, or an empty string. */
export function readRoom(input: URL | string = typeof location === 'undefined' ? '' : location.href): string {
  return readPermalink(input, {schema: roomSchema}).room
}

/** The bookmark of the list that `?spawn` names, `null` without `?spawn` and `undefined` when none of them has that ID. */
export function findNamedBookmark<Bookmark extends {id: string}>(list: ReadonlyArray<Bookmark>, input?: URL | string): Bookmark | null | undefined {
  const id = readSpawn(input)
  return id ? list.find(bookmark => bookmark.id === id) : null
}
