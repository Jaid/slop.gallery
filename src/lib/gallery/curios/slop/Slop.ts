import type {GalleryRoomId} from '../../../../worlds/gallery/index.ts'
import type {SloperatorPlacement} from '../../sloperator/placement.ts'
import type {SloperatorSight} from '../../sloperator/sights.ts'
import type {Vec3} from '../../types.ts'
import type {CurioShape} from '../base/Curio.ts'
import type {LatticePoint} from '../lattice.ts'
import type FatedRandom from 'fated-random'

import {Euler, Quaternion, Vector3} from 'three/webgpu'

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
const up = new Vector3(0, 1, 0)
/** How far out it reaches at the angle `u` round its axis, as a share of a round one’s: a few lobes of different sizes, which its foot shows more of than its top. */
function lobes(u: number, low: number) {
  return 1 + (0.1 * Math.sin(3 * u + 1.3) + 0.06 * Math.sin(5 * u + 0.4) + 0.035 * Math.sin(8 * u + 2.2)) * (0.35 + 0.65 * low)
}

/**
 * A Slop: a mass of green slime the Sloperator leaves where he was, once the player caught sight of him there and went away again, see `sloperator/sightings.ts`. A lobed mound on a thin puddle of a foot, on the seat he sat on or the floor he stood on, along the floor however it slopes.
 * Stuck to a seat that never moves until someone picks it up; on a seat the physics moves, it rides along, and on the floor it lies loose, so it never stops a seat pushed into it. Its body is a rounded cylinder as wide as its foot and as high as its mound.
 * There is one for each of his sights, which is not in the world before he left it there.
 */
export default class Slop extends Curio {
  readonly id: string
  readonly mass = 1.4
  readonly position: Vec3
  readonly reach = 0.38
  readonly room: GalleryRoomId
  override readonly rotation: Vec3
  readonly shapes: ReadonlyArray<CurioShape> = [{
    border: 0.03,
    height,
    kind: 'cylinder',
    position: [0, height / 2, 0],
    radius: radius + foot,
  }]
  readonly title = 'Slop'
  override readonly type: 'dynamic' | 'fixed'

  /** `sight` is the sight he was at, `placement` how he was there, which it lies on top of what he was on, and `random` rolls its green, see {@link SlopMaterial}. Where he stood on the sight’s sloping floor, it lies along it, its foot flat on it, rather than reaching into it. */
  constructor({id, room, slope}: Pick<SloperatorSight, 'id' | 'room' | 'slope'>, {fixed, pose, position: [x, y, z], surface, yaw}: SloperatorPlacement, private readonly random: FatedRandom) {
    super()
    this.id = `slop-${id}`
    this.position = [x, y + surface, z]
    this.room = room
    this.rotation = [0, yaw, 0]
    if (slope && pose === 'stand') {
      const normal = new Vector3(-slope.grade * Math.sin(slope.yaw), 1, -slope.grade * Math.cos(slope.yaw))
      const tilt = new Quaternion
      tilt.setFromUnitVectors(up, normal.normalize())
      const turn = new Quaternion
      tilt.multiply(turn.setFromAxisAngle(up, yaw))
      const rotation = new Euler
      rotation.setFromQuaternion(tilt)
      this.rotation = [rotation.x, rotation.y, rotation.z]
    }
    this.type = fixed ? 'fixed' : 'dynamic'
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
