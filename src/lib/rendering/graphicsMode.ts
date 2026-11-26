import type {RenderPipelineSetting, RenderPipelineSettings} from './renderPipelineSettings.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

import {readStored} from '#src/lib/browserStorage.ts'

import {isShowingAlbedo} from './albedo.ts'
import {isHeavyCapable, readHeavyCapabilityHints} from './autoGraphics.ts'

/** concrete graphics quality presets */
export const graphicsQualities = ['fast', 'heavy', 'cinematic'] as const

/** a graphics mode by its name, as `?graphics` and storage take it */
export type GraphicsQuality = typeof graphicsQualities[number]

/** a `?graphics` name: a graphics quality preset or `auto`, which picks fast or heavy for the GPU */
export type GraphicsModeName = GraphicsQuality | 'auto'

const graphicsModeNames: ReadonlyArray<GraphicsModeName> = [...graphicsQualities, 'auto']

/** Format a graphics mode boolean pair as its preset name. */
export function getGraphicsName(isHeavy: boolean, isCinematic = false): GraphicsQuality {
  if (!isHeavy) {
    return 'fast'
  }
  return isCinematic ? 'cinematic' : 'heavy'
}

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

const defaultUrl = () => (typeof location === 'undefined' ? '' : location.href)

/** Read the `?graphics` name: fast, heavy, cinematic or auto. Anything else is fast. */
export function readGraphicsModeName(input: URL | string = defaultUrl()): GraphicsModeName {
  return readPermalink(input, {schema: graphicsModeSchema}).graphics
}

/** Read an explicit `?graphics` (or permalink `data`) override, or `undefined` when the URL leaves graphics to storage and defaults. */
export function readGraphicsOverride(input: URL | string = defaultUrl()): GraphicsModeName | undefined {
  const raw = readPermalink(input)
  if (!Object.hasOwn(raw, 'graphics')) {
    return undefined
  }
  return normalizeGraphicsMode(raw.graphics)
}

/** Parse a graphics mode name read from browser storage. */
export function parseStoredGraphics(value: string | null): GraphicsModeName | undefined {
  return graphicsModeNames.find(name => name === value)
}

const startupOverride = readGraphicsOverride()
const startupStored = readStored('graphics')
const startupName: GraphicsModeName = startupOverride ?? parseStoredGraphics(startupStored) ?? 'fast'
// Only `auto` (from `?graphics=auto` or storage) waits for the adapter, before anything reads the graphics mode.
const isAutoHeavy = startupName === 'auto' && isHeavyCapable(await readHeavyCapabilityHints())

/** Resolve the concrete graphics quality from an optional URL override, a stored preference and the `auto` GPU verdict. */
export function resolveGraphicsQuality(override: GraphicsModeName | undefined, stored: string | null, autoHeavy = isAutoHeavy): GraphicsQuality {
  const name = override ?? parseStoredGraphics(stored) ?? 'fast'
  return name === 'auto' ? (autoHeavy ? 'heavy' : 'fast') : name
}

/** Read whether `?graphics` asks for heavy graphics, which cinematic graphics are too. `auto` reads as what it picked for this page’s GPU. */
export function readGraphicsMode(input?: URL | string) {
  const name = readGraphicsModeName(input)
  if (name === 'auto') {
    return isAutoHeavy
  }
  return name !== 'fast'
}

/** Read whether `?graphics` asks for cinematic graphics: heavy, but budgeted for non-realtime rendering. */
export function readCinematicGraphics(input?: URL | string) {
  return readGraphicsModeName(input) === 'cinematic'
}

/** Read the profile `?graphics` asks for. */
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

/** the graphics quality of this session, fixed at startup from `?graphics`, browser storage or the `fast` default */
export const graphicsQuality: GraphicsQuality = resolveGraphicsQuality(startupOverride, startupStored, isAutoHeavy)

/** whether this session runs in heavy graphics (including cinematic), fixed at startup */
export const isHeavyGraphics = graphicsQuality !== 'fast'

/** whether this session runs in cinematic graphics, fixed at startup */
export const isCinematicGraphics = graphicsQuality === 'cinematic'

/** the graphics budget of this session, fixed at startup */
export const graphicsProfile: GraphicsProfile = getGraphicsProfile(isHeavyGraphics, isCinematicGraphics)

/** whether shadows are rendered in this session; `?albedo` shows no shadows, so their maps would only cost time */
export const shadowsEnabled = graphicsProfile.shadows && !isShowingAlbedo
