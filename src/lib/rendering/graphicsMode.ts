import type {RenderPipelineSetting, RenderPipelineSettings} from './renderPipelineSettings.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'
import useGraphicsMode from 'use-graphics-mode'

import {isHeavyCapable, readHeavyCapabilityHints} from './autoGraphics.ts'

/** a `?graphics` name: a graphics mode or `auto`, which picks fast or heavy for the GPU */
type GraphicsModeName = ReturnType<typeof useGraphicsMode.getName> | 'auto'

const graphicsModeNames: Array<GraphicsModeName> = [useGraphicsMode.getName(false), useGraphicsMode.getName(true), useGraphicsMode.getName(true, true), 'auto']
const normalizeGraphicsMode = (value: unknown): GraphicsModeName => {
  if (value === true) {
    return useGraphicsMode.getName(true)
  }
  return graphicsModeNames.find(name => name === value) ?? useGraphicsMode.getName(false)
}
const graphicsModeSchema = optis({
  defaults: {
    graphics: useGraphicsMode.getName(false),
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
  /** whether runtime canvas textures such as signs keep mipmaps, and with them anisotropic filtering, at the cost of building them */
  canvasTextureMipmaps: boolean
  /** backing pixels per logical texel for runtime canvas textures such as signs */
  canvasTextureResolution: number
  /** optional contact shadow overrides, which may switch them on */
  contactShadowTuning?: ContactShadowTuning
  /** factor on the segment counts of round meshes that opt in, along each curved direction */
  curveDetail: number
  floorReflections: boolean
  /** whether screen-space indirect light bounces the lit scene off the surfaces’ diffuse color */
  indirectLight: boolean
  /** filter radius for shadow-casting lamps, in shadow-map texels, so a larger `shadowMapScale` needs a proportionally larger radius for the same penumbra; independent of the Sun */
  lampShadowRadius?: number
  /** whether screen-space reflections add to metallic surfaces like gilded frames and trims, on top of the floor reflections */
  metalReflections: boolean
  noiseTextures: boolean
  postprocessing: boolean
  /** floor reflection pixels per output pixel along each axis */
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
  /** how often the voxel indirect light bounces once the tuning panel switches it on, once by default */
  voxelIndirectLightBounces?: number
}

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

/** Read the `?graphics` name: fast, heavy, cinematic or auto. Anything else is fast. */
export function readGraphicsModeName(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: graphicsModeSchema}).graphics
}

// Only `?graphics=auto` waits for the adapter, before anything reads the graphics mode.
const isAutoHeavy = readGraphicsModeName() === 'auto' && isHeavyCapable(await readHeavyCapabilityHints())

/** Read whether `?graphics` asks for heavy graphics, which cinematic graphics are too. `auto` reads as what it picked for this page’s GPU. */
export function readGraphicsMode(input?: URL | string) {
  const name = readGraphicsModeName(input)
  if (name === 'auto') {
    return isAutoHeavy
  }
  return name !== useGraphicsMode.getName(false)
}

/** Read whether `?graphics` asks for cinematic graphics: heavy, but budgeted for non-realtime rendering. */
export function readCinematicGraphics(input?: URL | string) {
  return readGraphicsModeName(input) === useGraphicsMode.getName(true, true)
}

/** Read the profile `?graphics` asks for, for code outside React. It ignores later menu changes, so prefer `useGraphicsModeValue(getGraphicsProfile)` where a component can rebuild. */
export function readGraphicsProfile(input?: URL | string) {
  return getGraphicsProfile(readGraphicsMode(input), readCinematicGraphics(input))
}

const fastProfile: GraphicsProfile = {
  canvasTextureMipmaps: false,
  canvasTextureResolution: 0.5,
  curveDetail: 1,
  noiseTextures: false,
  floorReflections: false,
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
  floorReflections: true,
  indirectLight: false,
  lampShadowRadius: 4,
  metalReflections: false,
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
// Cinematic raises intermediate and shadow-map resolutions, AO quality, texture filtering, curve tessellation, indirect light and metal reflections for non-realtime rendering.
const cinematicProfile: GraphicsProfile = {
  ...heavyProfile,
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
  metalReflections: true,
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
