import type {Vec3} from '../types.ts'

const {PI, cos, sqrt} = Math
const back = 1.70158
const easeIn = {
  sine: (t: number) => 1 - cos(t * PI / 2),
  quad: (t: number) => t ** 2,
  cubic: (t: number) => t ** 3,
  quart: (t: number) => t ** 4,
  quint: (t: number) => t ** 5,
  expo: (t: number) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  circ: (t: number) => 1 - sqrt(1 - t ** 2),
  back: (t: number) => (back + 1) * t ** 3 - back * t ** 2,
}
export type Tween = 'hold' | 'linear' | `easeIn${Capitalized}` | `easeInOut${Capitalized}` | `easeOut${Capitalized}`
type Curve = keyof typeof easeIn
type Capitalized = Capitalize<Curve>
const capitalize = <T extends string>(value: T) => value[0].toUpperCase() + value.slice(1) as Capitalize<T>
/** progress curves from 0 to 1, see https://easings.net */
export const tweens = Object.fromEntries([
  ['linear', (t: number) => t],
  // keeps the previous value until the keyframe is reached, then jumps
  ['hold', (t: number) => (t < 1 ? 0 : 1)],
  ...Object.entries(easeIn).flatMap(([curve, ease]) => [
    [`easeIn${capitalize(curve)}`, ease],
    [`easeOut${capitalize(curve)}`, (t: number) => 1 - ease(1 - t)],
    [`easeInOut${capitalize(curve)}`, (t: number) => (t < 0.5 ? ease(2 * t) / 2 : 1 - ease(2 - 2 * t) / 2)],
  ]),
]) as Record<Tween, (t: number) => number>
export type Keyframe = {
  /** vertical field of view in degrees */
  fov?: number
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
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
/** Validates a parsed recipe JSON document. */
export const parseRecipe = (input: unknown): Recipe => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('A recipe is a non-empty JSON array of keyframes.')
  }
  const known = new Set(['time', 'tools', 'tween', 'wireframe', ...properties])
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
    const {time, tween, position, yaw, pitch, roll, fov} = keyframe
    if (!isFiniteNumber(time) || time < 0) {
      throw new Error(`${at} needs a time in seconds of at least 0.`)
    }
    const previous = index > 0 ? (input[index - 1] as Keyframe).time : -1
    if (time <= previous) {
      throw new Error(`${at} must come after keyframe ${index - 1} (${time} ≤ ${previous} seconds).`)
    }
    if (tween !== undefined && !Object.hasOwn(tweens, tween as string)) {
      throw new Error(`${at} has the unknown tween ${JSON.stringify(tween)}. Known: ${Object.keys(tweens).join(', ')}.`)
    }
    if (position !== undefined && !(Array.isArray(position) && position.length === 3 && position.every(isFiniteNumber))) {
      throw new Error(`${at} needs position as [x, y, z] in meters.`)
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
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
/**
 * The camera at a point in time. Every property is animated on its own track: keyframes that leave it out do not affect it.
 * Before its first keyframe and after its last one, a property holds still. Properties no keyframe sets keep their fallback.
 */
export const sampleRecipe = (recipe: Recipe, time: number, fallback: Shot): Shot => {
  const sample = <T extends keyof Shot>(property: T): Shot[T] => {
    const track = recipe.filter(keyframe => keyframe[property] !== undefined)
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
    const t = tweens[to.tween ?? 'linear']((time - from.time) / (to.time - from.time))
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
