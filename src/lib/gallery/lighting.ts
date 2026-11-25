import type {SkyPalette} from '../materials/ProceduralSky.ts'
import type {Vec3} from './types.ts'

import {RADIANS_TO_DEGREES as degrees} from 'math'
import hsl from 'okhsl'
import optis from 'optis'
import readPermalink from 'read-permalink'
import {create} from 'zustand'

import {daytimeSky} from '../materials/ProceduralSky.ts'
import {middaySun, sunDirectionFromAngles} from './sun.ts'

export type LightingPreset = {
  ambient: Light
  /** the reflection environment: a vertical gradient from top to bottom, with bright light boxes in its upper band */
  environment: {
    gradient: readonly [string, string, string, string]
    intensity: number
    lightBoxes: string
  }
  /** the renderer’s tone mapping exposure */
  exposure: number
  hemisphere: Light & {ground: number}
  /** multiplies every point and spot light, the rooms’ own lamps */
  lamps: number
  sky: SkyPalette
  /** the directional light: the sun, or the moon at night */
  sun: Light & {direction: Vec3}
  /** shown when switching to it */
  title: string
}

type Light = {
  color: number
  intensity: number
}

const presets = {
  noon: {
    title: 'Noon',
    // Hardly any flat fill: the rooms are lit by their own lamps, so surfaces fall off into shade between them.
    ambient: {
      color: hsl.integer(0, 0, 100),
      intensity: 0,
    },
    hemisphere: {
      color: hsl.integer(261, 100, 95.6),
      ground: hsl.integer(86, 30, 61),
      intensity: 1,
    },
    sun: {
      color: hsl.integer(81, 100, 95.4),
      intensity: 2,
      direction: middaySun,
    },
    environment: {
      gradient: ['#e6eeed', '#b6bcac', '#7d816c', '#4b4c3d'],
      intensity: 0.2,
      lightBoxes: '#fff9e6',
    },
    sky: daytimeSky,
    exposure: 1,
    lamps: 1,
  },
  golden_hour: {
    title: 'Golden hour',
    ambient: {
      color: hsl.integer(68, 100, 92.3),
      intensity: 0.12,
    },
    hemisphere: {
      color: hsl.integer(68, 99, 89),
      ground: hsl.integer(59, 31, 38),
      intensity: 0.5,
    },
    sun: {
      color: hsl.integer(63, 100, 79.6),
      intensity: 2.8,
      direction: [-8, 2.8, 3],
    },
    environment: {
      gradient: ['#ffd6a8', '#d29a6c', '#7a5a44', '#3e2f25'],
      intensity: 0.3,
      lightBoxes: '#ffe2b8',
    },
    sky: {
      brightness: 0.85,
      cloudCover: 0.35,
      cloudLit: hsl.integer(69, 100, 87.2),
      cloudShade: hsl.integer(342, 18, 51),
      cloudWarm: hsl.integer(59, 100, 79),
      glow: hsl.integer(59, 100, 79),
      horizon: hsl.integer(66, 100, 84),
      sun: hsl.integer(77, 100, 86.5),
      sunRadiance: 30,
      zenith: hsl.integer(259, 52, 47),
    },
    exposure: 1,
    lamps: 1.4,
  },
  dusk: {
    title: 'Dusk',
    ambient: {
      color: hsl.integer(279, 100, 79.5),
      intensity: 0.25,
    },
    hemisphere: {
      color: hsl.integer(272, 51, 55),
      ground: hsl.integer(313, 23, 23),
      intensity: 0.6,
    },
    sun: {
      color: hsl.integer(41, 99, 71),
      intensity: 0.5,
      direction: [-8, 0.9, 3],
    },
    environment: {
      gradient: ['#5a6aa0', '#3c4470', '#262838', '#141418'],
      intensity: 0.35,
      lightBoxes: '#ffd9b0',
    },
    sky: {
      brightness: 0.7,
      cloudCover: 0.3,
      cloudLit: hsl.integer(3, 46, 60),
      cloudShade: hsl.integer(291, 38, 25),
      cloudWarm: hsl.integer(41, 99, 71),
      glow: hsl.integer(40, 99, 68),
      horizon: hsl.integer(44, 80, 69),
      sun: hsl.integer(49, 100, 74.3),
      sunRadiance: 12,
      zenith: hsl.integer(270, 67, 20),
    },
    exposure: 1.1,
    lamps: 1.3,
  },
  night: {
    title: 'Night',
    ambient: {
      color: hsl.integer(267, 49, 67),
      intensity: 0.08,
    },
    hemisphere: {
      color: hsl.integer(267, 52, 26),
      ground: hsl.integer(67, 11, 9),
      intensity: 0.25,
    },
    sun: {
      color: hsl.integer(265, 100, 79),
      intensity: 0.35,
      direction: [5, 7, -4],
    },
    environment: {
      gradient: ['#1a2238', '#10141f', '#0a0b10', '#050506'],
      intensity: 0.25,
      lightBoxes: '#ffe2b0',
    },
    sky: {
      brightness: 1,
      cloudCover: 0.25,
      cloudLit: hsl.integer(267, 31, 30),
      cloudShade: hsl.integer(270, 24, 9),
      cloudWarm: hsl.integer(0, 0, 0),
      glow: hsl.integer(266, 49, 56),
      horizon: hsl.integer(268, 48, 16),
      sun: hsl.integer(269, 100, 92),
      sunRadiance: 6,
      zenith: hsl.integer(267, 56, 6),
    },
    exposure: 1.15,
    lamps: 1.5,
  },
} as const satisfies Record<string, LightingPreset>

export type LightingPresetId = keyof typeof presets

export const lightingPresetIds = Object.keys(presets) as Array<LightingPresetId>

/** which lamps glow: all of them, only the essential ones, leaving out the lights marked `optional`, or none */
export type LampSet = 'all' | 'essential' | 'none'

/** a preset as the world tuning may have changed it */
export type GalleryLightingPreset = LightingPreset & {
  /** all lamps unless the world tuning says otherwise */
  lampSet?: LampSet
  /** full lamp shadows unless the world tuning says otherwise */
  lampShadows?: number
}

/** Every preset; the world casts the shadows of its sun, from where its direction says. */
export const lightingPresets = presets

const weatherSchema = optis({
  defaults: {
    weather: 'noon',
  },
  normalizations: {
    weather(value: unknown) {
      return lightingPresetIds.find(id => id === value) ?? 'noon'
    },
  },
})

/** The lighting values the world tuning of `?development` changes. The sun’s azimuth runs clockwise from north (−z) and its elevation up from the horizon, both in degrees. */
export type LightingTuning = {
  environmentIntensity: number
  /** whether the ambient fill, the hemisphere’s base light and the environment light the scene at all */
  fill: boolean
  hemisphereIntensity: number
  lamps: number
  lampSet: LampSet
  /** how dark the lamps’ shadows fall, where 0 hides them */
  lampShadows: number
  /** whether the sun shines at all */
  sun: boolean
  sunAzimuth: number
  sunElevation: number
  sunIntensity: number
}

/** A preset’s own values for the world tuning. */
export function getLightingTuning(preset: LightingPreset): LightingTuning {
  const [x, y, z] = preset.sun.direction
  return {
    environmentIntensity: preset.environment.intensity,
    fill: true,
    hemisphereIntensity: preset.hemisphere.intensity,
    lamps: preset.lamps,
    lampSet: 'all',
    lampShadows: 1,
    sun: true,
    sunAzimuth: (Math.atan2(x, -z) * degrees + 360) % 360,
    sunElevation: Math.atan2(y, Math.hypot(x, z)) * degrees,
    sunIntensity: preset.sun.intensity,
  }
}

/** Applies the world tuning’s lighting to a preset. Every value still at `start`, the one the page started with, keeps following the preset, so cycling presets with L still changes it. */
export function tuneLighting(preset: GalleryLightingPreset, tuning: LightingTuning, start: LightingTuning): GalleryLightingPreset {
  const own = getLightingTuning(preset)
  const pick = (key: 'environmentIntensity' | 'hemisphereIntensity' | 'lamps' | 'sunAzimuth' | 'sunElevation' | 'sunIntensity') => (tuning[key] === start[key] ? own[key] : tuning[key])
  const isMoved = pick('sunAzimuth') !== own.sunAzimuth || pick('sunElevation') !== own.sunElevation
  const fill = tuning.fill ? 1 : 0
  return {
    ...preset,
    ambient: {
      ...preset.ambient,
      intensity: preset.ambient.intensity * fill,
    },
    environment: {
      ...preset.environment,
      intensity: pick('environmentIntensity') * fill,
    },
    hemisphere: {
      ...preset.hemisphere,
      intensity: pick('hemisphereIntensity') * fill,
    },
    lamps: pick('lamps'),
    lampSet: tuning.lampSet,
    lampShadows: tuning.lampShadows,
    sun: {
      ...preset.sun,
      ...isMoved ? {direction: sunDirectionFromAngles(pick('sunAzimuth'), pick('sunElevation'))} : {},
      intensity: tuning.sun ? pick('sunIntensity') : 0,
    },
  }
}

/** Read the `?weather`, the lighting preset the gallery starts with. */
export function readWeather(input: URL | string = typeof location === 'undefined' ? '' : location.href): LightingPresetId {
  return readPermalink(input, {schema: weatherSchema}).weather
}

/** The gallery’s current lighting preset, starting from `?weather`; with `?development`, L cycles it for the rest of the page session. */
export const useLighting = create<{preset: LightingPresetId}>(() => ({preset: readWeather()}))

/** Switches to the next (or with a negative `step`, previous) preset and returns it. */
export function cycleLighting(step = 1) {
  const index = lightingPresetIds.indexOf(useLighting.getState().preset)
  const preset = lightingPresetIds[(index + step + lightingPresetIds.length) % lightingPresetIds.length]
  useLighting.setState({preset})
  return lightingPresets[preset]
}
