import type {Vec3} from '../types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {CapsuleGeometry, LatheGeometry, Quaternion, SphereGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import BowlerGeometry from '../curios/bowler/BowlerGeometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'

/** what the Sloperator sits on, in its own frame: the origin on the floor under where he sits, the seat facing +z */
export type SloperatorSeat = {
  /** the rolls on the seat’s arms, which his forearms lie on: how high their middles lie over the floor, how thick they are and how far from his middle they lie on either side; on a seat without arms, his hands lie on his thighs */
  arms?: {
    height: number
    radius: number
    x: number
  }
  /** how high over the floor the top of the seat lies, which he sits on */
  height: number
  /** how far he leans back into the seat’s back, in radians; he sits upright on a seat without one */
  lean?: number
}

const up = new Vector3(0, 1, 0)
/** where his spine starts on the seat, in front of where he sits, and what he leans back about */
const hipZ = 0.04
/** how much smaller than the bowler lying around in the Forge his own is, which fits his head */
const hatScale = 0.74
/** how thick his sleeves are round his forearms, and his trousers round his thighs */
const sleeve = 0.052
const thigh = 0.084
/** A limb between two joints, round at both, `radius` thick. */
function limb(from: Vec3, to: Vec3, radius: number) {
  const start = new Vector3(...from)
  const direction = new Vector3(...to)
  direction.sub(start)
  const length = direction.length()
  const geometry = new CapsuleGeometry(radius, length, 6, 14)
  // Capsules stand along y; turn y onto the limb’s direction.
  const turn = new Quaternion
  geometry.applyQuaternion(turn.setFromUnitVectors(up, direction.divideScalar(length)))
  const middle = start.addScaledVector(direction, length / 2)
  return place(geometry, middle.x, middle.y, middle.z)
}
/** A ball squeezed to its half axes, around `[x, y, z]`. */
function ball([width, height, depth]: Vec3, x: number, y: number, z: number, segments = 20) {
  const geometry = new SphereGeometry(1, segments, Math.ceil(segments * 0.7))
  return place(geometry.scale(width, height, depth), x, y, z)
}

/**
 * The Sloperator, sitting: the bowler-hatted gentleman of the gallery’s icon, in a dark overcoat, a slop of slime in front of his face, his head held level and his feet on the floor in front of his seat. In a seat with arms, he leans back with his forearms on their rolls; on a bench, he sits upright with his hands on his thighs.
 * Improvised from round limbs until there is a proper human model: he is only ever seen from afar, through a window.
 *
 * In his seat’s frame, see {@link SloperatorSeat}. He sits {@link SloperatorGeometry.height} tall on it, and his knees reach {@link SloperatorGeometry.lap} in front of where he sits. Geometry is merged per material: `cloth` for his coat, his trousers, his shoes, his hat and his hair, as dark as they, `skin` for his head and his hands and `slime` for the slop in front of his face.
 */
export default class SloperatorGeometry {
  /** how tall he sits, from the seat under him to the crown of his hat, in meters */
  static readonly height = 1
  /** how far in front of where he sits the front edge of his seat should lie, which his thighs reach to and his shins hang down in front of, in meters */
  static readonly lap = 0.46
  readonly cloth: BufferGeometry
  readonly skin: BufferGeometry
  readonly slime: BufferGeometry

  constructor({arms, height: seatHeight, lean = 0}: SloperatorSeat) {
    /** Leans a part of his upper body, built upright over the origin, back about his hips on the seat. */
    const seated = <T extends BufferGeometry>(part: T) => place(part.rotateX(-lean), 0, seatHeight, hipZ)
    /** Where a point of his upright upper body lies once he leans back: `along` meters up his spine, `x` to his left. */
    const spine = (x: number, along: number): Vec3 => [x, seatHeight + along * Math.cos(lean), hipZ - along * Math.sin(lean)]
    const hat = new BowlerGeometry
    /** how high the lid of his hat lies, whose crown stands {@link SloperatorGeometry.height} over the seat, and the middle of his head, whose top it hides, held level over the end of his spine */
    const brim = seatHeight + SloperatorGeometry.height - hat.felt.boundingBox!.max.y * hatScale
    const [, collar, nape] = spine(0, 0.6)
    const head: Vec3 = [0, brim - 0.043, nape + 0.035]
    const face = head[2] + 0.105
    // His coat: broad over the shoulders, a little waisted, and closing round his neck.
    const coat = new LatheGeometry([[0, 0], [0.18, 0], [0.21, 0.05], [0.205, 0.2], [0.2, 0.32], [0.215, 0.46], [0.215, 0.52], [0.175, 0.585], [0.095, 0.62], [0.068, 0.64], [0, 0.64]].map(([radius, y]) => new Vector2(radius, y)), 28)
    const cloth: Array<BufferGeometry> = [
      seated(coat.scale(1, 1, 0.62)),
      place(hat.felt.scale(hatScale, hatScale, hatScale), 0, brim, head[2]),
      place(hat.ribbon.scale(hatScale, hatScale, hatScale), 0, brim, head[2]),
      // His hair, as dark as his coat, down the back of his head to his nape, which is all a window behind him shows of it
      ball([0.099, 0.104, 0.1], 0, head[1] + 0.02, head[2] - 0.032),
    ]
    const skin: Array<BufferGeometry> = [
      limb([0, collar, nape], [0, head[1] - 0.07, head[2] - 0.01], 0.05),
      ball([0.092, 0.118, 0.105], ...head),
    ]
    // The slop in front of his face, all there is to see of it, with two drips running down from it
    const slime: Array<BufferGeometry> = [
      ball([0.064, 0.078, 0.04], 0, head[1] - 0.012, face),
      ball([0.015, 0.034, 0.016], -0.022, head[1] - 0.088, face + 0.004, 10),
      ball([0.011, 0.024, 0.012], 0.026, head[1] - 0.08, face + 0.002, 10),
    ]
    /** how high the tops of his thighs lie, which his hands lie on where the seat has no arms */
    const lapY = seatHeight + 0.085 + thigh
    for (const side of [-1, 1]) {
      /** how far in from the middle of the roll of the seat’s arm his forearm lies on it, and how high */
      const inward = 0.085
      const forearmY = arms ? arms.height + Math.sqrt((arms.radius + sleeve) ** 2 - inward ** 2) : 0
      const elbow: Vec3 = arms ? [side * (arms.x - inward), forearmY, -0.03] : [side * 0.24, seatHeight + 0.275, hipZ + 0.05]
      const wrist: Vec3 = arms ? [side * (arms.x - inward + 0.01), forearmY, 0.27] : [side * 0.145, lapY + sleeve * 0.7, 0.32]
      const hand: Vec3 = arms ? [wrist[0] + side * 0.004, forearmY - 0.014, wrist[2] + 0.07] : [side * 0.128, lapY + 0.018, 0.39]
      const knee: Vec3 = [side * 0.12, seatHeight + 0.09, 0.5]
      const shoe = roundedBox([0.1, 0.075, 0.27], 0.035)
      cloth.push(
        limb(spine(side * 0.195, 0.525), elbow, 0.064),
        limb(elbow, wrist, sleeve),
        // His thighs lie on the seat, and his shins hang down in front of it.
        limb([side * 0.095, seatHeight + 0.085, 0.1], knee, thigh),
        limb([knee[0], knee[1] - 0.025, knee[2] + 0.02], [side * 0.125, 0.1, 0.56], 0.06),
        // His shoes point a little apart.
        place(shoe.rotateY(side * 0.12), side * 0.132, 0.0375, 0.63),
      )
      skin.push(
        ball([0.044, 0.028, 0.062], ...hand),
        ball([0.012, 0.03, 0.02], side * 0.092, head[1] - 0.008, head[2] - 0.005, 8),
      )
    }
    this.cloth = mergeParts(cloth)
    this.skin = mergeParts(skin)
    this.slime = mergeParts(slime)
  }

  dispose() {
    this.cloth.dispose()
    this.skin.dispose()
    this.slime.dispose()
  }
}
