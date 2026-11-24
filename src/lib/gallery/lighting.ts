import type {SkyPalette} from '../materials/ProceduralSky.ts'
import type {Vec3} from './types.ts'

import {RADIANS_TO_DEGREES as degrees} from 'math'
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
  hemisphere: Light & {ground: string}
  /** multiplies every point and spot light, the rooms’ own lamps */
  lamps: number
  sky: SkyPalette
  /** the directional light: the sun, or the moon at night */
  sun: Light & {direction: Vec3}
  /** shown when switching to it */
  title: string
}

type Light = {
  color: string
  intensity: number
}

const presets = {
  noon: {
    title: 'Noon',
    // Hardly any flat fill: the rooms are lit by their own lamps, so surfaces fall off into shade between them.
    ambient: {
      color: '#ffffff',
      intensity: 0,
    },
    hemisphere: {
      color: '#ecf3ff',
      ground: '#a29270',
      intensity: 1,
    },
    sun: {
      color: '#fff0d7',
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
      color: '#ffe4c8',
      intensity: 0.12,
    },
    hemisphere: {
      color: '#ffd9b0',
      ground: '#6e5440',
      intensity: 0.5,
    },
    sun: {
      color: '#ffb36b',
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
      cloudLit: '#ffd2a0',
      cloudShade: '#8a7280',
      cloudWarm: '#ffb070',
      glow: '#ffb070',
      horizon: '#ffc58a',
      sun: '#ffd08a',
      sunRadiance: 30,
      zenith: '#4a6fa8',
    },
    exposure: 1,
    lamps: 1.4,
  },
  dusk: {
    title: 'Dusk',
    ambient: {
      color: '#b8c0ff',
      intensity: 0.25,
    },
    hemisphere: {
      color: '#6d7fc2',
      ground: '#3a3040',
      intensity: 0.6,
    },
    sun: {
      color: '#ff8a5c',
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
      cloudLit: '#c2768a',
      cloudShade: '#3a3456',
      cloudWarm: '#ff8a5c',
      glow: '#ff7a4a',
      horizon: '#f08a5d',
      sun: '#ff9a60',
      sunRadiance: 12,
      zenith: '#1d2a5c',
    },
    exposure: 1.1,
    lamps: 1.3,
  },
  night: {
    title: 'Night',
    ambient: {
      color: '#8da2d6',
      intensity: 0.08,
    },
    hemisphere: {
      color: '#2a3a66',
      ground: '#15120f',
      intensity: 0.25,
    },
    sun: {
      color: '#a8c4ff',
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
      cloudLit: '#3a4560',
      cloudShade: '#10131c',
      cloudWarm: '#000000',
      glow: '#6b85c0',
      horizon: '#1a2440',
      sun: '#dfe8ff',
      sunRadiance: 6,
      zenith: '#050a1a',
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
