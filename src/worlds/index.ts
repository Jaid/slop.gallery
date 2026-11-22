import wallpaper from '#root/assets/wallpaper.jxl' with {distance: '5', format: 'jxl', maximumLong: '3840'}

/** the ids of every world, which also name their telemetry service */
export const worldIds = ['gallery', 'knottingham', 'sandbox'] as const
export type WorldId = typeof worldIds[number]
/** the world’s menu and storage settings */
export type WorldInfo = {
  enterLabel: string
  /** the prefix of every key the world stores in the browser, so that worlds never share a game */
  storageKey: string
  tagline: string
  title: string
  /** the image behind the loading spinner: its URL in the page, its file where Bun imports the catalog, like Vite’s config */
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
const otherWorlds = worldIds.filter(id => id !== defaultWorld)

/** the URL parameters only one world reads, by that world, which open it: Knottingham’s, like `?shots`, and the Sandbox’s `?item` and `?turntable` */
export const worldParameters = {
  knottingham: ['candidate', 'knot_id', 'model', 'shots', 'candidate_limit', 'candidate_order', 'rarity', 'rarity_filter'],
  sandbox: ['item', 'turntable'],
} satisfies Record<typeof otherWorlds[number], ReadonlyArray<string>>

/** the ids of the rooms of every world but the gallery, by that world, which open it when `?room` names one: Knottingham’s Arena and the Sandbox’s Cell and Studio, of which the Sandbox holds only the one it opens with */
const worldRooms = {
  knottingham: ['arena'],
  sandbox: ['cell', 'studio'],
} satisfies Record<typeof otherWorlds[number], ReadonlyArray<string>>

/** A named room takes precedence over a world-specific parameter. */
export function selectWorld(search: string): WorldId {
  const query = new URLSearchParams(search)
  const room = query.get('room')
  const holder = room && otherWorlds.find(id => worldRooms[id].includes(room))
  if (holder) {
    return holder
  }
  return otherWorlds.find(id => worldParameters[id].some(parameter => query.has(parameter))) ?? defaultWorld
}

/** Read the world a URL opens, see {@link selectWorld}. */
export function readWorld(input: URL | string = typeof location === 'undefined' ? '' : location.href): WorldId {
  const url = new URL(input, 'http://localhost/')
  return selectWorld(url.search)
}

/** the world this page opens, read once at startup */
export const currentWorldId = readWorld()

/** the settings of the world this page opens */
export const currentWorldInfo: WorldInfo = worlds[currentWorldId]
