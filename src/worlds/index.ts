import wallpaper from '#root/assets/wallpaper.jxl' with {distance: '5', format: 'jxl', maximumLong: '3840'}

/** the ids of every world, which also name their telemetry service */
export const worldIds = ['gallery', 'knottingham', 'sandbox'] as const
export type WorldId = typeof worldIds[number]
/** what the loading screen and the menu show of a world before it has loaded */
export type WorldInfo = {
  enterLabel: string
  /** the prefix of every key the world stores in the browser, so that worlds never share a game */
  storageKey: string
  tagline: string
  title: string
  /** the image behind the loading screen’s title: its URL in the page, its file where Bun imports the catalog, like Vite’s config */
  wallpaper: string
}

export const worlds = {
  gallery: {
    title: 'Slop Gallery',
    storageKey: 'slop-gallery',
    tagline: 'Good taste. Questionable art.',
    enterLabel: 'Enter gallery',
    wallpaper,
  },
  knottingham: {
    title: 'Knottingham',
    storageKey: 'knot-gallery',
    tagline: 'Light, motion and impossible materials.',
    enterLabel: 'Enter Knottingham',
    wallpaper,
  },
  sandbox: {
    title: 'Sandbox',
    storageKey: 'sandbox',
    tagline: 'One empty room to try things in.',
    enterLabel: 'Enter sandbox',
    wallpaper,
  },
} as const satisfies Record<WorldId, WorldInfo>

/** the world a URL opens without any other world’s room in `?room` and without any other world’s own parameters */
export const defaultWorld = 'gallery' satisfies WorldId

/** the URL parameters only one world reads, by that world, which open it: Knottingham’s, like `?shots`, and the Sandbox’s `?item` and `?turntable` */
export const worldParameters = {
  knottingham: ['candidate', 'knot_id', 'model', 'shots', 'candidate_limit', 'candidate_order', 'rarity', 'rarity_filter'],
  sandbox: ['item', 'turntable'],
} as const satisfies Partial<Record<WorldId, ReadonlyArray<string>>>

/** the ids of the rooms of every world but the gallery, by that world, which open it when `?room` names one: Knottingham’s Arena and the Sandbox’s Cell */
export const worldRooms = {
  knottingham: ['arena'],
  sandbox: ['cell'],
} as const satisfies Partial<Record<WorldId, ReadonlyArray<string>>>

/**
 * The world a URL query opens: the one whose room, from `rooms`, `?room` names, otherwise the first whose own parameters, from `parameters`, it gives any of, otherwise the gallery.
 *
 * Self-contained, so the loading screen can run its source before any script loads.
 */
export function selectWorld(search: string, parameters: Partial<Record<WorldId, ReadonlyArray<string>>> = worldParameters, rooms: Partial<Record<WorldId, ReadonlyArray<string>>> = worldRooms): WorldId {
  const query = new URLSearchParams(search)
  // The world ids once more, as the loading screen runs this function without the module around it.
  const known: ReadonlyArray<WorldId> = ['gallery', 'knottingham', 'sandbox']
  const room = query.get('room')
  const holder = room ? known.find(id => rooms[id]?.includes(room)) : undefined
  if (holder) {
    return holder
  }
  return known.find(id => parameters[id]?.some(parameter => query.has(parameter))) ?? 'gallery'
}

/** Read the world a URL opens, see {@link selectWorld}. */
export function readWorld(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldId {
  const url = new URL(input, 'http://localhost/')
  return selectWorld(url.search)
}

/** the world this page opens, read once at startup */
export const currentWorldId = readWorld()

/** the loading screen’s and the menu’s view of the world this page opens */
export const currentWorldInfo: WorldInfo = worlds[currentWorldId]
