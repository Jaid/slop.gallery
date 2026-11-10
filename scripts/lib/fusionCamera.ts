import type {Vec3} from '#src/lib/gallery/types.ts'

import {clamp, fade} from 'math'

/** where the camera is and what it looks at, at a moment of the film */
export type Shot = {
  /** vertical field of view in degrees */
  fov: number
  position: Vec3
  /** degrees, positive tilts the camera counterclockwise */
  roll: number
  target: Vec3
}
/** the fusion’s moments, in seconds into the film */
export type Timeline = {
  /** when the result flips out of the portal */
  emergence: number
  /** the end of the film */
  end: number
  /** when the orb strikes the work and the fusion begins */
  strike: number
  /** when the orb is thrown */
  throwAt: number
}
/** a key of a camera path given by hand: where the camera is and what it looks at `time` seconds into the film */
export type CameraKey = Shot & {
  /** what it should show then, for whoever reads the path */
  note?: string
  time: number
}
/** a camera path given by hand, like the camera editor exports it: keys the camera passes through smoothly, see {@link keyedShot} */
export type CameraPath = {
  /** the end of the film, in seconds */
  end: number
  /** whether the fusion’s blows shake the camera and it sways a little, as if held by hand, see {@link handheld} */
  handheld: boolean
  keys: Array<CameraKey>
  note?: string
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, factor: number): Vec3 => [a[0] * factor, a[1] * factor, a[2] * factor]
export const length = (a: Vec3) => Math.hypot(...a)
export const normalize = (a: Vec3) => scale(a, 1 / (length(a) || 1))
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]
export const ease = (t: number) => fade(clamp(t, 0, 1))
export const radians = (degrees: number) => degrees * Math.PI / 180

/** Cubic Hermite through the keys’ values over their times, its slopes from the neighbors (Catmull–Rom), so the camera never stops at a key; it holds still before the first and after the last. */
export function throughKeys(keys: ReadonlyArray<ReadonlyArray<number>>, time: number) {
  if (time <= keys[0][0]) {
    return keys[0].slice(1)
  }
  const last = keys.length - 1
  if (time >= keys[last][0]) {
    return keys[last].slice(1)
  }
  const index = keys.findLastIndex(key => key[0] <= time)
  const slope = (at: number, value: number) => {
    if (at === 0 || at === last) {
      return 0
    }
    return (keys[at + 1][value] - keys[at - 1][value]) / (keys[at + 1][0] - keys[at - 1][0])
  }
  const [from, to] = [keys[index], keys[index + 1]]
  const span = to[0] - from[0]
  const u = (time - from[0]) / span
  return from.slice(1).map((value, field) => {
    const column = field + 1
    return (2 * u ** 3 - 3 * u ** 2 + 1) * value + (u ** 3 - 2 * u ** 2 + u) * span * slope(index, column) + (-2 * u ** 3 + 3 * u ** 2) * to[column] + (u ** 3 - u ** 2) * span * slope(index + 1, column)
  })
}

/** The shot `time` seconds into the film on the path smoothly through the keys, ordered by time, see {@link throughKeys}. */
export function keyedShot(keys: ReadonlyArray<CameraKey>, time: number): Shot {
  const [x, y, z, tx, ty, tz, fov, roll] = throughKeys(keys.map(key => [key.time, ...key.position, ...key.target, key.fov, key.roll]), time)
  return {
    position: [x, y, z],
    target: [tx, ty, tz],
    fov,
    roll,
  }
}

const isPoint = (value: unknown): value is Vec3 => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
/** The camera path in the JSON value, as the camera editor exports it, or an error telling what is wrong with it. */
export function parseCameraPath(value: unknown): CameraPath {
  const path = value as Partial<CameraPath> | null
  if (!path || typeof path !== 'object' || !Array.isArray(path.keys) || path.keys.length === 0) {
    throw new TypeError('A camera path is an object with at least one key in keys.')
  }
  if (!(Number.isFinite(path.end) && path.end! > 0)) {
    throw new TypeError('A camera path needs the end of the film in seconds, above 0.')
  }
  let previous = Number.NEGATIVE_INFINITY
  for (const [index, key] of path.keys.entries()) {
    if (!(Number.isFinite(key.time) && key.time > previous && isPoint(key.position) && isPoint(key.target) && Number.isFinite(key.fov) && key.fov > 0 && key.fov < 180 && Number.isFinite(key.roll))) {
      throw new TypeError(`Key ${index} of the camera path needs a time after the key before it, a position and a target of three numbers each, a field of view between 0 and 180 and a roll.`)
    }
    if (length(sub(key.target, key.position)) < 1e-6) {
      throw new TypeError(`Key ${index} of the camera path looks at where it is.`)
    }
    previous = key.time
  }
  return {
    end: path.end!,
    handheld: path.handheld !== false,
    keys: path.keys.map(({fov, note, position, roll, target, time}) => ({
      time,
      position,
      target,
      fov,
      roll,
      ...typeof note === 'string' && note ? {note} : {},
    })),
    ...typeof path.note === 'string' && path.note ? {note: path.note} : {},
  }
}

/** how a blow hits the camera `since` seconds after it: a jolt that peaks within a few frames and dies away over `decay` seconds */
const jolt = (since: number, decay: number) => (since < 0 ? 0 : (1 - Math.exp(-since / 0.05)) * Math.exp(-since / decay))
/** the blows the fusion deals the camera: when, how far it is pushed back in meters, how hard it shakes in degrees and how fast both die away in seconds */
export const blows = ({emergence, strike}: Pick<Timeline, 'emergence' | 'strike'>) => [
  // the orb strikes the work, which knocks the camera back for good, see throwMotion
  [strike, 0, 0.55, 0.35],
  // the singularity collapses and bursts
  [strike + 1.5, 0.34, 0.95, 0.7],
  // the ring of fire lands
  [strike + 4.5, 0.08, 0.45, 0.5],
  // the result flips out with a blaze
  [emergence, 0.2, 0.7, 0.6],
] as const

/** The shot as if the camera were held by hand `time` seconds into the film: the fusion’s blows push it back and shake it, and it sways a little. */
export function handheld(shot: Shot, time: number, timeline: Pick<Timeline, 'emergence' | 'strike'>): Shot {
  const look = normalize(sub(shot.target, shot.position))
  const right = normalize(cross(look, [0, 1, 0]))
  const up = cross(right, look)
  const distance = length(sub(shot.target, shot.position))
  let {position, target} = shot
  for (const [at, push, shake, decay] of blows(timeline)) {
    const since = time - at
    const hit = jolt(since, decay)
    if (hit === 0) {
      continue
    }
    position = add(position, scale(look, -push * hit))
    const tremble = radians(shake) * Math.exp(-since / (decay * 0.6))
    const sideways = Math.tan(tremble * (0.6 * Math.sin(2 * Math.PI * 17 * since + at) + 0.4 * Math.sin(2 * Math.PI * 29 * since + 2 * at))) * distance
    const upward = Math.tan(tremble * (0.6 * Math.sin(2 * Math.PI * 13 * since + 3 * at) + 0.4 * Math.sin(2 * Math.PI * 23 * since + at))) * distance
    target = add(target, add(scale(right, sideways), scale(up, upward)))
  }
  // A slight sway, as if held by hand
  const sway = (frequency: number, phase: number) => 0.6 * Math.sin(2 * Math.PI * frequency * time + phase) + 0.4 * Math.sin(2 * Math.PI * frequency * 2.3 * time + phase * 1.7)
  position = add(position, scale([sway(0.21, 0.3), sway(0.17, 1.9), sway(0.26, 4.1)], 0.012))
  target = add(target, scale([sway(0.19, 2.2), sway(0.23, 0.7), sway(0.15, 5.3)], 0.008))
  return {
    ...shot,
    position,
    target,
  }
}

/** Where a throw from the camera of `shot` leaves: where a carried orb floats, 0.55 m out and 15° below the middle of the view, see throw_prop. */
export function holdPoint({position, roll, target}: Shot): Vec3 {
  const look = normalize(sub(target, position))
  const right = normalize(cross(look, [0, 1, 0]))
  const up = cross(right, look)
  // The camera’s up as rolled, like the game’s YXZ Euler turns it about the view
  const tilted = add(scale(up, Math.cos(radians(roll))), scale(right, -Math.sin(radians(roll))))
  const tilt = radians(15)
  return add(add(position, scale(look, Math.cos(tilt) * 0.55)), scale(tilted, -Math.sin(tilt) * 0.55))
}

/** The shot as the yaw, pitch and roll in degrees of a film.ts keyframe: yaw 0 looks toward −z, positive turns left. */
export function shotAngles({position, roll, target}: Shot) {
  const [x, y, z] = sub(target, position)
  return {
    yaw: Math.atan2(-x, -z) * 180 / Math.PI,
    pitch: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI,
    roll,
  }
}
