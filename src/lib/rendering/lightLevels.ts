import type {Light, LightShadow, Object3D} from 'three/webgpu'

import optis from 'optis'
import readPermalink from 'read-permalink'
import {Color, Vector3} from 'three/webgpu'
import {create} from 'zustand'

import isFlagOn from '#src/lib/permalinkFlag.ts'

import {lampOf} from './lamps.ts'

type Level = {
  /** the intensity the light’s owner gave it */
  base: number
  /** what {@link applyLightLevels} last turned it into */
  written: number
}

const flagsSchema = optis({
  defaults: {
    edit_lamps: false,
    show_lamps: false,
  },
  normalizations: {
    edit_lamps(value: unknown) {
      return isFlagOn(value)
    },
    show_lamps(value: unknown) {
      return isFlagOn(value)
    },
  },
})

/** Read the `?show_lamps` flag that marks every light in the scene; a bare `?show_lamps` counts as enabled. */
export function readShowLamps(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: flagsSchema}).show_lamps
}

/** Read the `?edit_lamps` flag that lets E switch the aimed light off and on, the arrows change its strength and range and Numpad 7 and 1 its decay; a bare `?edit_lamps` counts as enabled. */
export function readEditLamps(input: URL | string = typeof location === 'undefined' ? '' : location.href): boolean {
  return readPermalink(input, {schema: flagsSchema}).edit_lamps
}

/** whether this page was opened with `?edit_lamps`, read once at startup */
export const isEditingLamps = readEditLamps()

/** whether this page shows light markers, read once at startup; editing shows them too */
export const isShowingLamps = isEditingLamps || readShowLamps()

/** how much one step changes a light’s range, in meters */
const rangeStep = 1
/** Adds `steps` steps of `size` to `value`, landing on whole steps and no lower than `min`. */
const stepBy = (value: number, steps: number, size: number, min: number) => Math.max(min, Number(((Math.round(value / size) + steps) * size).toFixed(6)))
/** the range a light without a cutoff starts from when its range is first changed, in meters */
const openRange = 20
/** each light’s intensity as its owner set it, and as {@link applyLightLevels} last wrote it */
const levels = new WeakMap<Light, Level>

/** `userData` key that marks the shadow pool’s own lights, which nothing but the pool sets */
export const shadowSlotKey = 'shadowSlot'
/** whether a light is one of the shadow pool’s */
export const isShadowSlot = (light: Object3D) => Boolean(light.userData[shadowSlotKey])

/** A readable name for a light or other object in notices and logs: its own name, or its type and the nearest named ancestor. */
export function describeObject(object: Object3D) {
  if (object.name) {
    return object.name
  }
  let parent = object.parent
  while (parent && !parent.name) {
    parent = parent.parent
  }
  return parent ? `${object.type} in ${parent.name}` : object.type
}

const listTally = (tally: ReadonlyMap<string, number>) => [...tally].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).toSorted().join(', ')
const sumTally = (tally: ReadonlyMap<string, number>) => tally.values().reduce((sum, count) => sum + count, 0)
/**
 * The lamps a move switches on and off by the fences the world lights them in, from the fences the player was in, `from`, to those the player is in now, `to`, like a player’s whereabouts before and after a change of rooms, each as {@link describeObject} names it, with a count where several share a name.
 */
export function lampSwitches(scene: Object3D, from: ReadonlyArray<string>, to: ReadonlyArray<string>) {
  const enabled = new Map<string, number>
  const disabled = new Map<string, number>
  scene.traverse(object => {
    const fences = (object as Light).isLight ? lampOf(object as Light)?.fences : undefined
    if (!fences) {
      return
    }
    const after = fences.some(fence => to.includes(fence))
    if (fences.some(fence => from.includes(fence)) === after) {
      return
    }
    const tally = after ? enabled : disabled
    const name = describeObject(object)
    tally.set(name, (tally.get(name) ?? 0) + 1)
  })
  return {
    enabled: listTally(enabled),
    enabledCount: sumTally(enabled),
    disabled: listTally(disabled),
    disabledCount: sumTally(disabled),
  }
}

/** The light the camera aims at while editing lights, the ones selected by clicking their markers, the lights moved, the lights whose range or decay changed, whose shadow was switched on or off, and the lights switched off or made stronger or weaker for this page session. */
export const useLightEdits = create<{
  aimed: Light | null
  moved: ReadonlySet<Light>
  off: ReadonlySet<Light>
  reshaped: ReadonlySet<Light>
  selected: ReadonlySet<Light>
  shadows: ReadonlyMap<Light, boolean>
  strengths: ReadonlyMap<Light, number>
}>(() => ({
  aimed: null,
  moved: new Set,
  off: new Set,
  reshaped: new Set,
  selected: new Set,
  shadows: new Map,
  strengths: new Map,
}))

const markReshaped = (light: Light) => {
  const {reshaped} = useLightEdits.getState()
  if (!reshaped.has(light)) {
    const next = new Set(reshaped)
    next.add(light)
    useLightEdits.setState({reshaped: next})
  }
}

/**
 * Makes a light stronger (positive `steps`) or weaker by whole units of intensity, the unit its owner sets it in, returning its new intensity before any lamp gain.
 * A light its owner left dark has nothing to scale, so it returns undefined.
 */
export function changeLightIntensity(light: Light, steps: number) {
  const base = levels.get(light)?.base ?? light.intensity
  if (base <= 0) {
    return
  }
  const strengths = new Map(useLightEdits.getState().strengths)
  const intensity = Math.max(0, Math.round(base * (strengths.get(light) ?? 1)) + steps)
  strengths.set(light, intensity / base)
  useLightEdits.setState({strengths})
  return intensity
}

/** the ranges lights had before they were first changed */
const ranges = new WeakMap<Light, number>

/** Lets a point or spot light reach farther (positive `steps`) or less far, returning its new range in meters. */
export function changeLightRange(light: Light & {distance?: number}, steps: number) {
  if (light.distance === undefined) {
    return
  }
  if (!ranges.has(light)) {
    ranges.set(light, light.distance)
  }
  light.distance = stepBy(light.distance || openRange, steps, rangeStep, rangeStep)
  markReshaped(light)
  return light.distance
}

/** how much one step changes a light’s decay */
const decayStep = 0.25
/** the decays lights had before they were first changed */
const decays = new WeakMap<Light, number>

/** Makes a point or spot light fade faster with distance (positive `steps`) or more gently, returning its new decay. */
export function changeLightDecay(light: Light & {decay?: number}, steps: number) {
  if (light.decay === undefined) {
    return
  }
  if (!decays.has(light)) {
    decays.set(light, light.decay)
  }
  light.decay = Math.max(0, Math.round((light.decay + steps * decayStep) / decayStep) * decayStep)
  markReshaped(light)
  return light.decay
}

const moving = new Vector3
/** where moved lights were placed by their owners, in their parents’ space */
const origins = new WeakMap<Light, Vector3>
/** Puts a light at a world position, returning that position. */
export function placeLight(light: Light, world: Vector3) {
  if (!origins.has(light)) {
    origins.set(light, light.position.clone())
  }
  moving.copy(world)
  light.position.copy(light.parent ? light.parent.worldToLocal(moving) : moving)
  light.updateMatrixWorld()
  const moved = new Set(useLightEdits.getState().moved)
  if (!moved.has(light)) {
    moved.add(light)
    useLightEdits.setState({moved})
  }
  return world.clone()
}

/** Moves a light by a world-space offset, returning its new world position. */
export function moveLight(light: Light, offset: Vector3) {
  return placeLight(light, light.getWorldPosition(new Vector3).add(offset))
}

/** Undoes every edit to a light: puts it back where its owner placed it, with its range, decay, strength, shadow and on, returning its world position. */
export function resetLight(light: Light & {
  decay?: number
  distance?: number
}) {
  const origin = origins.get(light)
  if (origin) {
    light.position.copy(origin)
    light.updateMatrixWorld()
    origins.delete(light)
  }
  const range = ranges.get(light)
  if (range !== undefined) {
    light.distance = range
    ranges.delete(light)
  }
  const decay = decays.get(light)
  if (decay !== undefined) {
    light.decay = decay
    decays.delete(light)
  }
  const {moved, off, reshaped, shadows, strengths} = useLightEdits.getState()
  const without = <Value>(set: ReadonlySet<Value>) => new Set([...set].filter(entry => entry !== light))
  useLightEdits.setState({
    moved: without(moved),
    off: without(off),
    reshaped: without(reshaped),
    shadows: new Map([...shadows].filter(([entry]) => entry !== light)),
    strengths: new Map([...strengths].filter(([entry]) => entry !== light)),
  })
  return light.getWorldPosition(new Vector3)
}

/** Switches a light on or off. */
export function setLightOn(light: Light, on: boolean) {
  const off = new Set(useLightEdits.getState().off)
  if (on) {
    off.delete(light)
  } else {
    off.add(light)
  }
  useLightEdits.setState({off})
}

/**
 * Multiplies the intensity of every light, on top of what its owner sets, such as a lighting preset’s lamp gain. Levels replace
 * it while mounted. Strengths changed with {@link changeLightIntensity} apply on top, and a light switched off with {@link setLightOn} gets 0 regardless.
 */
export const lightGain = {current: (_light: Light) => 1}

/**
 * Whether each light’s surroundings let it shine, such as the fences the player is in; a light this rules out gets 0 like one switched off. Levels replace it while mounted.
 */
export const lightActive = {current: (_light: Light) => true}

/**
 * How dark each light’s shadow falls, where 0 hides it. Applies only to lights whose owner made them cast shadows. Levels replace it while mounted.
 */
export const lightShadow = {current: (_light: Light) => 1}

/** the color that leaves every light as its owner made it */
export const noTint = new Color(1, 1, 1)

/**
 * What each light’s color is multiplied by, on top of what its owner sets, such as the mood of a held orb; a hemisphere light’s ground color too. Moods replace it while mounted.
 */
export const lightTint = {current: (_light: Light): Color => noTint}

/** each light color as its owner set it, and as {@link applyLightLevels} last wrote it, by the color object itself, so a hemisphere light keeps its sky and ground apart */
const colors = new WeakMap<Color, {
  base: Color
  written: Color
}>
/** Multiplies a light color by `tint`. A color that differs from what this wrote last frame is a new one from the light’s owner. */
function tintColor(color: Color, tint: Color) {
  let entry = colors.get(color)
  if (!entry || !color.equals(entry.written)) {
    if (!entry && tint.equals(noTint)) {
      return
    }
    entry = {
      base: color.clone(),
      written: new Color,
    }
    colors.set(color, entry)
  }
  color.copy(entry.base).multiply(tint)
  entry.written.copy(color)
}
/** whether each light’s owner made it cast shadows, and whether this made it last frame */
const casters = new WeakMap<Light, {
  base: boolean
  written: boolean
}>

/** Whether a light casts a shadow its owner gave it or one switched on, or undefined for a light that can’t. */
export function lightShadowOn(light: Light & {isPointLight?: boolean}) {
  const own = casters.get(light)?.base ?? light.castShadow
  if (!own && !light.isPointLight) {
    return
  }
  return useLightEdits.getState().shadows.get(light) ?? (own || Boolean(light.userData.shadow))
}

/**
 * Switches a light’s shadow on or off, returning whether it casts one now, or undefined for a light that can’t.
 * A light whose owner made it cast shadows stops or starts again, which rebuilds every lit material; a shadowless point light asks the shadow pool for a slot or stops asking.
 */
export function setLightShadow(light: Light & {isPointLight?: boolean}, on: boolean) {
  const own = casters.get(light)?.base ?? light.castShadow
  if (!own && !light.isPointLight) {
    return
  }
  const shadows = new Map(useLightEdits.getState().shadows)
  if (on === (own || Boolean(light.userData.shadow))) {
    shadows.delete(light)
  } else {
    shadows.set(light, on)
  }
  useLightEdits.setState({shadows})
  return on
}

/** Switches a light’s shadow off or back on like {@link setLightShadow}, returning whether it casts one now, or undefined for a light that can’t. */
export function toggleLightShadow(light: Light & {isPointLight?: boolean}) {
  const on = lightShadowOn(light)
  return on === undefined ? undefined : setLightShadow(light, !on)
}

/**
 * Scales every light by {@link lightGain}, tints it by {@link lightTint}, switches off the ones toggled off and weakens or drops shadows by {@link lightShadow} and {@link toggleLightShadow}. Call it once per frame after everything else
 * set its lights, so lights that flicker or dim are scaled after their owner set them for this frame. An intensity that differs
 * from what this wrote last frame is a new one from the light’s owner.
 */
export function applyLightLevels(scene: Object3D) {
  const {off, shadows, strengths} = useLightEdits.getState()
  scene.traverse(object => {
    const light = object as Light
    // The shadow pool sets its lights from the ones it shades, after this.
    if (!light.isLight || isShadowSlot(light)) {
      return
    }
    let level = levels.get(light)
    if (light.intensity !== level?.written) {
      level = {
        base: light.intensity,
        written: Number.NaN,
      }
      levels.set(light, level)
    }
    light.intensity = off.has(light) || !lightActive.current(light) ? 0 : level.base * lightGain.current(light) * (strengths.get(light) ?? 1)
    level.written = light.intensity
    const tint = lightTint.current(light)
    tintColor(light.color, tint)
    const {groundColor} = light as Light & {groundColor?: Color}
    if (groundColor) {
      tintColor(groundColor, tint)
    }
    let caster = casters.get(light)
    if (light.castShadow !== caster?.written) {
      caster = {
        base: light.castShadow,
        written: light.castShadow,
      }
      casters.set(light, caster)
    }
    const {shadow} = light as Light & {shadow?: LightShadow}
    if (caster.base && shadow) {
      // Strength 0 keeps the shadow map: casting again would rebuild every lit material, and materials still holding the disposed shadow node crash the renderer.
      light.castShadow = shadows.get(light) !== false
      shadow.intensity = lightShadow.current(light)
    }
    caster.written = light.castShadow
  })
}
