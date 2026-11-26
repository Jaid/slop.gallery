import type {RenderPipelineSetting, RenderPipelineSettings} from './renderPipelineSettings.ts'

import optis from 'optis'
import readPermalink from 'read-permalink'

/** every graphics quality by its name, as `?graphics` and the browser storage take it, from the cheapest to the most expensive */
export const graphicsQualities = ['fast', 'heavy', 'cinematic'] as const
/** a graphics quality by its name: fast, heavy, or cinematic, which is heavy budgeted for non-realtime rendering */
export type GraphicsQuality = typeof graphicsQualities[number]
/** a `?graphics` name: a graphics quality or `auto`, which picks fast or heavy for the GPU */
export type GraphicsModeName = GraphicsQuality | 'auto'

const graphicsModeNames: ReadonlyArray<GraphicsModeName> = [...graphicsQualities, 'auto']

/** The name, if it is one of a graphics quality or `auto`; a bare flag names heavy graphics. */
export function parseGraphicsModeName(value: unknown): GraphicsModeName | undefined {
  if (value === true) {
    return 'heavy'
  }
  return graphicsModeNames.find(name => name === value)
}
const graphicsModeSchema = optis({
  defaults: {
    graphics: 'fast',
  },
  normalizations: {
    graphics: (value: unknown): GraphicsModeName => parseGraphicsModeName(value) ?? 'fast',
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

/** Read the `?graphics` name: fast, heavy, cinematic or auto. Anything else is fast. */
export function readGraphicsModeName(input: URL | string = typeof location === 'undefined' ? '' : location.href) {
  return readPermalink(input, {schema: graphicsModeSchema}).graphics
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

/** the budget of every graphics quality by its name */
export const graphicsProfiles: Readonly<Record<GraphicsQuality, GraphicsProfile>> = {
  fast: fastProfile,
  heavy: heavyProfile,
  cinematic: cinematicProfile,
}

/** Resolve the sun’s independent shadow-map dimensions, PCF width and sample budget. */
export function getSunShadowSettings(profile: GraphicsProfile, baseMapSize: number) {
  return {
    mapSize: profile.sunShadowMapSize ?? baseMapSize * profile.shadowMapScale,
    radius: profile.sunShadowRadius ?? profile.shadowMapScale,
    samples: profile.sunShadowSamples ?? profile.shadowSamples,
  }
}
