import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'

import PumpkinRindMaterial from '#src/lib/materials/PumpkinRindMaterial.ts'
import PumpkinStemMaterial from '#src/lib/materials/PumpkinStemMaterial.ts'

import {banquet, banquetTable} from '../../banquet.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

/** how many ribs run round it, from stem to blossom end */
const ribs = 10
/** how far its widest rib reaches from its axis, and how tall it stands from its blossom end to where its stem springs, in meters */
const radius = 0.15
const height = 0.25
/** how deep the creases between its ribs cut in, as a share of how far out it reaches there */
const creaseDepth = 0.06
/** how deep the hollow round its stem sinks, and the one at its blossom end, and how wide either is, as the share of its full width where they have flattened out */
const stemHollow = [0.042, 0.22] as const
const blossomHollow = [0.024, 0.2] as const
/** how many points round it, one of them on every crease, and how many rows from top to bottom */
const around = ribs * 10
const down = 44
/** the stem: how tall it rises out of its hollow, how thick it is at its foot and its cut end, and how many ridges run up it */
const stemHeight = 0.075
const stemRadius = [0.016, 0.011] as const
const stemRidges = 5

/** where the pumpkin sits when a game begins: on the Banquet’s table, a little south of the room’s middle */
export const pumpkinSpot: Vec3 = [banquet.center[0] + 0.12, banquetTable.height + 0.004, banquet.center[1] + 1.9]

/** How far out it reaches at the angle round its axis, as a share of its widest, with the creases between its ribs and its lopsided growth, at the polar angle `v`. */
function reachAt(u: number, v: number) {
  // 1 on the middle of a rib, 0 down a crease; cubed, so the creases are sharp and the ribs broad
  const crease = (1 - Math.abs(Math.cos(u * ribs / 2))) ** 3
  const lopsided = 1 + 0.035 * Math.sin(3 * u + 0.7) * Math.sin(v) + 0.018 * Math.sin(5 * u + 2.1)
  return (1 - creaseDepth * Math.sin(v) ** 0.7 * crease) * lopsided
}
/** Where its surface lies at the angle `u` round its axis and the polar angle `v` from the top, before it is lifted to stand on its blossom end. */
function rind(u: number, v: number) {
  const across = Math.sin(v)
  const r = radius * across ** 0.82 * reachAt(u, v)
  const upright = Math.cos(v)
  let y = height / 2 * Math.sign(upright) * Math.abs(upright) ** 0.9
  const [stemDepth, stemWidth] = stemHollow
  const [blossomDepth, blossomWidth] = blossomHollow
  y -= upright > 0 ? stemDepth * Math.exp(-((across / stemWidth) ** 2)) : -blossomDepth * Math.exp(-((across / blossomWidth) ** 2))
  return [r * Math.sin(u), y, r * Math.cos(u)] as const
}

/** A ripe field pumpkin, uncarved: ten broad ribs creased between them round a squat body, a hollow round its stump of a stem and a dimple at its blossom end. It sits on the Banquet’s table, to steer the flavor the Forge’s alchemy machine gives a Transparent Orb to a Halloween Orb. */
export default class Pumpkin extends Curio {
  readonly id = 'pumpkin'
  readonly mass = 4.5
  readonly mood = 'halloween'
  readonly position = pumpkinSpot
  readonly reach = 0.32
  readonly room = 'banquet'
  override readonly rotation: Vec3 = [0, 0.4, 0]
  readonly title = 'A pumpkin waiting for a face'

  createModel() {
    const vs = Array.from({length: down}, (_, row) => 0.012 + (Math.PI - 0.024) * row / (down - 1))
    const us = Array.from({length: around}, (_, column) => Math.PI * 2 * column / around)
    const raw = vs.map(v => us.map(u => rind(u, v)))
    const lowest = Math.min(...raw.flat().map(([, y]) => y))
    const lift = (x: number, y: number, z: number): LatticePoint => ({position: [x, y - lowest, z]})
    const top = rind(0, 0)
    const bottom = rind(0, Math.PI)
    const body = latticeGeometry(raw.map(row => row.map(([x, y, z]) => lift(x, y, z))), {
      start: lift(0, top[1], 0),
      end: lift(0, bottom[1], 0),
    })
    // The stem springs from the bottom of the hollow, bending off to one side and twisting a little as it rises, with its ridges and a flared foot.
    const foot = top[1] - lowest - 0.008
    const stemRows = 10
    const stemAround = stemRidges * 6
    const stem = latticeGeometry(Array.from({length: stemRows}, (_ignoredRow, row) => {
      const t = 1 - row / (stemRows - 1)
      const thickness = stemRadius[0] + (stemRadius[1] - stemRadius[0]) * t + 0.012 * Math.exp(-t / 0.1)
      const twist = 0.5 * t
      const [bendX, bendZ] = [0.022 * t ** 2, 0.006 * t ** 2]
      return Array.from({length: stemAround}, (_ignoredColumn, column): LatticePoint => {
        const u = Math.PI * 2 * column / stemAround
        const ridged = thickness * (1 + 0.14 * Math.abs(Math.cos((u + twist) * stemRidges / 2)) ** 2 - 0.07)
        return {position: [bendX + ridged * Math.sin(u), foot + stemHeight * t, bendZ + ridged * Math.cos(u)]}
      })
    }), {start: {position: [0.022, foot + stemHeight + 0.001, 0.006]}})
    return new CurioModel([
      {
        name: 'pumpkin-rind',
        geometry: body,
        material: new PumpkinRindMaterial({ribs}),
      },
      {
        name: 'pumpkin-stem',
        geometry: stem,
        material: new PumpkinStemMaterial,
      },
    ])
  }
}
