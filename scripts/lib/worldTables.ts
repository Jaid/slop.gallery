import type {WorldAnalysis, WorldRegion} from '#src/lib/webmcp/analyzeWorld.ts'

import Deltable from 'deltable'

type Counts = Record<string, number>
type Row = {
  base?: Counts
  title: string
  values: Counts
}

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)
const emptyRegion: WorldRegion = {
  meshes: [],
  items: [],
  lights: [],
}
// The keys of the counts title their columns.
const deltable = new Deltable({
  idHeaderTitle: 'room',
  total: true,
})
/** a table of the rows, most of the first count first, then of the second, with Elsewhere and Global after them, closed by their totals */
const table = (rows: ReadonlyArray<Row>, trailing: ReadonlyArray<Row> = []) => {
  const sorted = [...rows.toSorted((a, b) => {
    const [aFirst, aSecond] = Object.values(a.values)
    const [bFirst, bSecond] = Object.values(b.values)
    return bFirst - aFirst || bSecond - aSecond
  }), ...trailing]
  return deltable.render({
    values: Object.fromEntries(sorted.map(row => [row.title, row.values])),
    ...sorted.some(row => row.base) ? {base: Object.fromEntries(sorted.map(row => [row.title, row.base]))} : {},
  })
}

/** the analyses of several worlds as one, their rooms side by side and their elsewheres and global lights together, as long as no room title repeats */
export const mergeWorldAnalyses = (analyses: ReadonlyArray<WorldAnalysis>): WorldAnalysis => {
  const titles = new Set<string>
  const rooms: WorldAnalysis['rooms'] = {}
  for (const [index, analysis] of analyses.entries()) {
    for (const [id, room] of Object.entries(analysis.rooms)) {
      if (titles.has(room.title)) {
        throw new Error(`More than one room is titled “${room.title}”, which the tables could not tell apart.`)
      }
      titles.add(room.title)
      // Room ids only need to be unique within their world.
      rooms[`${index}/${id}`] = room
    }
  }
  return {
    rooms,
    elsewhere: {
      meshes: analyses.flatMap(analysis => analysis.elsewhere.meshes),
      items: analyses.flatMap(analysis => analysis.elsewhere.items),
      lights: analyses.flatMap(analysis => analysis.elsewhere.lights),
    },
    globalLights: analyses.flatMap(analysis => analysis.globalLights),
  }
}

/**
 * Markdown tables of the analyses of one or more worlds as one, under headings for a report’s title above them: the static meshes and the items, which can be picked up and carried into another room, by triangles, and the lights.
 * Rooms without items are left out of the items table, the passages, stairways and outdoors as Elsewhere wherever they hold anything.
 * Given the analyses of a base revision, the tables tell how every count changed since, rooms are matched by their titles and those only one of both has count 0 in the other.
 */
export default function worldTables(analyses: ReadonlyArray<WorldAnalysis>, bases?: ReadonlyArray<WorldAnalysis>) {
  const analysis = mergeWorldAnalyses(analyses)
  const base = bases && mergeWorldAnalyses(bases)
  const titles = new Set(Object.values(analysis.rooms).map(room => room.title))
  const baseRooms = new Map(Object.values(base?.rooms ?? {}).map(room => [room.title, room]))
  const regions: Array<[string, WorldRegion]> = [
    ...Object.values(analysis.rooms).map(room => [room.title, room] as [string, WorldRegion]),
    ...baseRooms.keys().filter(name => !titles.has(name)).map(name => [name, emptyRegion] as [string, WorldRegion]),
  ]
  const elsewhere: Array<[string, WorldRegion]> = [['Elsewhere', analysis.elsewhere]]
  const baseRegion = (name: string) => (name === 'Elsewhere' ? base?.elsewhere : baseRooms.get(name))
  const rows = (list: ReadonlyArray<[string, WorldRegion]>, keep: (region: WorldRegion) => boolean, values: (region: WorldRegion) => Counts) => list.filter(([name, region]) => {
    const before = baseRegion(name)
    return keep(region) || before !== undefined && keep(before)
  }).map(([name, region]): Row => ({
    title: name,
    values: values(region),
    ...base ? {base: values(baseRegion(name) ?? emptyRegion)} : {},
  }))
  const staticValues = (region: WorldRegion) => ({
    triangles: sum(region.meshes.map(mesh => mesh.triangles)),
    meshes: region.meshes.length,
  })
  const itemValues = (region: WorldRegion) => ({
    triangles: sum(region.items.map(item => item.triangles)),
    items: region.items.length,
  })
  const lightValues = (region: Pick<WorldRegion, 'lights'>) => ({
    lamps: region.lights.length,
    shadows: region.lights.filter(light => light.shadow).length,
  })
  const items = rows([...regions, ...elsewhere], region => region.items.length > 0, itemValues)
  const global: Array<Row> = analysis.globalLights.length || base?.globalLights.length ? [{
    title: 'Global',
    values: lightValues({lights: analysis.globalLights}),
    ...base ? {base: lightValues({lights: base.globalLights})} : {},
  }] : []
  return [
    '### static meshes',
    '',
    table(rows(regions, () => true, staticValues), rows(elsewhere, region => region.meshes.length > 0, staticValues)),
    '',
    '### items',
    '',
    items.length ? table(items) : 'none',
    '',
    '### lights',
    '',
    table(rows(regions, () => true, lightValues), [...rows(elsewhere, region => region.lights.length > 0, lightValues), ...global]),
    '',
  ].join('\n')
}
