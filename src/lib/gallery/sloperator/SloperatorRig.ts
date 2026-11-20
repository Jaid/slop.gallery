import type {Vec3} from '../types.ts'
import type {SloperatorSeat} from './SloperatorGeometry.ts'
import type {BufferGeometry} from 'three/webgpu'

import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import {Bone, CapsuleGeometry, LatheGeometry, Quaternion, SphereGeometry, Vector2, Vector3} from 'three/webgpu'

import BowlerGeometry from '../curios/bowler/BowlerGeometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'

export type SloperatorMaterial = 'cane' | 'cloth' | 'skin' | 'slime'
/** his right, toward −x as he faces +z, or his left */
export type Side = -1 | 1
/** something of each of his sides */
export type Sided<T> = Record<Side, T>
/** a part of him on a bone of his: its geometry in the bone’s own frame, indexed, and what it is made of */
export type SloperatorPart = {
  bone: Bone
  geometry: BufferGeometry
  material: SloperatorMaterial
}
/**
 * Where his limbs reach in a pose, all in his frame, which his rig follows, see {@link SloperatorRig.follow}: his pelvis and how far he leans back, his ankles and his hands, where his knees and his elbows bend toward, and how he holds his cane.
 * Blended between poses, they move him from one into the other with his bones keeping their lengths, his shoes flat on the floor and his head level.
 */
export type SloperatorGoals = {
  ankles: Sided<Vector3>
  /** points his elbows bend toward, like where they are */
  elbows: Sided<Vector3>
  /** where he holds his cane, under its handle */
  grip: Vector3
  /** where the middles of his hands are */
  hands: Sided<Vector3>
  /** points his knees bend toward, like where they are */
  knees: Sided<Vector3>
  /** how far his spine leans back from upright, in radians, forward where negative; his neck makes up for it */
  lean: number
  /** where his pelvis is: the foot of his spine, between his hips */
  pelvis: Vector3
  /** where the tip of his cane is */
  tip: Vector3
}

const up = new Vector3(0, 1, 0)
/** the way every bone of a limb runs from its joint before it is posed, down along its own y */
const down = new Vector3(0, -1, 0)
const sides = [-1, 1] as const
/** where his spine starts, in front of where he sits or stands, and what he leans back about */
const hipZ = 0.04
/** how far up his spine his collar and his shoulders lie */
const collarY = 0.6
const shoulderY = 0.525
/** how far out from his middle his shoulders and his hips lie */
const shoulderX = 0.195
const hipX = 0.095
/** where his hips lie on his pelvis: as high over the seat as his thighs are thick, and in front of his spine */
const hipY = 0.085
const hipForward = 0.06
/** how long his bones are: upper arm, forearm, from his wrist to the middle of his hand, thigh, and shin from knee to ankle */
export const upperArm = 0.335
export const forearm = 0.3
export const hand = 0.07
const thigh = 0.4
const shin = 0.49
/** how high his ankles lie over the floor his shoes stand on, and how far out from his middle, a little wider than his hips */
const ankleY = 0.1
const ankleX = 0.125
/** how thick his sleeves are round his forearms, and his trousers round his thighs */
const sleeve = 0.052
const trousers = 0.084
/** how much smaller than the bowler lying around in the Forge his own is, which fits his head */
const hatScale = 0.74
/** how much shorter than his whole leg the line from his hip to his ankle is while he stands, so his knees bend forward a little, never back */
const kneeSlack = 0.004
/** how far in front of where he sits the front edge of his seat should lie, which his thighs reach to and his shins hang down in front of, in meters */
export const lap = 0.46
/** how long his cane is, from where he holds it under its handle to its tip, how thick its shaft is and how thick its handle, which runs forward over the shaft like a derby’s */
export const caneLength = 0.9
const caneRadius = 0.011
const handleRadius = 0.016
/** how high over the top of his cane’s handle the middle of the hand lying on it is, as half as thick as a hand and as far as it lies under the line of his forearm, how far the middles of his hands lie apart where one lies on the other, and how far in front of the shaft they lie on the handle */
const onHandle = 0.043
const onHand = 0.045
const handleForward = 0.03
/** Something of each side, made by `make`. */
export function sided<T>(make: (side: Side) => T): Sided<T> {
  return {
    [-1]: make(-1),
    1: make(1),
  }
}
/** A limb between two joints, round at both, `radius` thick, `around` faces round and `capped` rows down each round end. */
function limb(from: Vec3, to: Vec3, radius: number, around = 14, capped = 6) {
  const start = new Vector3(...from)
  const direction = new Vector3(...to)
  direction.sub(start)
  const length = direction.length()
  const geometry = new CapsuleGeometry(radius, length, capped, around)
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
/** The middle joint of a limb of two bones, `first` and `second` long, reaching from `start` toward `end`: bent toward `pole`, or straight where `end` lies out of its reach. */
function bend(start: Vector3, end: Vector3, first: number, second: number, pole: Vector3) {
  const axis = end.clone().sub(start)
  const reach = Math.min(Math.max(axis.length(), Math.abs(first - second) + 1e-6), first + second - 1e-6)
  axis.normalize()
  const along = (first ** 2 - second ** 2 + reach ** 2) / (2 * reach)
  const toward = pole.clone().addScaledVector(axis, -pole.dot(axis)).normalize()
  return start.clone().addScaledVector(axis, along).addScaledVector(toward, Math.sqrt(Math.max(first ** 2 - along ** 2, 0)))
}

/**
 * The skeleton of the Sloperator, the bowler-hatted gentleman of the gallery’s icon, with his parts on its bones: it poses him sitting on a seat or standing, or reaching for any goals, see {@link SloperatorGoals}, which his moves blend between, see `SloperatorMotion`; `SloperatorGeometry` draws him as he is posed.
 * Improvised from round limbs until there is a proper human model: he is only ever seen from afar, through a window. Each part moves with one bone, like a jointed mannequin’s, and the round ends of his limbs fill his joints however they bend.
 *
 * In his own frame, in meters: the origin on the floor under where he sits or stands, facing +z. His bones keep their lengths in every pose, his shoes stand flat on the floor, and his head stays level however far he leans back.
 */
export default class SloperatorRig {
  /** his parts, each on its bone, which move with it */
  readonly parts: ReadonlyArray<SloperatorPart>
  readonly root = new Bone
  private readonly cane = new Bone
  private readonly feet: Sided<Bone>
  private readonly forearms: Sided<Bone>
  private readonly neck = new Bone
  private readonly pelvis = new Bone
  private readonly shins: Sided<Bone>
  private readonly spine = new Bone
  private readonly thighs: Sided<Bone>
  private readonly upperArms: Sided<Bone>

  constructor() {
    const parts: Array<SloperatorPart> = []
    this.parts = parts
    const part = (bone: Bone, material: SloperatorMaterial, geometry: BufferGeometry) => {
      // Indexed, every part keeps its corners in one run of the geometry they merge into.
      const indexed = geometry.index ? geometry : mergeVertices(geometry, 1e-6)
      if (indexed !== geometry) {
        geometry.dispose()
      }
      parts.push({
        bone,
        geometry: indexed,
        material,
      })
    }
    const {cane, neck, pelvis, root, spine} = this
    // His coat, round his spine: broad over the shoulders, a little waisted, and closing round his neck
    const coat = new LatheGeometry([[0, 0], [0.18, 0], [0.21, 0.05], [0.205, 0.2], [0.2, 0.32], [0.215, 0.46], [0.215, 0.52], [0.175, 0.585], [0.095, 0.62], [0.068, 0.64], [0, 0.64]].map(([radius, y]) => new Vector2(radius, y)), 28)
    part(spine, 'cloth', coat.scale(1, 1, 0.62))
    // His head on his collar, the crown of his hat 0.4 m over it
    neck.position.set(0, collarY, 0)
    const hat = new BowlerGeometry
    const brim = 0.4 - hat.felt.boundingBox!.max.y * hatScale
    const head: Vec3 = [0, brim - 0.043, 0.035]
    const face = head[2] + 0.105
    part(neck, 'cloth', place(hat.felt.scale(hatScale, hatScale, hatScale), 0, brim, head[2]))
    part(neck, 'cloth', place(hat.ribbon.scale(hatScale, hatScale, hatScale), 0, brim, head[2]))
    // His hair, as dark as his coat, down the back of his head to his nape, which is all a window behind him shows of it
    part(neck, 'cloth', ball([0.099, 0.104, 0.1], 0, head[1] + 0.02, head[2] - 0.032))
    part(neck, 'skin', limb([0, 0, 0], [0, head[1] - 0.07, head[2] - 0.01], 0.05))
    part(neck, 'skin', ball([0.092, 0.118, 0.105], ...head))
    for (const side of sides) {
      part(neck, 'skin', ball([0.012, 0.03, 0.02], side * 0.092, head[1] - 0.008, head[2] - 0.005, 8))
    }
    // The slop in front of his face, all there is to see of it, with two drips running down from it
    part(neck, 'slime', ball([0.064, 0.078, 0.04], 0, head[1] - 0.012, face))
    part(neck, 'slime', ball([0.015, 0.034, 0.016], -0.022, head[1] - 0.088, face + 0.004, 10))
    part(neck, 'slime', ball([0.011, 0.024, 0.012], 0.026, head[1] - 0.08, face + 0.002, 10))
    this.upperArms = sided(side => {
      const bone = new Bone
      bone.position.set(side * shoulderX, shoulderY, 0)
      part(bone, 'cloth', limb([0, 0, 0], [0, -upperArm, 0], 0.064))
      return bone
    })
    this.forearms = sided(side => {
      const bone = new Bone
      bone.position.set(0, -upperArm, 0)
      this.upperArms[side].add(bone)
      part(bone, 'cloth', limb([0, 0, 0], [0, -forearm, 0], sleeve))
      // His hand, flat and long, a little under the line of his forearm
      part(bone, 'skin', ball([0.044, 0.062, 0.028], 0, -forearm - hand, -0.014))
      return bone
    })
    this.thighs = sided(side => {
      const bone = new Bone
      bone.position.set(side * hipX, hipY, hipForward)
      part(bone, 'cloth', limb([0, 0, 0], [0, -thigh, 0], trousers))
      return bone
    })
    this.shins = sided(side => {
      const bone = new Bone
      bone.position.set(0, -thigh, 0)
      this.thighs[side].add(bone)
      // Tucked a little under and in front of the end of his thigh, which reads as a bent knee
      part(bone, 'cloth', limb([0, -0.025, 0.02], [0, -shin, 0], 0.06))
      return bone
    })
    this.feet = sided(side => {
      const bone = new Bone
      // His shoes stand flat on the floor, pointing a little apart.
      const shoe = roundedBox([0.1, 0.075, 0.27], 0.035)
      part(bone, 'cloth', place(shoe.rotateY(side * 0.12), side * 0.007, 0.0375 - ankleY, 0.07))
      return bone
    })
    // His cane of polished wood: its shaft down from under the handle to a ferrule a little thicker, its handle forward over it
    // A shaft as thin as a finger needs few faces round it from afar.
    part(cane, 'cane', limb([0, 0, 0], [0, 0.014 - caneLength, 0], caneRadius, 8, 2))
    part(cane, 'cane', limb([0, 0.04 - caneLength, 0], [0, 0.014 - caneLength, 0], 0.014, 8, 2))
    part(cane, 'cane', limb([0, 0, -0.025], [0, 0, 0.085], handleRadius, 8, 3))
    root.add(pelvis, cane, this.feet[-1], this.feet[1])
    pelvis.add(spine, this.thighs[-1], this.thighs[1])
    spine.add(neck, this.upperArms[-1], this.upperArms[1])
    this.stand()
  }

  dispose() {
    for (const {geometry} of this.parts) {
      geometry.dispose()
    }
  }

  /** Poses him to reach for the goals: his pelvis where they say and leaning as far, his legs bent toward their knees with his shoes flat on the floor at their ankles, his arms bent toward their elbows with his hands where they say, and his cane from its grip toward its tip. */
  follow({ankles, elbows, grip, hands, knees, lean, pelvis, tip}: SloperatorGoals) {
    this.pelvis.position.copy(pelvis)
    this.spine.rotation.set(-lean, 0, 0)
    this.neck.rotation.set(lean, 0, 0)
    for (const side of sides) {
      const hip = this.jointOf(this.thighs[side])
      this.aim(this.thighs[side], bend(hip, ankles[side], thigh, shin, knees[side].clone().sub(hip)))
      this.aim(this.shins[side], ankles[side])
      this.feet[side].position.copy(ankles[side])
      this.reach(side, hands[side], elbows[side].clone().sub(this.jointOf(this.upperArms[side])))
    }
    this.holdCane(grip, tip)
    return this
  }

  /** Where his limbs reach as he is posed now, which {@link SloperatorRig.follow} poses him like again. */
  goals(): SloperatorGoals {
    return {
      ankles: sided(side => this.feet[side].position.clone()),
      elbows: sided(side => this.jointOf(this.forearms[side])),
      grip: this.cane.position.clone(),
      hands: sided(side => this.pointOn(this.forearms[side], [0, -forearm - hand, 0])),
      knees: sided(side => this.jointOf(this.shins[side])),
      lean: this.neck.rotation.x,
      pelvis: this.pelvis.position.clone(),
      tip: this.pointOn(this.cane, [0, -caneLength, 0]),
    }
  }

  /**
   * Seats him on the seat, his thighs on it and his feet on the floor in front of it.
   * In a seat with arms, he leans back with his forearms on their rolls, his right fist holding his cane by its handle, its shaft pointing to his left across in front of him and resting on his left forearm. On a bench, he sits upright, his knees apart round his cane standing on the floor between his feet, his hands stacked on its handle.
   */
  sit({arms, height, lean = 0}: SloperatorSeat) {
    this.pelvis.position.set(0, height, hipZ)
    this.spine.rotation.set(-lean, 0, 0)
    this.neck.rotation.set(lean, 0, 0)
    let ankleZ = 0
    for (const side of sides) {
      // His thighs lie on the seat, apart toward his knees, and his shins reach down to the floor in front of it.
      const knee = new Vector3(side * (arms ? 0.025 : 0.11), 0.005, 0.4)
      knee.setLength(thigh).add(this.jointOf(this.thighs[side]))
      const ankle = new Vector3(side * (arms ? ankleX : 0.16), ankleY, 0)
      ankle.z = knee.z + Math.sqrt(Math.max(shin ** 2 - (knee.y - ankle.y) ** 2 - (knee.x - ankle.x) ** 2, 0))
      ankleZ = ankle.z
      this.aim(this.thighs[side], knee)
      this.aim(this.shins[side], ankle)
      this.feet[side].position.copy(ankle)
      if (!arms) {
        continue
      }
      // His forearm lies along the roll of the seat’s arm, a little in from its middle, his elbow as far back on it as his upper arm reaches.
      const shoulder = this.jointOf(this.upperArms[side])
      const inward = 0.085
      const elbow = new Vector3(side * (arms.x - inward), arms.height + Math.sqrt((arms.radius + sleeve) ** 2 - inward ** 2), 0)
      elbow.z = shoulder.z - Math.sqrt(Math.max(upperArm ** 2 - (elbow.x - shoulder.x) ** 2 - (elbow.y - shoulder.y) ** 2, 0))
      this.aim(this.upperArms[side], elbow)
      this.aim(this.forearms[side], elbow.clone().add(new Vector3(side * 0.01, 0, forearm)))
    }
    if (arms) {
      // The shaft lies on top of his left sleeve just short of its cuff, clear of his left hand under it and of his coat behind it.
      const rest = this.pointOn(this.forearms[1], [0, 0.01 - forearm, 0])
      rest.y += sleeve + caneRadius
      this.holdCane(this.pointOn(this.forearms[-1], [0, -forearm - hand, -0.014]), rest)
    } else {
      // Its tip stands between his shoes, a little in front of his ankles, and the cane leans back toward him.
      this.standCane(new Vector3(0, 0, ankleZ + 0.06), 0.1)
      this.handsOnCane(side => new Vector3(side, -0.6, -0.2))
    }
    return this
  }

  /** Stands him up where he would sit, his knees all but straight over his ankles, his cane standing on the floor between the toes of his shoes and his hands stacked on its handle, his elbows out to his sides. */
  stand() {
    const leg = thigh + shin - kneeSlack
    this.pelvis.position.set(0, ankleY - hipY + Math.sqrt(leg ** 2 - (ankleX - hipX) ** 2), hipZ)
    this.spine.rotation.set(0, 0, 0)
    this.neck.rotation.set(0, 0, 0)
    let ankleZ = 0
    for (const side of sides) {
      const hip = this.jointOf(this.thighs[side])
      const ankle = new Vector3(side * ankleX, ankleY, hip.z)
      ankleZ = ankle.z
      this.aim(this.thighs[side], bend(hip, ankle, thigh, shin, new Vector3(0, 0, 1)))
      this.aim(this.shins[side], ankle)
      this.feet[side].position.copy(ankle)
    }
    this.standCane(new Vector3(0, 0, ankleZ + 0.2), 0.07)
    this.handsOnCane(side => new Vector3(side, -0.3, -0.6))
    return this
  }

  /** Turns the bone so it runs from its joint toward the point in his frame. */
  private aim(bone: Bone, target: Vector3) {
    const direction = target.clone().sub(this.jointOf(bone)).normalize()
    const turn = new Quaternion
    turn.setFromUnitVectors(down, direction)
    const parent = new Quaternion
    bone.parent!.getWorldQuaternion(parent)
    bone.quaternion.copy(parent.invert().multiply(turn))
  }

  /** Rests his hands on the top of his cane’s handle, his left on it and his right on his left, each a little toward its own side, his elbows bent toward `pole` of each side. */
  private handsOnCane(pole: (side: Side) => Vector3) {
    const top = this.pointOn(this.cane, [0, 0, handleForward])
    for (const side of sides) {
      const middle = new Vector3(side * 0.01, handleRadius + onHandle + (side < 0 ? onHand : 0), 0)
      this.reach(side, middle.add(top), pole(side))
    }
  }

  /** Puts his cane where he holds it under its handle at `grip`, its shaft pointing toward `toward`, and up as far as it would reach into the floor, so it rests its tip on it. */
  private holdCane(grip: Vector3, toward: Vector3) {
    this.cane.position.copy(grip)
    this.aim(this.cane, toward)
    const {y} = this.pointOn(this.cane, [0, -caneLength, 0])
    if (y < 0) {
      this.cane.position.y -= y
    }
  }

  /** Where the bone’s joint lies in his frame, as he is posed so far. */
  private jointOf(bone: Bone) {
    this.root.updateMatrixWorld(true)
    const joint = new Vector3
    return bone.getWorldPosition(joint)
  }

  /** The point at `[x, y, z]` in the bone’s own frame, in his frame, as he is posed so far. */
  private pointOn(bone: Bone, [x, y, z]: Vec3) {
    this.root.updateMatrixWorld(true)
    const point = new Vector3(x, y, z)
    return bone.localToWorld(point)
  }

  /** Bends his arm of the side so the middle of his hand lies at `target`, his elbow bent toward `pole`. */
  private reach(side: Side, target: Vector3, pole: Vector3) {
    const shoulder = this.jointOf(this.upperArms[side])
    this.aim(this.upperArms[side], bend(shoulder, target, upperArm, forearm + hand, pole))
    this.aim(this.forearms[side], target)
  }

  /** Stands his cane on its tip on the floor at `tip`, leaning back toward him by `lean`, in radians. */
  private standCane(tip: Vector3, lean: number) {
    const grip = new Vector3(0, caneLength * Math.cos(lean), -caneLength * Math.sin(lean))
    this.holdCane(grip.add(tip), tip)
  }
}
