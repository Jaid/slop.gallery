import type {AntiAliasing} from './antiAliasing.ts'
import type {GraphicsProfile} from './graphicsMode.ts'

import world from '#src/worlds/current.ts'

import {sunShadowMapSize} from '../gallery/sun.ts'
import {getSunShadowSettings} from './graphicsMode.ts'

/** Every value the render pipeline is built from. The graphics mode fills them in; the tuning panel of `?development` changes them. */
export type RenderPipelineSettings = {
  ambientOcclusion: boolean
  ambientOcclusionRadius: number
  /** ambient occlusion pixels per output pixel along each axis */
  ambientOcclusionResolutionScale: number
  ambientOcclusionSamples: number
  ambientOcclusionScale: number
  ambientOcclusionTemporalFiltering: boolean
  ambientOcclusionThickness: number
  antiAliasing: AntiAliasing
  bloom: boolean
  /** Gaussian kernel radius at the first level; successive levels add four, as in Three.js */
  bloomGaussianKernelSize: number
  /** brightest luminance one pixel may feed into bloom. Intended glow sources (chandelier flames, emissive veins) peak around 4; sharp specular fireflies reach hundreds. */
  bloomLuminanceCap: number
  /** number of progressively downsampled Gaussian blur levels, from 1 to 5 */
  bloomMipCount: number
  bloomRadius: number
  /** bloom pixels per output pixel along each axis */
  bloomResolutionScale: number
  bloomSmoothWidth: number
  bloomStrength: number
  bloomThreshold: number
  contactShadowDenoise: boolean
  contactShadowDenoiseRadius: number
  contactShadowDistance: number
  contactShadowIntensity: number
  contactShadowQuality: number
  contactShadowResolutionScale: number
  contactShadows: boolean
  contactShadowThickness: number
  /** whether the output dithers by half an 8-bit step, so smooth, dark gradients don’t band */
  dither: boolean
  /** how many texels each lamp’s shadow filter radius spans per unit of its own radius */
  lampShadowRadius: number
  /** shadow map lookups per pixel for every lamp */
  lampShadowSamples: number
  /** factor on every reflective floor’s Gaussian blur radius */
  mirrorReflectionBlur: number
  /** factor on every reflective floor’s extra reflectance at grazing angles */
  mirrorReflectionGrazing: number
  /** factor on every reflective floor’s loss, the mip level of the mirror it reads */
  mirrorReflectionLevel: number
  /** factor on every reflective floor’s roughness */
  mirrorReflectionRoughness: number
  /** whether the reflective floors mirror the room through their shared planar mirror */
  mirrorReflections: boolean
  /** factor on every reflective floor’s reflectance */
  mirrorReflectionStrength: number
  /** floor reflection pixels per output pixel along each axis */
  reflectionResolutionScale: number
  screenSpaceIndirectLight: boolean
  screenSpaceIndirectLightAmbientOcclusion: number
  screenSpaceIndirectLightBackfaceLighting: number
  screenSpaceIndirectLightExpFactor: number
  screenSpaceIndirectLightIntensity: number
  screenSpaceIndirectLightRadius: number
  /** screen-space indirect light pixels per output pixel along each axis */
  screenSpaceIndirectLightResolutionScale: number
  screenSpaceIndirectLightSlices: number
  screenSpaceIndirectLightSteps: number
  screenSpaceIndirectLightTemporalFiltering: boolean
  screenSpaceIndirectLightThickness: number
  screenSpaceReflectionDistance: number
  screenSpaceReflectionIntensity: number
  screenSpaceReflectionResolutionScale: number
  /** whether screen-space reflections add to metallic surfaces like gilded frames and trims */
  screenSpaceReflections: boolean
  screenSpaceReflectionThickness: number
  /** texels along each axis of the gallery sun’s shadow map */
  sunShadowMapSize: number
  /** the sun’s shadow filter radius, in texels */
  sunShadowRadius: number
  /** shadow map lookups per pixel for the sun */
  sunShadowSamples: number
  vignette: number
  volumetricLight: boolean
  /** the Gaussian blur’s sigma over the raymarched shafts */
  volumetricLightBlur: number
  volumetricLightDensity: number
  volumetricLightDistanceAttenuation: number
  volumetricLightMaxDensity: number
  volumetricLightResolutionScale: number
  volumetricLightSteps: number
  voxelIndirectLight: boolean
  voxelIndirectLightBounces: number
  voxelIndirectLightConeAngle: number
  voxelIndirectLightConeCount: number
  voxelIndirectLightIntensity: number
  /** voxels along each axis of the volume */
  voxelIndirectLightResolution: number
}

export type RenderPipelineSetting = keyof RenderPipelineSettings

/** the settings that change which passes the pipeline has or how they are set up, so changing one builds it anew; every other setting is a uniform that can change live. A new sun filter builds a new sun, which the passes that march its shadow map have to pick up. */
export const renderPipelineStructure = ['ambientOcclusion', 'ambientOcclusionResolutionScale', 'ambientOcclusionTemporalFiltering', 'antiAliasing', 'bloom', 'bloomGaussianKernelSize', 'bloomMipCount', 'bloomResolutionScale', 'contactShadowDenoise', 'contactShadowResolutionScale', 'contactShadows', 'dither', 'mirrorReflections', 'reflectionResolutionScale', 'screenSpaceIndirectLight', 'screenSpaceIndirectLightResolutionScale', 'screenSpaceIndirectLightTemporalFiltering', 'screenSpaceReflectionResolutionScale', 'screenSpaceReflections', 'sunShadowSamples', 'volumetricLight', 'volumetricLightBlur', 'volumetricLightResolutionScale', 'voxelIndirectLight', 'voxelIndirectLightResolution'] as const satisfies Array<RenderPipelineSetting>

export type RenderPipelineStructure = Pick<RenderPipelineSettings, typeof renderPipelineStructure[number]>

/** the settings a pipeline can change live */
export type RenderPipelineUniform = {[Key in RenderPipelineSetting]: RenderPipelineSettings[Key] extends number ? (Key extends typeof renderPipelineStructure[number] ? never : Key) : never}[RenderPipelineSetting]

/** The render pipeline of a graphics profile. */
export function getRenderPipelineSettings(profile: GraphicsProfile, antiAliasing: AntiAliasing): RenderPipelineSettings {
  const sunShadow = getSunShadowSettings(profile, sunShadowMapSize)
  return {
    ambientOcclusion: true,
    ambientOcclusionRadius: 0.5,
    ambientOcclusionResolutionScale: profile.ambientOcclusionResolutionScale,
    ambientOcclusionSamples: profile.ambientOcclusionSamples,
    ambientOcclusionScale: 1,
    ambientOcclusionTemporalFiltering: false,
    ambientOcclusionThickness: profile.ambientOcclusionThickness ?? world.ambientOcclusionThickness,
    antiAliasing,
    bloom: profile.postprocessing,
    bloomGaussianKernelSize: 6,
    bloomMipCount: 5,
    bloomResolutionScale: 0.5,
    bloomLuminanceCap: 4,
    bloomRadius: 0.3,
    bloomSmoothWidth: 0.2,
    bloomStrength: 0.5,
    bloomThreshold: 2,
    contactShadowDenoise: true,
    contactShadowDenoiseRadius: 5,
    contactShadowDistance: 0.1,
    contactShadowIntensity: 0.7,
    contactShadowQuality: 1,
    contactShadowResolutionScale: 1,
    contactShadows: false,
    contactShadowThickness: 0.01,
    dither: false,
    lampShadowRadius: profile.lampShadowRadius ?? profile.shadowMapScale,
    lampShadowSamples: profile.shadowSamples,
    mirrorReflectionBlur: 1,
    mirrorReflectionLevel: 1,
    mirrorReflectionGrazing: 1,
    mirrorReflectionRoughness: 1,
    mirrorReflectionStrength: 1,
    mirrorReflections: profile.floorReflections,
    reflectionResolutionScale: profile.reflectionResolutionScale,
    screenSpaceIndirectLight: profile.indirectLight,
    screenSpaceIndirectLightAmbientOcclusion: 0,
    screenSpaceIndirectLightBackfaceLighting: 0,
    screenSpaceIndirectLightExpFactor: 2,
    screenSpaceIndirectLightIntensity: 4,
    screenSpaceIndirectLightRadius: 12,
    screenSpaceIndirectLightResolutionScale: 1,
    screenSpaceIndirectLightSlices: 3,
    screenSpaceIndirectLightSteps: 16,
    screenSpaceIndirectLightTemporalFiltering: antiAliasing === 'traa',
    screenSpaceIndirectLightThickness: 1,
    ...profile.ssgi,
    screenSpaceReflectionDistance: 4,
    screenSpaceReflectionIntensity: 1,
    screenSpaceReflectionResolutionScale: 1,
    screenSpaceReflections: profile.metalReflections,
    screenSpaceReflectionThickness: 0.1,
    sunShadowMapSize: sunShadow.mapSize,
    sunShadowRadius: sunShadow.radius,
    sunShadowSamples: sunShadow.samples,
    vignette: 0,
    volumetricLight: profile.volumetricLight,
    volumetricLightBlur: 0,
    volumetricLightDensity: 20,
    volumetricLightDistanceAttenuation: 2.5,
    volumetricLightMaxDensity: 1,
    volumetricLightResolutionScale: 0.25,
    volumetricLightSteps: profile.volumetricLightSteps,
    // Voxel cone tracing cost about 4 ms of GPU time per frame at 1080p and 11 ms at 2160p for faint light, so no world has it; the tuning panel of `?development` switches it on.
    voxelIndirectLight: false,
    voxelIndirectLightBounces: profile.voxelIndirectLightBounces ?? 1,
    voxelIndirectLightConeAngle: 40,
    voxelIndirectLightConeCount: 3,
    voxelIndirectLightIntensity: 0.2,
    voxelIndirectLightResolution: 256,
  }
}

/** Pick the settings a pipeline is built from. */
export function getRenderPipelineStructure(settings: RenderPipelineSettings): RenderPipelineStructure {
  return Object.fromEntries(renderPipelineStructure.map(key => [key, settings[key]])) as RenderPipelineStructure
}
