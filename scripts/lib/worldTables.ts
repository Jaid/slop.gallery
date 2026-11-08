import type {WorldAnalysis, WorldRegion} from '#src/lib/webmcp/analyzeWorld.ts'
import type {CountRow} from './countTable.ts'

import countTable from './countTable.ts'

const sum = (values: ReadonlyArray<number>) => values.reduce((total, value) => total + value, 0)
const emptyRegion: WorldRegion = {
  meshes: [],
  items: [],
  lights: [],
}
/** a table of the rows, most of the first value first, with Elsewhere and Global after them, closed by their totals */
const table = (headers: ReadonlyArray<string>, rows: ReadonlyArray<CountRow>, trailing: ReadonlyArray<CountRow> = []) => countTable(headers, [...rows.toSorted((a, b) => b.values[0] - a.values[0] || b.values[1] - a.values[1]), ...trailing])

/**
 * Markdown tables of a world’s analysis: the static meshes and the items, which can be picked up and carried into another room, by triangles, and the lights.
 * Rooms without items are left out of the items table, the passages, stairways and outdoors as Elsewhere wherever they hold anything.
 * Given the analysis of a base revision, the tables tell how every count changed since, rooms are matched by their titles and those only one of both has count 0 in the other.
 */
export default function worldTables(analysis: WorldAnalysis, title: string, graphics: string, seed: number, base?: WorldAnalysis) {
  const titles = new Set(Object.values(analysis.rooms).map(room => room.title))
  const baseRooms = new Map(Object.values(base?.rooms ?? {}).map(room => [room.title, room]))
  const regions: Array<[string, WorldRegion]> = [
    ...Object.values(analysis.rooms).map(room => [room.title, room] as [string, WorldRegion]),
    ...baseRooms.keys().filter(name => !titles.has(name)).map(name => [name, emptyRegion] as [string, WorldRegion]),
  ]
  const elsewhere: Array<[string, WorldRegion]> = [['Elsewhere', analysis.elsewhere]]
  const baseRegion = (name: string) => (name === 'Elsewhere' ? base?.elsewhere : baseRooms.get(name))
  const rows = (list: ReadonlyArray<[string, WorldRegion]>, keep: (region: WorldRegion) => boolean, values: (region: WorldRegion) => Array<number>) => list.filter(([name, region]) => {
    const before = baseRegion(name)
    return keep(region) || before !== undefined && keep(before)
  }).map(([name, region]): CountRow => ({
    title: name,
    values: values(region),
    ...base ? {base: values(baseRegion(name) ?? emptyRegion)} : {},
  }))
  const staticValues = (region: WorldRegion) => [sum(region.meshes.map(mesh => mesh.triangles)), region.meshes.length]
  const itemValues = (region: WorldRegion) => [sum(region.items.map(item => item.triangles)), region.items.length]
  const lightValues = (region: Pick<WorldRegion, 'lights'>) => [region.lights.length, region.lights.filter(light => light.shadow).length]
  const items = rows([...regions, ...elsewhere], region => region.items.length > 0, itemValues)
  const global: Array<CountRow> = analysis.globalLights.length || base?.globalLights.length ? [{
    title: 'Global',
    values: lightValues({lights: analysis.globalLights}),
    ...base ? {base: lightValues({lights: base.globalLights})} : {},
  }] : []
  return [
    `## ${title} (${graphics} graphics, seed ${seed})`,
    '',
    '### Static meshes',
    '',
    table(['Room', 'Triangles', 'Meshes'], rows(regions, () => true, staticValues), rows(elsewhere, region => region.meshes.length > 0, staticValues)),
    '',
    '### Items',
    '',
    'Props, portraits and everything else the player can pick up, counted in the room they lie in now, as they can be carried into any other.',
    '',
    items.length ? table(['Room', 'Triangles', 'Items'], items) : 'None.',
    '',
    '### Lights',
    '',
    table(['Room', 'Lamps', 'Shadows'], rows(regions, () => true, lightValues), [...rows(elsewhere, region => region.lights.length > 0, lightValues), ...global]),
    '',
    'Shadows counts the lamps with a shadow map of their own and those borrowing one of the shadow pool’s while in view. Global holds the sun, the sky and ambient light, Elsewhere the passages, stairways and the outdoors.',
    '',
  ].join('\n')
}
