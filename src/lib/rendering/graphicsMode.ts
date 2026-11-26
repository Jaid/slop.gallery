import type {RenderPipelineSetting, RenderPipelineSettings} from './renderPipelineSettings.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {readStored, writeStored} from '../browserStorage.ts'
import {isHeavyCapable, readHeavyCapabilityHints} from './autoGraphics.ts'

/** a graphics quality by its name, as `?graphics` and the stored preference take it */
export type GraphicsQuality = 'cinematic' | 'fast' | 'heavy'

/** every graphics quality there is, from the lightest to the heaviest */
export const graphicsQualities: ReadonlyArray<GraphicsQuality> = ['fast', 'heavy', 'cinematic']

/** a `?graphics` name: a graphics quality or `auto`, which picks fast or heavy for the GPU */
type GraphicsModeName = GraphicsQuality | 'auto'

/** The name of the graphics that are heavy or not, cinematic only while heavy. */
export function graphicsQualityName(isHeavy: boolean, isCinematic = false): GraphicsQuality {
  if (!isHeavy) {
    return 'fast'
  }
  return isCinematic ? 'cinematic' : 'heavy'
}

const graphicsModeNames: Array<GraphicsModeName> = [...graphicsQualities, 'auto']
const normalizeGraphicsMode = (value: unknown): GraphicsModeName => {
  if (value === true) {
    return 'heavy'
  }
  return graphicsModeNames.find(name => name === value) ?? 'fast'
}
const graphicsModeSchema = optis({
  defaults: {
    graphics: 'fast',
  },
  normalizations: {
    graphics: normalizeGraphicsMode,
  },
})

export type GraphicsProfile = {
  /** ambient occlusion pixels per output pixel along each axis */
  ambientOcclusionResolutionScale: number
  /** ambient occlusion samples per pixel */
  ambientOcclusionSamples: number
  ambientOcclusionThickness?: number
  /** optional bloom overrides */
  bloomTuning?: BloomTuning
  /** whether runtime canvas textures such as signs keep mipmaps, and with them anisotropic filtering, at the cost of building them */
  canvasTextureMipmaps: boolean
  /** backing pixels per logical texel for runtime canvas textures such as signs */
  canvasTextureResolution: number
  /** optional contact shadow overrides, which may switch them on */
  contactShadowTuning?: ContactShadowTuning
  /** factor on the segment counts of round meshes that opt in, along each curved direction */
  curveDetail: number
  /** whether screen-space indirect light bounces the lit scene off the surfaces’ diffuse color */
  indirectLight: boolean
  /** filter radius for shadow-casting lamps, in shadow-map texels, so a larger `shadowMapScale` needs a proportionally larger radius for the same penumbra; independent of the Sun */
  lampShadowRadius?: number
  /** whether screen-space reflections add to metallic surfaces like gilded frames and trims, on top of the planar reflections */
  metalReflections: boolean
  mirrorReflections: boolean
  noiseTextures: boolean
  postprocessing: boolean
  /** planar reflection pixels per output pixel along each axis */
  reflectionResolutionScale: number
  /** factor on every shadow map’s size along each axis */
  shadowMapScale: number
  shadows: boolean
  /** shadow map lookups per pixel and light */
  shadowSamples: number
  /** optional screen-space indirect-light quality overrides */
  ssgi?: SsgiSettings
  /** absolute sun shadow-map size, independent of the other lights’ shadow-map scale */
  sunShadowMapSize?: number
  /** sun shadow filter radius, in shadow-map texels */
  sunShadowRadius?: number
  /** sun-only PCF lookup count; defaults to the other lights’ shadow sample count */
  sunShadowSamples?: number
  /** anisotropic filtering of the repeating procedural surfaces like plaster, stone and wood */
  surfaceAnisotropy: number
  /** whether the sun scatters through the air as shafts of light */
  volumetricLight: boolean
  /** Number of raymarching samples for volumetric sunlight. */
  volumetricLightSteps: number
  /** how often the voxel indirect light bounces once the world tuning switches it on, once by default */
  voxelIndirectLightBounces?: number
}

type BloomTuning = Partial<Pick<RenderPipelineSettings, Exclude<Extract<RenderPipelineSetting, `bloom${string}`>, 'bloom'>>>

type ContactShadowTuning = Partial<Pick<RenderPipelineSettings, Extract<RenderPipelineSetting, `contactShadow${string}`>>>

type SsgiSettings = Pick<RenderPipelineSettings, | 'screenSpaceIndirectLightAmbientOcclusion'
  | 'screenSpaceIndirectLightBackfaceLighting'
  | 'screenSpaceIndirectLightExpFactor'
  | 'screenSpaceIndirectLightIntensity'
  | 'screenSpaceIndirectLightRadius'
  | 'screenSpaceIndirectLightResolutionScale'
  | 'screenSpaceIndirectLightSlices'
  | 'screenSpaceIndirectLightSteps'
  | 'screenSpaceIndirectLightTemporalFiltering'
  | 'screenSpaceIndirectLightThickness'>

/** Read the `?graphics` name of a permalink: fast, heavy, cinematic or auto. Anything else, and none, is fast. The stored preference is not its business; {@link readGraphicsMode} without input reads what this page went by. */
export function readGraphicsModeName(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: graphicsModeSchema}).graphics
}

/** Read the graphics a permalink asks for by name, its `graphics` given directly or packed into its `data`, or `undefined` where it asks for none, so the stored preference decides instead. */
export function readGraphicsModeOverride(input: URL | string = typeof location === 'undefined' ? '' : location.href): GraphicsModeName | undefined {
  const permalink: Record<string, unknown> = readPermalink(input)
  return 'graphics' in permalink ? normalizeGraphicsMode(permalink.graphics) : undefined
}

/** The graphics name in a stored preference, or `undefined` for nothing the menu could have stored. */
export function parseGraphicsModeName(value: unknown): GraphicsModeName | undefined {
  return graphicsModeNames.find(name => name === value)
}

/** The graphics name a page load goes by: a permalink’s `?graphics` wins over the stored preference, and fast graphics are the default. */
export function resolveGraphicsModeName(override?: GraphicsModeName, stored?: GraphicsModeName): GraphicsModeName {
  return override ?? stored ?? 'fast'
}

/** the graphics name this page load goes by, decided once before the renderer and the scene exist, and never changed while the page lives */
const requestedGraphicsModeName = resolveGraphicsModeName(readGraphicsModeOverride(), parseGraphicsModeName(readStored('graphics')))
// Only graphics that go by `auto` wait for the adapter, before anything reads the graphics mode.
const isAutoHeavy = requestedGraphicsModeName === 'auto' && isHeavyCapable(await readHeavyCapabilityHints())
const graphicsModeNameOf = (input?: URL | string): GraphicsModeName => (input === undefined ? requestedGraphicsModeName : readGraphicsModeName(input))

/** Read whether heavy graphics apply, which cinematic graphics are too: of the given permalink alone, or without one of this page, whose stored preference and `auto` pick for its GPU already count. */
export function readGraphicsMode(input?: URL | string) {
  const name = graphicsModeNameOf(input)
  if (name === 'auto') {
    return isAutoHeavy
  }
  return name !== 'fast'
}

/** Read whether cinematic graphics apply: heavy, but budgeted for non-realtime rendering. Without a permalink, reads this page’s. */
export function readCinematicGraphics(input?: URL | string) {
  return graphicsModeNameOf(input) === 'cinematic'
}

/** Read the profile the given permalink asks for, or without one this page’s, which is {@link graphicsProfile}. */
export function readGraphicsProfile(input?: URL | string) {
  return getGraphicsProfile(readGraphicsMode(input), readCinematicGraphics(input))
}

const fastProfile: GraphicsProfile = {
  canvasTextureMipmaps: false,
  canvasTextureResolution: 0.5,
  curveDetail: 1,
  noiseTextures: false,
  mirrorReflections: false,
  indirectLight: false,
  metalReflections: false,
  shadows: false,
  postprocessing: false,
  ambientOcclusionResolutionScale: 1,
  ambientOcclusionSamples: 16,
  reflectionResolutionScale: 1,
  shadowMapScale: 1,
  shadowSamples: 5,
  surfaceAnisotropy: 8,
  volumetricLight: false,
  volumetricLightSteps: 64,
}
const heavyProfile: GraphicsProfile = {
  canvasTextureMipmaps: false,
  canvasTextureResolution: 1,
  curveDetail: 1,
  noiseTextures: true,
  mirrorReflections: true,
  indirectLight: false,
  lampShadowRadius: 4,
  metalReflections: true,
  shadows: true,
  postprocessing: true,
  ambientOcclusionResolutionScale: 1,
  ambientOcclusionSamples: 16,
  reflectionResolutionScale: 1,
  shadowMapScale: 1,
  shadowSamples: 4,
  sunShadowRadius: 4,
  sunShadowSamples: 4,
  surfaceAnisotropy: 8,
  volumetricLight: true,
  volumetricLightSteps: 64,
}
// Cinematic raises intermediate and shadow-map resolutions, AO quality, texture filtering, curve tessellation and indirect light for non-realtime rendering.
const cinematicProfile: GraphicsProfile = {
  ...heavyProfile,
  // Tight, strong halos at full resolution with a hard threshold: the fountain’s water and the flames glow, while sunlit stone no longer hazes over.
  bloomTuning: {
    bloomGaussianKernelSize: 4,
    bloomMipCount: 4,
    bloomRadius: 0.1,
    bloomResolutionScale: 1,
    bloomSmoothWidth: 0,
    bloomStrength: 1,
  },
  canvasTextureMipmaps: true,
  canvasTextureResolution: 2,
  // Faint but far-reaching: marching 40 cm toward the sun at 20% picks out the geometry, like an armor against its wall or the paints in the Painting Set.
  contactShadowTuning: {
    contactShadowDenoiseRadius: 16,
    contactShadowDistance: 0.4,
    contactShadowIntensity: 0.2,
    contactShadowQuality: 2,
    contactShadows: true,
  },
  curveDetail: 2,
  indirectLight: true,
  ambientOcclusionResolutionScale: 2,
  ambientOcclusionSamples: 64,
  ambientOcclusionThickness: 2,
  reflectionResolutionScale: 2,
  shadowMapScale: 4,
  // Heavy’s four texels on four times the map, so the lamps’ penumbrae keep their width instead of turning four times sharper.
  lampShadowRadius: 16,
  shadowSamples: 16,
  sunShadowMapSize: 8192,
  sunShadowRadius: 8,
  sunShadowSamples: 16,
  ssgi: {
    screenSpaceIndirectLightAmbientOcclusion: 0.5,
    screenSpaceIndirectLightBackfaceLighting: 0.2,
    screenSpaceIndirectLightExpFactor: 2,
    screenSpaceIndirectLightIntensity: 5,
    screenSpaceIndirectLightRadius: 32,
    screenSpaceIndirectLightResolutionScale: 1,
    screenSpaceIndirectLightSlices: 4,
    screenSpaceIndirectLightSteps: 32,
    screenSpaceIndirectLightTemporalFiltering: true,
    screenSpaceIndirectLightThickness: 1,
  },
  surfaceAnisotropy: 16,
  volumetricLightSteps: 128,
  voxelIndirectLightBounces: 2,
}
/** WebGPU’s default texture size limit, which Three requests whatever the adapter supports */
const maxTextureSize = 8192
/** Cinematic requests room for optional 16K shadow-map experiments; the default sun map is 8K. */
export const cinematicMaxTextureSize = 16_384

/** Caps a canvas texture’s resolution so its backing store stays within the texture size limit, which a large atlas would exceed at the cinematic resolution. */
export function fitCanvasTextureResolution(resolution: number, width: number, height: number) {
  return Math.min(resolution, maxTextureSize / Math.max(width, height))
}

/** Select a stable gallery-specific budget without exposing enum keys to consumers. */
export function getGraphicsProfile(isHeavy: boolean, isCinematic = false) {
  if (!isHeavy) {
    return fastProfile
  }
  return isCinematic ? cinematicProfile : heavyProfile
}

/** Resolve the sun’s independent shadow-map dimensions, PCF width and sample budget. */
export function getSunShadowSettings(profile: GraphicsProfile, baseMapSize: number) {
  return {
    mapSize: profile.sunShadowMapSize ?? baseMapSize * profile.shadowMapScale,
    radius: profile.sunShadowRadius ?? profile.shadowMapScale,
    samples: profile.sunShadowSamples ?? profile.shadowSamples,
  }
}
/** whether this page renders with heavy graphics, decided as it loaded and fixed for its lifetime; the menu only picks what the next load renders with */
export const isHeavyGraphics = readGraphicsMode()
/** whether this page’s heavy graphics are cinematic, decided as it loaded and fixed for its lifetime */
export const isCinematicGraphics = readCinematicGraphics()
/** the graphics quality this page renders with, by name */
export const graphicsQuality: GraphicsQuality = graphicsQualityName(isHeavyGraphics, isCinematicGraphics)
/** the profile this page renders with; every material, geometry and pipeline is built for it once, and no other quality’s assets are ever built */
export const graphicsProfile = getGraphicsProfile(isHeavyGraphics, isCinematicGraphics)

/** how the menu’s Graphics button changes what renders next, which {@link planGraphicsPreferenceChange} decides and {@link applyGraphicsPreferenceChange} carries out; what this page renders with never changes */
export type GraphicsPreferenceChange = {
  /** the graphics quality this page renders with, which the change leaves alone */
  active: GraphicsQuality
  /** the graphics quality the next load goes by from now on */
  next: GraphicsQuality
  /** the graphics quality the next load went by before the change, which the menu showed */
  previous: GraphicsQuality
} & ({
  /** the URL the page goes to, which loads it again with the new graphics */
  url: string
  /** `url`: the page’s permalink carries its graphics, so it goes to the same URL with the new ones in their place, leaving the stored preference alone; `storage`: the new ones are stored for the next load and this page goes on as it renders */
  via: 'url'
} | {via: 'storage'})

/** The graphics quality the menu’s flip between fast and heavy leaves `quality` at: the page’s own kind of heavy, cinematic where this page renders with that, and fast from every heavy quality. */
export function toggledGraphicsQuality(quality: GraphicsQuality, active = graphicsQuality): GraphicsQuality {
  return quality === 'fast' ? graphicsQualityName(true, active === 'cinematic') : 'fast'
}

/** Read the graphics quality the next load of this page would render with, which seeds the menu’s Graphics button: the stored preference, resolved, or the quality this page renders with where a permalink overrode it or nothing is stored. */
export function readNextGraphicsQuality(): GraphicsQuality {
  if (readGraphicsModeOverride() !== undefined) {
    return graphicsQuality
  }
  const stored = parseGraphicsModeName(readStored('graphics'))
  if (stored === undefined) {
    return graphicsQuality
  }
  return stored === 'auto' ? graphicsQualityName(isAutoHeavy) : stored
}

/** How this page would flip the graphics quality of its next load between fast and heavy, without doing anything yet. */
export function planGraphicsPreferenceChange(): GraphicsPreferenceChange {
  const previous = readNextGraphicsQuality()
  const next = toggledGraphicsQuality(previous)
  if (readGraphicsModeOverride() !== undefined) {
    const url = new URL(location.href)
    url.searchParams.set('graphics', next)
    return {
      via: 'url',
      url: url.href,
      active: graphicsQuality,
      previous,
      next,
    }
  }
  return {
    via: 'storage',
    active: graphicsQuality,
    previous,
    next,
  }
}

/** Carries out a change {@link planGraphicsPreferenceChange} decided on. By URL it leaves this page for one that loads with the new graphics; by storage it only stores them, and the next load renders with them. */
export function applyGraphicsPreferenceChange(change: GraphicsPreferenceChange) {
  if (change.via === 'url') {
    location.assign(change.url)
    return
  }
  writeStored('graphics', change.next)
}

/** Flip the graphics quality of the next load between fast and heavy, as the menu’s Graphics button does, and tell which quality it goes by from now on. */
export function toggleGraphicsPreference(): GraphicsPreferenceChange {
  const change = planGraphicsPreferenceChange()
  applyGraphicsPreferenceChange(change)
  return change
}
