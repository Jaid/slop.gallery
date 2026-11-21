import type {Vec3} from '../gallery/types.ts'

import {defaultEgoOptions} from 'ego-player/motor'
import {clamp, degreesToRadians, vec3} from 'math'

/** the mass a throw is tuned around, in kg: an orb’s `orbMass` */
export const referenceMass = 2
/** how fast the player throws an orb standing still, in m/s; everything else leaves as fast as its mass lets it, see {@link throwSpeedFor} */
export const throwSpeed = 10
/** how much a throw lifts on top of where it is aimed, as a share of its speed: 2 m/s for an orb */
const defaultLift = 0.2
/** the share of the arm that swings with what it throws, in kg: anything much heavier takes all the arm has, so it leaves ever slower */
const armMass = 1
/** below about this mass, in kg, a thing gets little out of the arm and the air takes the rest, like a leaf or a scrap of paper */
const graspMass = 0.1
/** how fast the player runs flat out, in m/s, for a throw’s full run-up */
export const sprintSpeed = defaultEgoOptions.speed * defaultEgoOptions.sprintFactor
/** how fast the player rises at the start of a jump, in m/s, for a full jump shot */
const jumpSpeed = Math.sqrt(2 * defaultEgoOptions.gravity * defaultEgoOptions.jumpHeight)
/** how much a run-up flat out adds to a throw’s own speed */
const driveBoost = 0.2
/** how far a throw at the start of a jump turns up from where it is aimed, like a jump shot, in radians */
const riseTilt = degreesToRadians(40)
/** how much softer a jump shot leaves than a throw from the ground, so it lobs up high and drops steeply instead of flying off far */
const riseSoftening = 0.4
/** the steepest a throw ever leaves, in radians from level */
const steepest = degreesToRadians(85)
/** how a thrown orb tumbles, in radians per second, and anything else by its speed */
export const throwSpin: Vec3 = [3, 2, 1]
/** how much a prop let go of on the move tumbles, as a share of a throw’s spin at the same speed */
const dropSpin = 0.3
/** How well the arm throws a thing of `mass`, in kg, before scaling to {@link throwSpeed}: the arm’s swing shared with the mass, held back for light things. */
const armShare = (mass: number) => Math.sqrt(armMass / (armMass + mass) * mass / (mass + graspMass))

/** what lets go of a prop and how */
export type TossInput = {
  /** how fast the one letting go moves, in m/s, which the prop carries on with: the player’s capsule’s actual velocity */
  carrier?: Vec3
  /** where a throw is aimed, like the view’s direction; needs no unit length */
  direction: Vec3
  /** how much a throw lifts on top of where it is aimed, as a share of its speed, a fifth by default */
  lift?: number
  /** the prop’s mass in kg */
  mass: number
  /** how fast the arm throws it standing still, in m/s, by its mass by default, see {@link throwSpeedFor} */
  speed?: number
  /** whether it is thrown, or just let go of */
  throwing: boolean
}

/** how a prop leaves the hand, and why, for whatever follows from it, like its sound */
export type Toss = {
  /** the velocity the one letting go gave it, in m/s */
  carried: Vec3
  /** how much of a run-up flat out, 0–1, went into the throw, square to nothing for a drop */
  drive: number
  /** how fast the arm sent it, in m/s, apart from what it carried: none for a drop */
  effort: number
  /** its mass in kg */
  mass: number
  /** how much of the rise at the start of a jump, 0–1, went into the throw, none for a drop */
  rise: number
  /** how it tumbles, in radians per second */
  spin: Vec3
  /** whether it was thrown, rather than let go of */
  throwing: boolean
  /** the velocity it leaves with, in m/s: the arm’s throw on top of what it carried */
  velocity: Vec3
}
/**
 * How fast the player throws a thing of `mass` kg standing still, in m/s: {@link throwSpeed} for an orb, fastest at about 0.3 kg (13.5 m/s), slower for anything lighter, like a leaf (4.8 m/s), and ever slower for anything heavier, like a pumpkin (7.5 m/s) or a Knot (3.9 m/s).
 * Heavy things are thrown with all the arm’s swing, which their mass has to share; light ones catch on the air and slip out of the hand, which a speed stands in for, since nothing else in the physics slows them. A mass that isn’t positive, like one unknown, throws like an orb.
 */
export function throwSpeedFor(mass: number) {
  if (!(mass > 0) || !Number.isFinite(mass)) {
    return throwSpeed
  }
  return throwSpeed * armShare(mass) / armShare(referenceMass)
}

/**
 * How a prop of `mass` leaves the hand, thrown along `direction` or let go of, by someone moving at `carrier`.
 * It carries on with the carrier’s velocity either way, as a hand moves with its body, so a prop let go of on the run sails on ahead like a little throw, and one let go of mid-jump flies on up.
 * A throw adds the arm’s speed for its mass (see {@link throwSpeedFor}) along `direction` and a lift of a fifth of that. Running into it adds up to a fifth to the arm’s speed, with lift to match; rising at the start of a jump turns it up to 40° higher and two fifths softer, so it lobs up in a high arc and drops steeply like a jump shot. Both scale with how much of the run or the jump’s speed there is, and only toward the throw: backing away or falling only takes from it what the carrier’s velocity does.
 */
export function toss({carrier = [0, 0, 0], direction, lift: liftShare = defaultLift, mass, speed = throwSpeedFor(mass), throwing}: TossInput): Toss {
  const carried: Vec3 = [...carrier]
  if (!throwing) {
    const tumble = dropSpin * vec3.length(carried) / throwSpeed
    return {
      carried,
      drive: 0,
      effort: 0,
      mass,
      rise: 0,
      spin: vec3.scale(vec3.create(), throwSpin, tumble),
      throwing,
      velocity: carried,
    }
  }
  const [x, y, z] = vec3.normalize(vec3.create(), direction)
  const level = Math.hypot(x, z)
  const heading: Vec3 = level > 1e-6 ? [x / level, 0, z / level] : [0, 0, 0]
  const drive = clamp((carried[0] * heading[0] + carried[2] * heading[2]) / sprintSpeed, 0, 1)
  const rise = clamp(carried[1] / jumpSpeed, 0, 1)
  const effort = speed * (1 + driveBoost * drive) * (1 - riseSoftening * rise)
  // A jump shot turns the throw up in its own vertical plane; straight up or down it has no plane to turn in.
  const elevation = level > 1e-6 ? Math.min(Math.atan2(y, level) + riseTilt * rise, Math.max(steepest, Math.atan2(y, level))) : Math.sign(y) * Math.PI / 2
  const aim: Vec3 = level > 1e-6 ? [heading[0] * Math.cos(elevation), Math.sin(elevation), heading[2] * Math.cos(elevation)] : [0, Math.sign(y) || 1, 0]
  const lift = liftShare * effort
  const tumble = effort / throwSpeed
  return {
    carried,
    drive,
    effort,
    mass,
    rise,
    spin: vec3.scale(vec3.create(), throwSpin, tumble),
    throwing,
    velocity: [aim[0] * effort + carried[0], aim[1] * effort + lift + carried[1], aim[2] * effort + carried[2]],
  }
}
