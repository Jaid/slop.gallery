import type {RenderPipelineSettings} from '#src/lib/rendering/renderPipelineSettings.ts'
import type {TuningGroup} from './controls.ts'

import {getAntiAliasing} from '#src/lib/rendering/antiAliasing.ts'
import {cinematicMaxTextureSize, graphicsProfiles} from '#src/lib/rendering/graphicsMode.ts'
import {isCinematicGraphics, isHeavyGraphics} from '#src/lib/rendering/graphicsQuality.ts'
import {getRenderPipelineSettings, renderPipelineStructure} from '#src/lib/rendering/renderPipelineSettings.ts'
import {currentWorldId} from '#src/worlds/index.ts'

import TuningModule from './base/TuningModule.ts'
import {plainOptions, scaleOptions, tuningControls} from './controls.ts'

const {group, percent, range, select, toggle} = tuningControls<RenderPipelineSettings>()
/** the brightest value a half-float target holds, so a cap there caps nothing */
const uncappedLuminance = 65_504
/** Cinematic graphics request a texture size limit that fits a 16384² map; heavy graphics stop at WebGPU’s default of 8192. */
const shadowMapSizes = [1024, 2048, 4096, 8192, ...isCinematicGraphics ? [cinematicMaxTextureSize] : []]
const structure: ReadonlySet<string> = new Set(renderPipelineStructure)

/**
 * The render pipeline of heavy graphics, its passes and their settings, and the shadows’ lookups. Checkboxes switch passes, which builds the pipeline anew, and sliders change its uniforms live.
 * It starts from the pipeline of the page’s heavy graphics, heavy or cinematic.
 */
export default class PipelineTuningModule extends TuningModule<RenderPipelineSettings> {
  override readonly groups: ReadonlyArray<TuningGroup<RenderPipelineSettings>> = [
    group({
      title: 'Temporal antialiasing',
      toggle: {
        fallback: 'traa',
        key: 'antiAliasing',
        off: false,
      },
      controls: [],
    }),
    group({
      title: 'Mirror reflections',
      toggle: 'mirrorReflections',
      controls: [
        select('reflectionResolutionScale', 'Resolution', scaleOptions([0.5, 1, 2])),
        percent('mirrorReflectionStrength', 'Strength', 0, 4, 0.05),
        percent('mirrorReflectionGrazing', 'Grazing', 0, 4, 0.05),
        percent('mirrorReflectionLevel', 'Loss', 0.05, 4, 0.05, {off: {
          fallback: 1,
          off: 0,
        }}),
        percent('mirrorReflectionBlur', 'Gaussian blur', 0.05, 4, 0.05, {off: {
          fallback: 1,
          off: 0,
        }}),
        percent('mirrorReflectionRoughness', 'Roughness', 0, 4, 0.05),
      ],
    }),
    group({
      title: 'Screen-space reflections',
      toggle: 'screenSpaceReflections',
      controls: [
        select('screenSpaceReflectionResolutionScale', 'Resolution', scaleOptions([0.25, 0.5, 1])),
        percent('screenSpaceReflectionIntensity', 'Intensity', 0, 2, 0.1),
        range('screenSpaceReflectionDistance', 'Distance', 0.5, 20, 0.5, {unit: 'm'}),
        range('screenSpaceReflectionThickness', 'Thickness', 0.05, 1, 0.05, {unit: 'm'}),
      ],
    }),
    group({
      title: 'Ambient occlusion',
      toggle: 'ambientOcclusion',
      controls: [
        select('ambientOcclusionResolutionScale', 'Resolution', scaleOptions([0.5, 0.75, 1, 1.5, 2])),
        range('ambientOcclusionSamples', 'Samples', 4, 64, 4, {integer: true}),
        range('ambientOcclusionRadius', 'Radius', 0.02, 1, 0.02, {unit: 'm'}),
        range('ambientOcclusionThickness', 'Thickness', 0.1, 3, 0.1),
        percent('ambientOcclusionScale', 'Strength', 0, 2, 0.05),
        toggle('ambientOcclusionTemporalFiltering', 'Temporal filtering'),
      ],
    }),
    group({
      title: 'Screen-space indirect light',
      toggle: 'screenSpaceIndirectLight',
      controls: [
        select('screenSpaceIndirectLightResolutionScale', 'Resolution', scaleOptions([0.5, 0.75, 1, 1.5, 2])),
        range('screenSpaceIndirectLightIntensity', 'Intensity', 0, 16, 0.5),
        range('screenSpaceIndirectLightRadius', 'Radius', 1, 32, 1),
        range('screenSpaceIndirectLightSlices', 'Slices', 1, 4, 1, {integer: true}),
        range('screenSpaceIndirectLightSteps', 'Steps', 4, 32, 4, {integer: true}),
        range('screenSpaceIndirectLightThickness', 'Thickness', 0.1, 4, 0.1),
        range('screenSpaceIndirectLightExpFactor', 'Exp factor', 1, 4, 0.1),
        percent('screenSpaceIndirectLightBackfaceLighting', 'Backface lighting', 0.05, 1, 0.05, {off: {
          fallback: 0.5,
          off: 0,
        }}),
        range('screenSpaceIndirectLightAmbientOcclusion', 'AO intensity', 0.1, 4, 0.1, {off: {
          fallback: 1,
          off: 0,
        }}),
        toggle('screenSpaceIndirectLightTemporalFiltering', 'Temporal filtering'),
      ],
    }),
    group({
      title: 'Voxel indirect light',
      toggle: 'voxelIndirectLight',
      controls: [
        select('voxelIndirectLightResolution', 'Voxels', [[64, '64³'], [128, '128³'], [256, '256³']]),
        range('voxelIndirectLightIntensity', 'Intensity', 0, 0.5, 0.01),
        range('voxelIndirectLightBounces', 'Bounces', 0, 4, 1, {integer: true}),
        range('voxelIndirectLightConeCount', 'Cones', 1, 9, 1, {integer: true}),
        range('voxelIndirectLightConeAngle', 'Cone angle', 10, 80, 5, {unit: '°'}),
      ],
    }),
    group({
      title: 'Volumetric sunlight',
      toggle: 'volumetricLight',
      controls: [
        select('volumetricLightResolutionScale', 'Resolution', scaleOptions([0.25, 0.5, 1])),
        range('volumetricLightDensity', 'Density', 0, 20, 0.5),
        percent('volumetricLightMaxDensity', 'Max density', 0, 1, 0.05),
        range('volumetricLightSteps', 'Steps', 16, 256, 16, {integer: true}),
        range('volumetricLightDistanceAttenuation', 'Attenuation', 0, 8, 0.25),
        select('volumetricLightBlur', 'Blur', plainOptions([1, 2, 3, 4, 6, 8]), {off: {
          fallback: 3,
          off: 0,
        }}),
      ],
    }),
    group({
      title: 'Contact shadows',
      toggle: 'contactShadows',
      controls: [
        select('contactShadowResolutionScale', 'Resolution', scaleOptions([0.5, 0.75, 1])),
        range('contactShadowDistance', 'Distance', 0.01, 0.5, 0.01, {unit: 'm'}),
        range('contactShadowThickness', 'Thickness', 0.005, 0.1, 0.005, {unit: 'm'}),
        percent('contactShadowIntensity', 'Intensity', 0, 1, 0.05),
        range('contactShadowQuality', 'Quality', 0.1, 2, 0.1),
        toggle('contactShadowDenoise', 'Denoise'),
        range('contactShadowDenoiseRadius', 'Denoise radius', 1, 16, 1, {
          integer: true,
          when: settings => settings.contactShadowDenoise,
        }),
      ],
    }),
    group({
      // Only the gallery’s sun follows these; other worlds’ suns and moons keep their graphics mode’s shadows.
      available: currentWorldId === 'gallery',
      title: 'Sun shadow',
      controls: [
        select('sunShadowMapSize', 'Map', shadowMapSizes.map(size => [size, `${size}²`])),
        range('sunShadowSamples', 'Samples', 1, 32, 1, {integer: true}),
        range('sunShadowRadius', 'Filter radius', 0, 8, 0.25),
      ],
    }),
    group({
      title: 'Lamp shadows',
      controls: [
        range('lampShadowSamples', 'Samples', 1, 32, 1, {integer: true}),
        range('lampShadowRadius', 'Filter radius', 0, 8, 0.25),
      ],
    }),
    group({
      title: 'Bloom',
      toggle: 'bloom',
      controls: [
        select('bloomResolutionScale', 'Resolution', scaleOptions([0.125, 0.25, 0.375, 0.5, 0.75, 1])),
        select('bloomMipCount', 'Blur mips', plainOptions([1, 2, 3, 4, 5])),
        select('bloomGaussianKernelSize', 'Gaussian kernel size', plainOptions([2, 4, 6, 8, 10, 12])),
        percent('bloomStrength', 'Strength', 0, 2, 0.1),
        range('bloomRadius', 'Radius', 0, 1, 0.05),
        range('bloomThreshold', 'Threshold', 0, 4, 0.1),
        range('bloomSmoothWidth', 'Smooth width', 0, 0.5, 0.01),
        range('bloomLuminanceCap', 'Brightness cap', 1, 64, 1, {off: {
          fallback: 8,
          off: uncappedLuminance,
        }}),
      ],
    }),
    group({
      title: 'Finish',
      controls: [
        percent('vignette', 'Vignette', 0.05, 1, 0.05, {off: {
          fallback: 0.2,
          off: 0,
        }}),
        toggle('dither', 'Dither'),
      ],
    }),
  ]

  override readonly hint = 'Only heavy graphics draw through the pipeline. Switch the menu’s graphics to heavy and reload to tune it.'
  override readonly title = 'Render pipeline'

  constructor() {
    super('pipeline', getRenderPipelineSettings(graphicsProfiles[isCinematicGraphics ? 'cinematic' : 'heavy'], getAntiAliasing(true)))
  }

  /** Only heavy graphics draw through a pipeline of passes, and the page keeps its graphics. */
  override isShown() {
    return isHeavyGraphics
  }

  override rebuilds(key: string) {
    return structure.has(key)
  }

  override useShown() {
    return isHeavyGraphics
  }
}

/** the render pipeline of the world tuning */
export const pipelineTuning = new PipelineTuningModule
