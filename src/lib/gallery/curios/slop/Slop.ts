import type {GalleryRoomId} from '../../../../worlds/gallery/index.ts'
import type {SloperatorSight} from '../../sloperator/sights.ts'
import type {Vec3} from '../../types.ts'
import type {LatticePoint} from '../lattice.ts'
import type FatedRandom from 'fated-random'

import SlopMaterial from '../../../materials/SlopMaterial.ts'
import Curio, {CurioModel} from '../base/Curio.ts'
import latticeGeometry from '../lattice.ts'

/** how far its mound reaches from its middle before its lobes, and how high it stands, in meters */
const radius = 0.15
const height = 0.115
/** how far its foot runs out round the mound, as a thin puddle */
const foot = 0.045
/** how many points round it and how many rows from its top down to its rim */
const around = 72
const down = 26
/** How far out it reaches at the angle `u` round its axis, as a share of a round one’s: a few lobes of different sizes, which its foot shows more of than its top. */
function lobes(u: number, low: number) {
  return 1 + (0.1 * Math.sin(3 * u + 1.3) + 0.06 * Math.sin(5 * u + 0.4) + 0.035 * Math.sin(8 * u + 2.2)) * (0.35 + 0.65 * low)
}

/**
 * A Slop: a mass of green slime the Sloperator leaves where he sat, once the player caught sight of him there and went away again, see `sloperator/sightings.ts`. A lobed mound on a thin puddle of a foot, stuck to the seat until someone picks it up.
 * There is one for each of his sights, which is not in the world before he left it there.
 */
export default class Slop extends Curio {
  readonly id: string
  readonly mass = 1.4
  readonly position: Vec3
  readonly reach = 0.38
  readonly room: GalleryRoomId
  readonly title = 'Slop'
  override readonly type = 'fixed'

  /** `sight` is where he sat, which it lies on the seat of, and `random` rolls its green, see {@link SlopMaterial}. */
  constructor({id, position: [x, y, z], room, seat}: Pick<SloperatorSight, 'id' | 'position' | 'room' | 'seat'>, private readonly random: FatedRandom) {
    super()
    this.id = `slop-${id}`
    this.position = [x, y + seat.height, z]
    this.room = room
  }

  createModel() {
    const rows = Array.from({length: down}, (_ignoredRow, row) => {
      // From just off its top down to its rim on the seat
      const v = 0.04 + (Math.PI / 2 - 0.04) * row / (down - 1)
      const low = Math.sin(v) ** 2
      // A mound that runs out into its foot instead of meeting the seat upright
      const y = height * Math.cos(v) ** 1.6
      const reach = radius * Math.sin(v) ** 0.8 + foot * Math.exp(-((y / 0.012) ** 2))
      return Array.from({length: around}, (_ignoredColumn, column): LatticePoint => {
        const u = Math.PI * 2 * column / around
        const r = reach * lobes(u, low)
        return {position: [r * Math.sin(u), y, r * Math.cos(u)]}
      })
    })
    return new CurioModel([{
      name: 'slop-slime',
      geometry: latticeGeometry(rows, {
        start: {position: [0, height, 0]},
        end: {position: [0, 0, 0]},
      }),
      material: new SlopMaterial(this.random),
    }])
  }
}
