import type {Vec3} from '../types.ts'
import type {SloperatorSeatedSight, SloperatorSight} from './sights.ts'
import type {SloperatorSeat} from './SloperatorGeometry.ts'
import type {RapierCollider, RapierContext, RapierRigidBody} from '@react-three/rapier'

import {Box3, Quaternion, Vector3} from 'three/webgpu'

import {inFrame} from './sights.ts'
import SloperatorGeometry from './SloperatorGeometry.ts'

/** how the Sloperator turns up at a sight: on a seat, `sit_armchair` leaning back in one with arms, or on his feet where it stood */
export type SloperatorPose = 'sit' | 'sit_armchair' | 'stand'
/** where and how the Sloperator turns up at a sight */
export type SloperatorPlacement = {
  /** whether what he is on never moves, like a fixed seat, unlike a seat the physics moves or the floor */
  fixed: boolean
  pose: SloperatorPose
  /** the point on the floor under where he sits or stands, in the museum’s meters */
  position: Vec3
  /** how high over that point the top of what he is on lies: his seat’s, or the floor’s at 0 */
  surface: number
  /** which way he faces, as his turn around y in radians */
  yaw: number
}
/**
 * What became of the player entering a sight’s fence, which the physics answers once: he turns up, his seat `present` where it stood when the game began, `moved` a little, which he followed, or `missing`, gone farther or tipped over, so he stands where it stood, or with `none` at a sight without a seat, where he stands anyway.
 * Or he stays away: his seat `moved` too far to sit on it, though not far enough to stand where it stood, or something else `blocked` the box he takes up there, see {@link figureBounds}.
 */
export type SloperatorSpawn = {
  detection: 'blocked' | 'moved'
  result: 'failure'
} | {
  detection: 'missing' | 'moved' | 'none' | 'present'
  placement: SloperatorPlacement
  result: 'success'
}
/** how a rigid body stands: its translation and its rotation */
export type BodyPose = {
  rotation: {
    w: number
    x: number
    y: number
    z: number
  }
  translation: {
    x: number
    y: number
    z: number
  }
}
type Physics = Pick<RapierContext, 'rapier' | 'world'>

/** How far his seat may have strayed from where it stood when the game began for him to still sit on it, where it went: farther, or tipped over, it is no seat of his anymore. */
export const seatStray = {
  /** how far the spot he sits on may have moved along the floor, in meters */
  reach: 0.3,
  /** how far it may have turned, in radians */
  turn: 20 * Math.PI / 180,
  /** how far it may have risen or sunk, in meters */
  lift: 0.03,
  /** how far it may lean from upright, in radians */
  tilt: 5 * Math.PI / 180,
} as const
/** How little his seat may have strayed to still count as where it stood when the game began, rather than moved, which keeps the physics settling it from counting. */
export const seatSettled = {
  /** how far the spot he sits on may have moved along the floor, in meters */
  reach: 0.01,
  /** how far it may have turned, in radians */
  turn: Math.PI / 180,
} as const
/** how far over the floor under him the box he takes up starts, so the floor itself never stands in his way, in meters */
const floorClearance = 0.01
/** at how many moments of his move into his sight pose the box he takes up is taken round him */
const motionSamples = 40
const figureBoxes = new Map<SloperatorSeat | undefined, Box3>
/**
 * The box round all of him from his neutral pose through his sight pose, in his frame, see {@link SloperatorGeometry}: on the `seat`, sitting, standing up in front of it and standing where he sits, as he would where it is gone; without one, standing, with his hands on his cane and behind his back.
 * What lies in it would stand in his way, see {@link inTheWay}.
 */
export function figureBounds(seat?: SloperatorSeat) {
  let box = figureBoxes.get(seat)
  if (!box) {
    const figure = new SloperatorGeometry(seat)
    box = boxOf(figure)
    for (let sample = 1; sample <= motionSamples; sample++) {
      figure.pose(sample / motionSamples)
      box.union(boxOf(figure))
    }
    figure.dispose()
    if (seat) {
      box.union(figureBounds())
    }
    figureBoxes.set(seat, box)
  }
  return box
}

/** The rigid body of the physics named `name`, like a sight’s furniture, see {@link SloperatorSight.furniture}. */
export function furnitureBody({rigidBodyStates, world}: Pick<RapierContext, 'rigidBodyStates' | 'world'>, name: string): RapierRigidBody | undefined {
  for (const [handle, {object}] of rigidBodyStates) {
    if (object.name === name) {
      return world.getRigidBody(handle)
    }
  }
}

/**
 * How far the sight’s furniture, standing as `pose` says, the rigid body’s translation and rotation, strayed from where it stood when the game began: how far the spot he sits on moved along the floor and where it lies now, how far the furniture rose or sank, in meters, and how far it turned around y and leans from upright, in radians.
 */
export function seatStrayed({furniture, position: [x, y, z]}: SloperatorSeatedSight, {rotation, translation}: BodyPose) {
  const turn = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
  const upright = new Vector3(0, 1, 0)
  upright.applyQuaternion(turn)
  const forward = new Vector3(0, 0, 1)
  forward.applyQuaternion(turn)
  const turnedFrom = Math.atan2(forward.x, forward.z) - furniture.yaw
  /** how far it turned from where it stood, the short way round */
  const turned = Math.atan2(Math.sin(turnedFrom), Math.cos(turnedFrom))
  const lifted = translation.y - furniture.position[1]
  // Where he sits in the furniture’s frame, which turned and moved along the floor with it
  const [originX, , originZ] = furniture.position
  const [dx, dz] = [x - originX, z - originZ]
  const cos = Math.cos(furniture.yaw)
  const sin = Math.sin(furniture.yaw)
  const spot = inFrame([translation.x, y + lifted, translation.z], furniture.yaw + turned, dx * cos - dz * sin, dx * sin + dz * cos)
  return {
    lifted,
    moved: Math.hypot(spot[0] - x, spot[2] - z),
    spot,
    tilted: Math.acos(Math.min(upright.y, 1)),
    turned,
  }
}

/**
 * Where he sits on the sight’s furniture standing as `pose` says, the rigid body’s translation and rotation: where he sits on it when it stands where it stood when the game began, and moved and turned along with it where it strayed a little, see {@link seatStray}. Undefined where it strayed farther or tipped over.
 * He sits level and on its seat however it is turned; only its turn around y turns him along.
 */
export function seatOn(sight: SloperatorSeatedSight, pose: BodyPose): Omit<SloperatorPlacement, 'fixed'> | undefined {
  const {lifted, moved, spot, tilted, turned} = seatStrayed(sight, pose)
  if (tilted > seatStray.tilt || Math.abs(turned) > seatStray.turn || Math.abs(lifted) > seatStray.lift || moved > seatStray.reach) {
    return
  }
  return {
    pose: sight.seat.arms ? 'sit_armchair' : 'sit',
    position: spot,
    surface: sight.seat.height,
    yaw: sight.yaw + turned,
  }
}

/** How far the floor sloping as `slope` says rises under the box he takes up standing, see {@link figureBounds}, turned by `yaw`, over the point under him: as far as under the corner of the box it rises highest under. Nothing on a level floor. */
export function floorRise(yaw: number, slope?: SloperatorSight['slope']) {
  if (!slope) {
    return 0
  }
  const {min, max} = figureBounds()
  let rise = 0
  for (const x of [min.x, max.x]) {
    for (const z of [min.z, max.z]) {
      const [cornerX, , cornerZ] = inFrame([0, 0, 0], yaw, x, z)
      rise = Math.max(rise, slope.grade * (cornerX * Math.sin(slope.yaw) + cornerZ * Math.cos(slope.yaw)))
    }
  }
  return rise
}

/** Every collider of the physics but a sensor or one of `own` that lies in the box he takes up on the `seat` or standing without one, placed as `placement` says, see {@link figureBounds}, on a floor sloping as `slope` says: the box starts over where the floor rises highest under it, see {@link floorRise}. */
export function inTheWay({rapier, world}: Physics, {position, seat, slope, yaw}: Pick<SloperatorPlacement, 'position' | 'yaw'> & Pick<SloperatorSight, 'seat' | 'slope'>, own?: RapierRigidBody) {
  const {min, max} = figureBounds(seat)
  const bottom = Math.max(min.y, floorRise(yaw, slope) + floorClearance)
  const [centerX, , centerZ] = inFrame(position, yaw, (min.x + max.x) / 2, (min.z + max.z) / 2)
  const box = new rapier.Cuboid((max.x - min.x) / 2, (max.y - bottom) / 2, (max.z - min.z) / 2)
  const found: Array<RapierCollider> = []
  world.intersectionsWithShape({
    x: centerX,
    y: position[1] + (bottom + max.y) / 2,
    z: centerZ,
  }, {
    x: 0,
    y: Math.sin(yaw / 2),
    z: 0,
    w: Math.cos(yaw / 2),
  }, box, collider => {
    found.push(collider)
    return true
  }, rapier.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, own)
  return found
}

/**
 * What becomes of the player entering the sight’s fence as the physics stands now, which it asks once, with `seat`, the sight’s furniture, if the physics has it, see {@link SloperatorSpawn}:
 * he sits on his seat where it stood when the game began, on it where it went if it strayed a little, see {@link seatOn}, or, where it is gone, stands on his feet where he would have sat, as he always does at a sight without a seat.
 * Anything but his seat in the box he takes up there from his neutral pose through his sight pose keeps him away, see {@link inTheWay}; once he would stand, his seat counts too, since he would stand in it, which tells it moved too little to be gone.
 */
export function placeSloperator(physics: Physics, sight: SloperatorSight, seat?: RapierRigidBody): SloperatorSpawn {
  if (sight.furniture && seat) {
    const pose = {
      rotation: seat.rotation(),
      translation: seat.translation(),
    }
    const seated = seatOn(sight, pose)
    if (seated) {
      if (inTheWay(physics, {
        ...seated,
        seat: sight.seat,
      }, seat).length > 0) {
        return {
          detection: 'blocked',
          result: 'failure',
        }
      }
      const {moved, turned} = seatStrayed(sight, pose)
      return {
        detection: moved <= seatSettled.reach && Math.abs(turned) <= seatSettled.turn ? 'present' : 'moved',
        placement: {
          ...seated,
          fixed: seat.isFixed(),
        },
        result: 'success',
      }
    }
  }
  const standing: SloperatorPlacement = {
    fixed: false,
    pose: 'stand',
    position: sight.position,
    surface: 0,
    yaw: sight.yaw,
  }
  const found = inTheWay(physics, {
    ...standing,
    slope: sight.slope,
  })
  if (found.length === 0) {
    return {
      detection: sight.furniture ? 'missing' : 'none',
      placement: standing,
      result: 'success',
    }
  }
  return {
    detection: seat && found.some(collider => collider.parent()?.handle === seat.handle) ? 'moved' : 'blocked',
    result: 'failure',
  }
}

/** The box round all of the figure as it is posed now. */
function boxOf(figure: SloperatorGeometry) {
  const box = new Box3
  for (const part of [figure.cane, figure.cloth, figure.skin, figure.slime]) {
    box.union(part.boundingBox!)
  }
  return box
}
