import type {FusionOutcome} from './Fusion.ts'
import type {PortalFrame} from './portalFrame.ts'
import type {FusionTiming} from './timing.ts'

import {clamp, fade} from 'math'
import {Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {choreographed, departure, dragged, drags, ignition, implosion, introClock, introSeconds, release, whirl, whirled, whirlRate, yank} from './intro.ts'

/** radians per second the satellites circle the portal at while it brews */
export const orbitSpeed = 1.45
/** how many more radians per second cubed the satellites gain as they spiral into the portal during the climax */
const spinUp = 4.2
/** the share of the climax after which the satellites start shrinking into the portal */
const shrinkFrom = 0.35
/** the share of the fizzle the orbit stutters on before the work flies home and the rest is spat out */
export const fizzleRelease = 0.3
/** radians per second a prop tumbles around its axis while it orbits */
export const tumbleSpeed = 1.9
/** how far the tethers pull the satellites in while the intro whirls them, as a share of the orbit */
const tightened = 0.1
/** how far out along the wall the ring of fire’s landing knocks the satellites at most, as a share of their distance from the portal’s middle */
const knockReach = 0.5
/** seconds after the landing that the knock has flung them out furthest */
const knockPeak = 0.15
/** seconds after the landing from which they are back in their orbit, the lull’s */
const knockBack = 1.5

/** something orbiting a fusion’s portal: the work or what was thrown into it */
export type SatelliteOrbit = {
  /** when the ember beats to yank it in, in seconds of the intro’s choreography, see `emberRhythm` */
  beat: number
  /** where it rests when the fusion hands it back, for the work its spot on the wall; others don’t return */
  home?: Pose
  /** the order of its ingredient, 0 for the work, which the pull drags them in by */
  index: number
  /** its orbit angle when the fusion starts, opposite of the other one’s */
  phase: number
  /** how much it shrinks while orbiting */
  scale: number
  /** its pose in the world when the fusion seized it */
  start: Pose
  /** the axis a prop tumbles around while orbiting; works face the room instead */
  tumble?: Vector3
}
export type Pose = {
  position: Vector3
  quaternion: Quaternion
}
export type SatellitePose = Pose & {scale: number}

const up = new Vector3(0, 1, 0)
const x = new Vector3
const y = new Vector3
const z = new Vector3
const basis = new Matrix4
const roll = new Quaternion
const turn = new Quaternion
const target = new Quaternion
const normal = new Vector3
const tangent = new Vector3
const center = new Vector3
const toward = new Vector3
const offset = new Vector3
const unwhirled = new Vector3
const whirledTo = new Vector3
const facingBefore = new Quaternion
const facingAfter = new Quaternion
const away = new Vector3
const middle = new Vector3
/** how far out beyond its place on the orbit the burst knocks a satellite, as a share of the orbit */
const drift = 1.3
const from: SatellitePose = {
  position: new Vector3,
  quaternion: new Quaternion,
  scale: 1,
}

/** How far out along the wall the ring of fire’s landing as the intro ends has knocked the satellites `elapsed` seconds into the fusion, as a share of their distance from the portal’s middle: flung out at once by its shockwave, they drift back in and are exactly in their orbit again {@link knockBack} seconds after it. */
export function landingKnock(elapsed: number, {intro}: Pick<FusionTiming, 'intro'>) {
  const after = elapsed - intro
  if (after <= 0 || after >= knockBack) {
    return 0
  }
  return knockReach * after / knockPeak * Math.exp(1 - after / knockPeak) * (1 - (after / knockBack) ** 4)
}

/** The orbit angle `elapsed` seconds into a fusion, speeding up through a climax that starts `at` seconds in. */
export function orbitAngle(phase: number, elapsed: number, climax?: {
  at: number
  duration: number
}) {
  if (!climax || elapsed <= climax.at) {
    return phase + orbitSpeed * elapsed
  }
  const progress = clamp((elapsed - climax.at) / climax.duration, 0, 1)
  return phase + orbitSpeed * climax.at + climax.duration * (orbitSpeed * progress + spinUp * progress ** 3)
}

/** The orbit angle of a satellite that rests until `setOff` seconds in and then speeds up evenly to the orbit’s speed over `ramp` seconds, from where it joins the orbit exactly. */
export function rampedAngle(phase: number, elapsed: number, setOff: number, ramp: number) {
  const rest = phase + orbitSpeed * (setOff + ramp / 2)
  if (elapsed <= setOff) {
    return rest
  }
  if (elapsed < setOff + ramp) {
    return rest + orbitSpeed * (elapsed - setOff) ** 2 / (2 * ramp)
  }
  return phase + orbitSpeed * elapsed
}

/** Where on the orbit the angle lies, `reach` of the way out from the portal’s middle. Its side toward the room passes lower, its side toward the wall higher. */
export function orbitPoint(frame: PortalFrame, angle: number, reach: number, out: Vector3) {
  const {along, across, tilt} = frame.orbit
  const cos = Math.cos(angle) * reach
  const sin = Math.sin(angle) * reach
  return out.fromArray(frame.center)
    .addScaledVector(tangent.fromArray(frame.tangent), along * cos)
    .addScaledVector(normal.fromArray(frame.normal), across * sin)
    .addScaledVector(up, -tilt * sin)
}

/** How a work at the point faces: toward the room, turned a little out from the portal, rocking gently around its own axis. */
export function orbitFacing(frame: PortalFrame, point: Vector3, wobble: number, out: Quaternion) {
  z.fromArray(frame.center).subVectors(point, z).multiplyScalar(0.55).add(normal.fromArray(frame.normal)).normalize()
  x.crossVectors(up, z).normalize()
  y.crossVectors(z, x)
  out.setFromRotationMatrix(basis.makeBasis(x, y, z))
  return out.multiply(roll.setFromAxisAngle(z.set(0, 0, 1), wobble))
}

/**
 * The satellite’s pose in the world `elapsed` seconds into the fusion: the intro takes it from where it was seized into orbit, the ring of fire landing as it ends knocks it out for a moment, it circles the portal and, on success, spirals into it during the climax, shrinking away.
 * On failure, the orbit stutters through the first part of the fizzle; then the work flies home to its wall, while anything else is spat out, which the caller does.
 */
export function satellitePose(frame: PortalFrame, timing: FusionTiming, satellite: SatelliteOrbit, elapsed: number, outcome: FusionOutcome | undefined, out: SatellitePose): SatellitePose {
  if (outcome?.kind === 'success' && elapsed > outcome.at) {
    const progress = clamp((elapsed - outcome.at) / timing.climax, 0, 1)
    const angle = orbitAngle(satellite.phase, elapsed, {
      at: outcome.at,
      duration: timing.climax,
    })
    orbiting(frame, satellite, elapsed, angle, (1 - progress) ** 2, out)
    knockOut(frame, out.position, landingKnock(elapsed, timing))
    out.scale = satellite.scale * (1 - fade(clamp((progress - shrinkFrom) / (0.95 - shrinkFrom), 0, 1)))
    return out
  }
  if (outcome?.kind === 'failure' && elapsed > outcome.at) {
    const progress = clamp((elapsed - outcome.at) / timing.fizzle, 0, 1)
    if (progress <= fizzleRelease || !satellite.home) {
      return stuttering(frame, timing, satellite, elapsed, outcome.at, progress, out)
    }
    const released = outcome.at + fizzleRelease * timing.fizzle
    stuttering(frame, timing, satellite, released, outcome.at, fizzleRelease, from)
    const homing = fade((progress - fizzleRelease) / (1 - fizzleRelease))
    out.position.lerpVectors(from.position, satellite.home.position, homing).addScaledVector(normal.fromArray(frame.normal), Math.sin(Math.PI * homing) * 0.25)
    out.quaternion.slerpQuaternions(from.quaternion, satellite.home.quaternion, homing)
    out.scale = from.scale + (1 - from.scale) * homing
    return out
  }
  if (elapsed < timing.intro) {
    return entering(frame, timing, satellite, elapsed, out)
  }
  orbiting(frame, satellite, elapsed, orbitAngle(satellite.phase, elapsed), 1, out)
  knockOut(frame, out.position, landingKnock(elapsed, timing))
  return out
}

/** The satellite’s pose while it orbits freely at the angle, `reach` of the way out: a work faces the room, a prop tumbles. */
export function orbiting(frame: PortalFrame, satellite: SatelliteOrbit, elapsed: number, angle: number, reach: number, out: SatellitePose) {
  orbitPoint(frame, angle, reach, out.position)
  if (satellite.tumble) {
    out.quaternion.copy(satellite.start.quaternion).premultiply(turn.setFromAxisAngle(satellite.tumble, elapsed * tumbleSpeed))
  } else {
    orbitFacing(frame, out.position, Math.sin(elapsed * 1.3 + satellite.phase * 2) * 0.16, out.quaternion)
  }
  out.scale = satellite.scale
  return out
}

/** radians per second the satellites circle the portal at `elapsed` seconds into the intro: not at all until the last beat sets them off, and far faster while the portal whirls them */
export function introOrbitRate(elapsed: number, timing: FusionTiming) {
  return orbitSpeed * clamp((introClock(elapsed, timing) - ignition) / departure, 0, 1) + whirlRate(elapsed, timing)
}

/** Pushes the point away from the portal’s middle along the wall, by `share` of how far from it it lies there, never toward the wall or away from it, the way the shockwave runs out over the portal’s disc. */
function knockOut(frame: PortalFrame, point: Vector3, share: number) {
  if (share > 0) {
    normal.fromArray(frame.normal)
    away.subVectors(point, middle.fromArray(frame.center))
    point.addScaledVector(away.addScaledVector(normal, -away.dot(normal)), share)
  }
  return point
}
/** The orbit running down and shuddering through the start of a fizzle, `progress` of the way through it. */
function stuttering(frame: PortalFrame, timing: FusionTiming, satellite: SatelliteOrbit, elapsed: number, failedAt: number, progress: number, out: SatellitePose) {
  const stutter = Math.min(progress, fizzleRelease) * timing.fizzle
  const angle = orbitAngle(satellite.phase, failedAt) + orbitSpeed * (stutter - stutter ** 2 / (2 * fizzleRelease * timing.fizzle) * 0.8)
  orbiting(frame, satellite, elapsed, angle, 1 + Math.sin(elapsed * 47) * 0.035, out)
  knockOut(frame, out.position, landingKnock(elapsed, timing))
  return out
}
/** an elastic return from `displaced` to 0 over `seconds`, pushed on by `kick` at the start; exactly 0 from `seconds` on */
function spring(after: number, displaced: number, kick: number, seconds: number) {
  if (after <= 0) {
    return displaced
  }
  if (after >= seconds) {
    return 0
  }
  const decay = 4.2 / seconds
  const swing = 2.4 * Math.PI / seconds
  const taper = 1 - (after / seconds) ** 4
  return (displaced * Math.cos(swing * after) + kick * Math.sin(swing * after)) * Math.exp(-decay * after) * taper
}
/**
 * The satellite’s pose `elapsed` seconds into the intro (see `intro.ts`): torn loose and dragged toward the singularity, knocked back out into the air by its burst and, on its beat of the ember, yanked to its place beside it, from where the last beat sets it off around the portal, whirled extra laps on the portal’s tether.
 */
function entering(frame: PortalFrame, timing: FusionTiming, satellite: SatelliteOrbit, elapsed: number, out: SatellitePose) {
  const t = introClock(elapsed, timing)
  const {index} = satellite
  const yanked = satellite.beat + yank
  if (t < yanked) {
    return loose(frame, timing, satellite, t, out)
  }
  const angle = rampedAngle(satellite.phase, elapsed, introSeconds(ignition, timing), introSeconds(departure, timing))
  orbiting(frame, satellite, elapsed, angle, 1, out)
  // It bobs in its place until the last beat sets it off.
  const dangling = 1 - fade(clamp((t - ignition) / departure, 0, 1))
  out.position.addScaledVector(tangent.fromArray(frame.tangent), 0.05 * Math.sin(t * 3.1 + index) * dangling).addScaledVector(up, 0.03 * Math.sin(t * 4.3 + index * 2) * dangling)
  // Yanked from where it drifted, it springs past its place and back.
  loose(frame, timing, satellite, yanked, from)
  const after = t - yanked
  const pull = 1 - Math.exp(-after * 7) * Math.cos(after * 12)
  out.position.lerpVectors(from.position, out.position, pull)
  out.quaternion.slerpQuaternions(from.quaternion, target.copy(out.quaternion), clamp(pull, 0, 1))
  out.scale = from.scale + (out.scale - from.scale) * clamp(pull, 0, 1.1)
  if (t <= whirl) {
    return out
  }
  // The tether whirls it extra laps around the portal, pulled in a little, then lets go, and it coasts on out into the orbit, overshooting it and springing back.
  const letGo = t - release
  const reach = letGo < 0 ? 1 - tightened * fade(clamp((t - whirl) / 0.2, 0, 1)) : 1 + spring(introSeconds(letGo, timing), -tightened, 0.1, introSeconds(choreographed - release, timing))
  orbitPoint(frame, angle, 1, unwhirled)
  orbitPoint(frame, angle + whirled(t), reach, whirledTo)
  out.position.add(whirledTo).sub(unwhirled)
  if (!satellite.tumble) {
    // A work keeps facing the room from wherever the whirl takes it.
    orbitFacing(frame, unwhirled, 0, facingBefore)
    orbitFacing(frame, whirledTo, 0, facingAfter)
    out.quaternion.premultiply(facingAfter.multiply(facingBefore.invert()))
  }
  return out
}
/** Where the satellite is `t` seconds into the choreography until the ember yanks it in: rattling, then dragged toward the singularity, swirling and spinning, and knocked out by the burst to its own side, past the place the ember will yank it to, drifting there and still turning. */
function loose(frame: PortalFrame, timing: FusionTiming, satellite: SatelliteOrbit, t: number, out: SatellitePose) {
  const start = drags[Math.min(satellite.index, drags.length - 1)]
  center.fromArray(frame.center)
  toward.subVectors(center, satellite.start.position).normalize()
  out.position.copy(satellite.start.position)
  out.quaternion.copy(satellite.start.quaternion)
  out.scale = 1
  if (t < start) {
    // It rattles ever harder as the pull takes hold, until it tears loose.
    const shake = 3 * (t / start) ** 2 * (1 - t / start)
    out.position.addScaledVector(toward, 0.05 * shake * (1 + Math.sin(t * 53 + satellite.index * 2)))
    out.quaternion.premultiply(turn.setFromAxisAngle(toward, 0.12 * shake * Math.sin(t * 71)))
    return out
  }
  const drag = clamp((t - start) / (implosion - start), 0, 1)
  // It swirls the way the view does and spins around its fall.
  const swirl = 2.4 * drag ** 2
  offset.subVectors(satellite.start.position, center).applyAxisAngle(normal.fromArray(frame.normal), -swirl)
  out.position.copy(center).addScaledVector(offset, 1 - dragged * drag ** 2.3)
  out.quaternion.premultiply(turn.setFromAxisAngle(toward, 7 * drag ** 2.5 + Math.max(0, t - implosion) * 3))
  out.scale = 1 + (satellite.scale - 1) * 0.5 * drag
  if (t > implosion) {
    // The burst knocks it out to its own side, a little beyond the orbit, where it drifts.
    const after = t - implosion
    const knock = 1 - Math.exp(-after * 6)
    orbitPoint(frame, rampedAngle(satellite.phase, 0, introSeconds(ignition, timing), introSeconds(departure, timing)), drift, offset)
    offset.y += 0.04 * Math.sin(after * 2.6 + satellite.index * 2)
    out.position.lerp(offset, knock)
  }
  return out
}
