import type {Vec3} from '../types.ts'

import {lerp, radiansToDegrees} from 'math'
import {easing} from 'math/time'

const back = 1.70158
const quadIn = (t: number) => t ** 2
const backIn = (t: number) => (back + 1) * t ** 3 - back * t ** 2
const out = (ease: (t: number) => number) => (t: number) => 1 - ease(1 - t)
const inOut = (ease: (t: number) => number) => (t: number) => (t < 0.5 ? ease(2 * t) / 2 : 1 - ease(2 - 2 * t) / 2)
/** Recipe IDs for progress curves from 0 to 1. */
export const tweens = {
  linear: easing.linear,
  hold: (t: number) => (t < 1 ? 0 : 1),
  easeInSine: easing.sineIn,
  easeOutSine: easing.sineOut,
  easeInOutSine: easing.sineInOut,
  easeInQuad: quadIn,
  easeOutQuad: out(quadIn),
  easeInOutQuad: inOut(quadIn),
  easeInCubic: easing.cubicIn,
  easeOutCubic: easing.cubicOut,
  easeInOutCubic: easing.cubicInOut,
  easeInQuart: easing.quartIn,
  easeOutQuart: easing.quartOut,
  easeInOutQuart: easing.quartInOut,
  easeInQuint: easing.quintIn,
  easeOutQuint: easing.quintOut,
  easeInOutQuint: easing.quintInOut,
  easeInExpo: easing.expoIn,
  easeOutExpo: easing.expoOut,
  easeInOutExpo: easing.expoInOut,
  easeInCirc: easing.circIn,
  easeOutCirc: easing.circOut,
  easeInOutCirc: easing.circInOut,
  easeInBack: backIn,
  easeOutBack: out(backIn),
  easeInOutBack: inOut(backIn),
}
export type Tween = keyof typeof tweens
export type CameraOrbit = {
  /** world-space point the camera circles and looks at */
  focus: Vec3
  /** world-space eye position at the start of the arc */
  from: Vec3
  /** easing for eye height; defaults to the keyframe’s tween */
  heightTween?: Tween
  /** world-space eye position at the end of the arc */
  to: Vec3
  /** whole revolutions to add to the shortest arc, positive toward increasing yaw */
  turns?: number
}
export type Keyframe = {
  /** vertical field of view in degrees */
  fov?: number
  /** An arc ending at this keyframe, starting at the previous position, yaw, pitch or orbit keyframe (or time 0). */
  orbit?: CameraOrbit
  /** degrees, positive looks up */
  pitch?: number
  /** camera (eye) position in meters */
  position?: Vec3
  /** degrees, positive tilts the view counterclockwise */
  roll?: number
  /** seconds since the start of the video */
  time: number
  /** the app’s WebMCP tools to run once at this keyframe’s moment, right before its frame, by name with their input, in order */
  tools?: Record<string, Record<string, unknown>>
  /** how the properties this keyframe sets travel toward it from their previous keyframe. Default: linear */
  tween?: Tween
  /** set_wireframe input from this keyframe on; radius and position travel with the tween, the other fields switch at the keyframe */
  wireframe?: Record<string, unknown>
  /** degrees, 0 looks toward −z, positive turns left; not wrapped, so 0 → 720 spins twice */
  yaw?: number
}
export type Recipe = Array<Keyframe>
export type Shot = Required<Pick<Keyframe, 'fov' | 'pitch' | 'position' | 'roll' | 'yaw'>>
const properties = ['position', 'yaw', 'pitch', 'roll', 'fov'] as const
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isVec3 = (value: unknown): value is Vec3 => Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isTween = (value: unknown): value is Tween => typeof value === 'string' && Object.hasOwn(tweens, value)
/** Validates a parsed recipe JSON document. */
export const parseRecipe = (input: unknown): Recipe => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('A recipe is a non-empty JSON array of keyframes.')
  }
  const known = new Set(['time', 'tools', 'tween', 'wireframe', 'orbit', ...properties])
  return input.map((keyframe: unknown, index) => {
    const at = `Keyframe ${index}`
    if (!isRecord(keyframe)) {
      throw new Error(`${at} is not an object.`)
    }
    for (const key of Object.keys(keyframe)) {
      if (!known.has(key)) {
        throw new Error(`${at} has the unknown property “${key}”. Known: ${[...known].join(', ')}.`)
      }
    }
    const {time, tween, position, yaw, pitch, roll, fov, orbit} = keyframe
    if (!isFiniteNumber(time) || time < 0) {
      throw new Error(`${at} needs a time in seconds of at least 0.`)
    }
    const previous = index > 0 ? (input[index - 1] as Keyframe).time : -1
    if (time <= previous) {
      throw new Error(`${at} must come after keyframe ${index - 1} (${time} ≤ ${previous} seconds).`)
    }
    if (tween !== undefined && !isTween(tween)) {
      throw new Error(`${at} has the unknown tween ${JSON.stringify(tween)}. Known: ${Object.keys(tweens).join(', ')}.`)
    }
    if (position !== undefined && !isVec3(position)) {
      throw new Error(`${at} needs position as [x, y, z] in meters.`)
    }
    if (orbit !== undefined) {
      if (!isRecord(orbit) || !isVec3(orbit.from) || !isVec3(orbit.to) || !isVec3(orbit.focus)) {
        throw new Error(`${at} needs orbit.from, orbit.to and orbit.focus as [x, y, z] in meters.`)
      }
      for (const key of Object.keys(orbit)) {
        if (!['focus', 'from', 'heightTween', 'to', 'turns'].includes(key)) {
          throw new Error(`${at} has the unknown orbit property “${key}”.`)
        }
      }
      if (orbit.heightTween !== undefined && !isTween(orbit.heightTween)) {
        throw new Error(`${at} has the unknown orbit.heightTween ${JSON.stringify(orbit.heightTween)}. Known: ${Object.keys(tweens).join(', ')}.`)
      }
      if (orbit.turns !== undefined && !Number.isSafeInteger(orbit.turns)) {
        throw new Error(`${at} needs orbit.turns as a whole number of extra revolutions.`)
      }
      if (time === 0 || position !== undefined || yaw !== undefined || pitch !== undefined) {
        throw new Error(`${at}: an orbit ends after time 0 and supplies its own position, yaw and pitch.`)
      }
      const [x, , z] = orbit.focus
      if ([orbit.from, orbit.to].some(eye => eye[0] === x && eye[2] === z)) {
        throw new Error(`${at}: each orbit endpoint needs a nonzero horizontal distance from its focus.`)
      }
    }
    for (const [name, value] of Object.entries({
      yaw,
      pitch,
      roll,
      fov,
    })) {
      if (value !== undefined && !isFiniteNumber(value)) {
        throw new Error(`${at} needs ${name} as a number of degrees.`)
      }
    }
    // the set_wireframe tool validates the fields themselves
    if (keyframe.wireframe !== undefined && !isRecord(keyframe.wireframe)) {
      throw new Error(`${at} needs wireframe as an object of set_wireframe input.`)
    }
    // the tools validate their input themselves
    if (keyframe.tools !== undefined && !(isRecord(keyframe.tools) && Object.values(keyframe.tools).every(isRecord))) {
      throw new Error(`${at} needs tools as an object of WebMCP tool names, each with an object of its input.`)
    }
    if (fov !== undefined && ((fov as number) <= 0 || (fov as number) >= 180)) {
      throw new Error(`${at} needs fov between 0 and 180 degrees.`)
    }
    return keyframe as Keyframe
  })
}
export const recipeDuration = (recipe: Recipe) => recipe.at(-1)!.time

type OrbitPose = Pick<Shot, 'pitch' | 'position' | 'yaw'>
const isOrbitProperty = (property: keyof Shot): property is keyof OrbitPose => property !== 'roll' && property !== 'fov'
/** Interpolate in cylindrical coordinates around the focus. This keeps a level orbit level and a constant-radius orbit circular. */
const sampleOrbit = ({from, to, focus, turns = 0}: CameraOrbit, t: number, heightT = t): OrbitPose => {
  const [x, y, z] = focus
  const start = Math.atan2(from[0] - x, from[2] - z)
  const difference = Math.atan2(to[0] - x, to[2] - z) - start
  // Preserve the sign of a half-turn; deltaAngle would send both ties toward increasing yaw.
  const angle = start + t * (Math.atan2(Math.sin(difference), Math.cos(difference)) + turns * 2 * Math.PI)
  const radius = lerp(Math.hypot(from[0] - x, from[2] - z), Math.hypot(to[0] - x, to[2] - z), t)
  const endpoint = t === 0 ? from : (t === 1 ? to : undefined)
  const position: Vec3 = [
    endpoint?.[0] ?? x + radius * Math.sin(angle),
    heightT === 1 ? to[1] : lerp(from[1], to[1], heightT),
    endpoint?.[2] ?? z + radius * Math.cos(angle),
  ]
  return {
    position,
    yaw: radiansToDegrees(angle) + (radius < 0 ? 180 : 0),
    pitch: radiansToDegrees(Math.atan2(y - position[1], Math.abs(radius))),
  }
}
/** The explicit ends of an orbit also serve as ordinary pose keys on either side of it. Tools and lens keys do not shorten the arc. */
const poseKeys = (recipe: Recipe) => {
  if (!recipe.some(key => key.orbit)) {
    return recipe
  }
  const keys: Array<Keyframe> = []
  for (const key of recipe) {
    if (key.orbit) {
      keys.push({
        time: keys.at(-1)?.time ?? 0,
        ...sampleOrbit(key.orbit, 0),
      }, {
        ...key,
        ...sampleOrbit(key.orbit, 1),
      })
    } else if (key.position || key.yaw !== undefined || key.pitch !== undefined) {
      keys.push(key)
    }
  }
  return keys
}
/**
 * The camera at a point in time. Every property is animated on its own track: keyframes that leave it out do not affect it.
 * Before its first keyframe and after its last one, a property holds still. Properties no keyframe sets keep their fallback.
 */
export const sampleRecipe = (recipe: Recipe, time: number, fallback: Shot): Shot => {
  const poses = poseKeys(recipe)
  let orbitPose: OrbitPose | undefined
  const sample = <T extends keyof Shot>(property: T): Shot[T] => {
    const isPose = isOrbitProperty(property)
    const track = (isPose ? poses : recipe).filter(keyframe => keyframe[property] !== undefined)
    if (track.length === 0) {
      return fallback[property]
    }
    const nextIndex = track.findIndex(keyframe => keyframe.time > time)
    if (nextIndex === 0) {
      return track[0][property] as Shot[T]
    }
    if (nextIndex === -1) {
      return track.at(-1)![property] as Shot[T]
    }
    const from = track[nextIndex - 1]
    const to = track[nextIndex]
    const progress = (time - from.time) / (to.time - from.time)
    const t = tweens[to.tween ?? 'linear'](progress)
    if (to.orbit && isPose) {
      orbitPose ??= sampleOrbit(to.orbit, t, to.orbit.heightTween ? tweens[to.orbit.heightTween](progress) : t)
      return orbitPose[property] as Shot[T]
    }
    const start = from[property]!
    const end = to[property]!
    if (Array.isArray(start)) {
      return start.map((value, axis) => lerp(value, (end as Vec3)[axis], t)) as Shot[T]
    }
    return lerp(start, end as number, t) as Shot[T]
  }
  return {
    position: sample('position'),
    yaw: sample('yaw'),
    pitch: sample('pitch'),
    roll: sample('roll'),
    fov: sample('fov'),
  }
}

/** a WebMCP tool a keyframe runs */
export type ToolCall = {
  input: Record<string, unknown>
  name: string
  /** seconds since the start of the video */
  time: number
}
/** Every tool call of the recipe’s keyframes, in the order they run. */
export const recipeToolCalls = (recipe: Recipe): Array<ToolCall> => recipe.flatMap(({time, tools = {}}) => Object.entries(tools).map(([name, input]) => ({
  input,
  name,
  time,
})))

/** The set_wireframe input in effect at a point in time, or undefined before the first keyframe that sets one. Radius and position travel like camera properties, each on its own track, but never into a keyframe that starts a flood with a direction; every other field holds its latest value. */
export const sampleWireframe = (recipe: Recipe, time: number): Record<string, unknown> | undefined => {
  const keyframes = recipe.filter(keyframe => keyframe.wireframe && keyframe.time <= time)
  if (keyframes.length === 0) {
    return
  }
  const input: Record<string, unknown> = {}
  for (const keyframe of keyframes) {
    Object.assign(input, keyframe.wireframe)
  }
  for (const field of ['radius', 'position'] as const) {
    const track = recipe.filter(keyframe => keyframe.wireframe?.[field] !== undefined)
    const nextIndex = track.findIndex(keyframe => keyframe.time > time)
    if (nextIndex < 1 || track[nextIndex].wireframe!.direction !== undefined) {
      continue
    }
    const from = track[nextIndex - 1]
    const to = track[nextIndex]
    const t = tweens[to.tween ?? 'linear']((time - from.time) / (to.time - from.time))
    const start = from.wireframe![field] as Vec3 | number
    const end = to.wireframe![field] as Vec3 | number
    input[field] = Array.isArray(start) ? start.map((value, axis) => lerp(value, (end as Vec3)[axis], t)) : lerp(start, end as number, t)
  }
  return input
}
