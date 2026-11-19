import type {Vec3} from '../types.ts'
import type {BufferGeometry} from 'three/webgpu'

import {CapsuleGeometry, LatheGeometry, Quaternion, SphereGeometry, Vector2, Vector3} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import BowlerGeometry from '../curios/bowler/BowlerGeometry.ts'
import {place, roundedBox} from './place.ts'
import UpholsteredSeatGeometry from './UpholsteredSeatGeometry.ts'

const up = new Vector3(0, 1, 0)
/** how far he leans back into the seat’s back cushion, in radians */
const lean = 0.12
/** where his spine starts on the seat cushion, in front of the seat’s middle, and what he leans back about */
const hipZ = 0.04
/** how much smaller than the bowler lying around in the Forge his own is, which fits his head */
const hatScale = 0.74
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
 * A stranger sitting in a club seat like the Lodge’s armchairs, see {@link UpholsteredSeatGeometry}: a man in a dark overcoat and a bowler, leaning back with his head held level, his forearms on the rolls of the seat’s arms and his feet on the floor in front of it, with no face to speak of.
 * Improvised from round limbs until there is a proper human model: he is only ever seen from afar, through a window.
 *
 * In the seat’s frame: the origin is on the floor under the middle of the seat, which faces +z. He sits {@link StrangerGeometry.height} tall on the seat cushion. Geometry is merged per material: `cloth` for his coat, his trousers, his shoes, his hat and his hair, as dark as they, `skin` for his head and his hands.
 */
export default class StrangerGeometry {
  /** how tall he sits, from the seat cushion under him to the crown of his hat, in meters */
  static readonly height = 1
  readonly cloth: BufferGeometry
  readonly skin: BufferGeometry

  /** `seatWidth` is how wide the seat he sits in is between its arms. */
  constructor(seatWidth: number) {
    const {armHeight, armRollOffset, armRollRadius, armWidth, seatHeight} = UpholsteredSeatGeometry
    /** Leans a part of his upper body, built upright over the origin, back about his hips on the seat. */
    const seated = <T extends BufferGeometry>(part: T) => place(part.rotateX(-lean), 0, seatHeight, hipZ)
    /** Where a point of his upright upper body lies once he leans back: `along` meters up his spine, `x` to his left. */
    const spine = (x: number, along: number): Vec3 => [x, seatHeight + along * Math.cos(lean), hipZ - along * Math.sin(lean)]
    const hat = new BowlerGeometry
    /** how high the lid of his hat lies, whose crown stands {@link StrangerGeometry.height} over the seat, and the middle of his head, whose top it hides, held level over the end of his spine */
    const brim = seatHeight + StrangerGeometry.height - hat.felt.boundingBox!.max.y * hatScale
    const [, collar, nape] = spine(0, 0.6)
    const head: Vec3 = [0, brim - 0.043, nape + 0.035]
    // His coat: broad over the shoulders, a little waisted, and closing round his neck.
    const coat = new LatheGeometry([[0, 0], [0.18, 0], [0.21, 0.05], [0.205, 0.2], [0.2, 0.32], [0.215, 0.46], [0.215, 0.52], [0.175, 0.585], [0.095, 0.62], [0.068, 0.64], [0, 0.64]].map(([radius, y]) => new Vector2(radius, y)), 28)
    const cloth: Array<BufferGeometry> = [
      seated(coat.scale(1, 1, 0.62)),
      place(hat.felt.scale(hatScale, hatScale, hatScale), 0, brim, head[2]),
      place(hat.ribbon.scale(hatScale, hatScale, hatScale), 0, brim, head[2]),
      // His hair, as dark as his coat, down the back of his head to his nape, which is all the window behind him shows of it
      ball([0.099, 0.104, 0.1], 0, head[1] + 0.02, head[2] - 0.032),
    ]
    const skin: Array<BufferGeometry> = [
      limb([0, collar, nape], [0, head[1] - 0.07, head[2] - 0.01], 0.05),
      ball([0.092, 0.118, 0.105], ...head),
      // His nose, all there is of his face
      ball([0.013, 0.022, 0.02], 0, head[1] - 0.02, head[2] + 0.102, 8),
    ]
    /** where the roll of the seat’s arm lies on his left, and how far in from its middle his forearm lies on it */
    const rollX = seatWidth / 2 + armWidth / 2 + armRollOffset
    const inward = 0.085
    const sleeve = 0.052
    const forearmY = armHeight + Math.sqrt((armRollRadius + sleeve) ** 2 - inward ** 2)
    for (const side of [-1, 1]) {
      const elbow: Vec3 = [side * (rollX - inward), forearmY, -0.03]
      const wrist: Vec3 = [side * (rollX - inward + 0.01), forearmY, 0.27]
      const knee: Vec3 = [side * 0.12, seatHeight + 0.09, 0.5]
      const shoe = roundedBox([0.1, 0.075, 0.27], 0.035)
      cloth.push(
        limb(spine(side * 0.195, 0.525), elbow, 0.064),
        limb(elbow, wrist, sleeve),
        // His thighs lie on the seat cushion, and his shins hang down in front of it.
        limb([side * 0.095, seatHeight + 0.085, 0.1], knee, 0.084),
        limb([knee[0], knee[1] - 0.025, knee[2] + 0.02], [side * 0.125, 0.1, 0.56], 0.06),
        // His shoes point a little apart.
        place(shoe.rotateY(side * 0.12), side * 0.132, 0.0375, 0.63),
      )
      skin.push(
        ball([0.044, 0.028, 0.062], wrist[0] + side * 0.004, forearmY - 0.014, wrist[2] + 0.07),
        ball([0.012, 0.03, 0.02], side * 0.092, head[1] - 0.008, head[2] - 0.005, 8),
      )
    }
    this.cloth = mergeParts(cloth)
    this.skin = mergeParts(skin)
  }

  dispose() {
    this.cloth.dispose()
    this.skin.dispose()
  }
}
