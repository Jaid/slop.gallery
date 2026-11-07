import {expect, test} from 'bun:test'

import {renderToStaticMarkup} from 'react-dom/server'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import GraphicsMode from '../../src/components/App/GraphicsMode.tsx'
import {fitCanvasTextureResolution, getGraphicsProfile, getSunShadowSettings, readCinematicGraphics, readGraphicsMode, readGraphicsModeName, readGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings, getRenderPipelineStructure} from '../../src/lib/rendering/renderPipelineSettings.ts'

function ReadProfile() {
  const isHeavy: boolean = useGraphicsMode()
  const profile = useGraphicsModeValue(getGraphicsProfile)
  return <span>{String(isHeavy)}:{JSON.stringify(profile)}</span>
}
test('graphics URL names round-trip through boolean state and default to fast', () => {
  expect(readGraphicsMode()).toBe(false)
  for (const isHeavy of [true, false]) {
    const name = useGraphicsMode.getName(isHeavy)
    expect(readGraphicsMode(`?graphics=${name}`)).toBe(isHeavy)
  }
  for (const value of ['', 'lite', 'full', 'Auto', 'high', 'quality', 'performance', 'QUALITY', 'true', 'false', 'Cinematic']) {
    expect(readGraphicsMode(`?graphics=${value}`)).toBe(false)
    expect(readCinematicGraphics(`?graphics=${value}`)).toBe(false)
    expect(readGraphicsModeName(`?graphics=${value}`)).toBe('fast')
  }
})
test('auto graphics read as what the page picked for its GPU, which is fast without WebGPU, and never as cinematic', () => {
  expect(readGraphicsModeName('?graphics=auto')).toBe('auto')
  expect(readGraphicsMode('?graphics=auto')).toBe(false)
  expect(readCinematicGraphics('?graphics=auto')).toBe(false)
  expect(readGraphicsProfile('?graphics=auto')).toBe(getGraphicsProfile(false))
})
test('cinematic graphics read as heavy, and only cinematic reads as cinematic', () => {
  expect(readGraphicsModeName('?graphics=cinematic')).toBe('cinematic')
  expect(readGraphicsMode('?graphics=cinematic')).toBe(true)
  expect(readCinematicGraphics('?graphics=cinematic')).toBe(true)
  expect(readCinematicGraphics('?graphics=heavy')).toBe(false)
  expect(readCinematicGraphics()).toBe(false)
  expect(readGraphicsProfile('?graphics=cinematic')).toBe(getGraphicsProfile(true, true))
  expect(readGraphicsProfile('?graphics=heavy')).toBe(getGraphicsProfile(true))
  expect(readGraphicsProfile()).toBe(getGraphicsProfile(false))
})
test('the cinematic profile increases intermediate resolutions, AO quality, shadow samples and lamp filter radius, texture filtering, curve tessellation, indirect light and metal reflections', () => {
  const heavy = getGraphicsProfile(true)
  const cinematic = getGraphicsProfile(true, true)
  expect(cinematic).toEqual({
    ...heavy,
    canvasTextureMipmaps: true,
    canvasTextureResolution: 2,
    curveDetail: 2,
    indirectLight: true,
    metalReflections: true,
    ambientOcclusionResolutionScale: 2,
    ambientOcclusionSamples: 64,
    ambientOcclusionThickness: 2,
    reflectionResolutionScale: 2,
    shadowMapScale: 4,
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
  })
  expect(getGraphicsProfile(true, true)).toBe(cinematic)
  expect(getGraphicsProfile(false, true)).toBe(getGraphicsProfile(false))
})
test('the provider exposes the fast profile during SSR, and every profile keeps its identity', () => {
  const html = renderToStaticMarkup(<GraphicsMode><ReadProfile /></GraphicsMode>)
  expect(html).toBe(renderToStaticMarkup(<span>false:{JSON.stringify(getGraphicsProfile(false))}</span>))
  expect(getGraphicsProfile(false).postprocessing).toBe(false)
  expect(getGraphicsProfile(true)).toBe(getGraphicsProfile(true))
  expect(getGraphicsProfile(false)).toBe(getGraphicsProfile(false))
})
test('heavy and cinematic share the tuned volumetric sunlight values, apart from cinematic raymarch steps', () => {
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  const volumetric = {
    volumetricLight: true,
    volumetricLightBlur: 0,
    volumetricLightDensity: 20,
    volumetricLightDistanceAttenuation: 2.5,
    volumetricLightMaxDensity: 1,
    volumetricLightResolutionScale: 0.25,
  }
  expect(heavy).toMatchObject({
    ...volumetric,
    volumetricLightSteps: 64,
  })
  expect(cinematic).toMatchObject({
    ...volumetric,
    volumetricLightSteps: 128,
  })
})
test('every profile shares the AO radius and strength, and Cinematic raises the AO quality', () => {
  const fast = getRenderPipelineSettings(getGraphicsProfile(false), false)
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  expect(cinematic).toMatchObject({
    ambientOcclusion: true,
    ambientOcclusionRadius: 0.5,
    ambientOcclusionResolutionScale: 2,
    ambientOcclusionSamples: 64,
    ambientOcclusionScale: 1,
    ambientOcclusionTemporalFiltering: false,
    ambientOcclusionThickness: 2,
  })
  expect(fast.ambientOcclusionResolutionScale).toBe(1)
  expect(fast.ambientOcclusionSamples).toBe(16)
  expect(fast.ambientOcclusionRadius).toBe(0.5)
  expect(fast.ambientOcclusionScale).toBe(1)
  expect(heavy.ambientOcclusionRadius).toBe(0.5)
  expect(heavy.ambientOcclusionResolutionScale).toBe(1)
  expect(heavy.ambientOcclusionSamples).toBe(16)
  expect(heavy.ambientOcclusionScale).toBe(1)
  expect(heavy.ambientOcclusionThickness).toBe(1)
})
test('only Cinematic adds screen-space reflections on metallic surfaces to the floor reflections', () => {
  expect(getRenderPipelineSettings(getGraphicsProfile(false), false)).toMatchObject({
    mirrorReflections: false,
    screenSpaceReflections: false,
  })
  expect(getRenderPipelineSettings(getGraphicsProfile(true), 'traa')).toMatchObject({
    mirrorReflections: true,
    screenSpaceReflections: false,
  })
  expect(getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')).toMatchObject({
    mirrorReflections: true,
    screenSpaceReflections: true,
  })
})
test('Fast disables bloom, while Heavy and Cinematic use the current tuned bloom defaults', () => {
  const fast = getRenderPipelineSettings(getGraphicsProfile(false), false)
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  const tunedBloom = {
    bloom: true,
    bloomGaussianKernelSize: 6,
    bloomMipCount: 5,
    bloomResolutionScale: 0.5,
    bloomLuminanceCap: 4,
    bloomRadius: 0.3,
    bloomSmoothWidth: 0.2,
    bloomStrength: 0.5,
    bloomThreshold: 2,
  }
  expect(fast.bloom).toBe(false)
  expect(heavy).toMatchObject(tunedBloom)
  expect(cinematic).toMatchObject(tunedBloom)
})
test('bloom blur quality controls rebuild the render pipeline', () => {
  const settings = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  expect(getRenderPipelineStructure(settings)).toMatchObject({
    bloomGaussianKernelSize: 6,
    bloomMipCount: 5,
    bloomResolutionScale: 0.5,
  })
})
test('no graphics mode traces voxel indirect light, which the tuning panel switches on with one bounce, or two in Cinematic', () => {
  const fast = getRenderPipelineSettings(getGraphicsProfile(false), false)
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  for (const settings of [fast, heavy, cinematic]) {
    expect(settings).toMatchObject({
      voxelIndirectLight: false,
      voxelIndirectLightConeAngle: 40,
      voxelIndirectLightConeCount: 3,
      voxelIndirectLightIntensity: 0.2,
      voxelIndirectLightResolution: 256,
    })
  }
  expect(heavy.voxelIndirectLightBounces).toBe(1)
  expect(cinematic.voxelIndirectLightBounces).toBe(2)
})
test('Sun shadow presets are independent of the other lights and follow the configured map, radius and samples', () => {
  const fastProfile = getGraphicsProfile(false)
  const heavyProfile = getGraphicsProfile(true)
  const cinematicProfile = getGraphicsProfile(true, true)
  const fast = getRenderPipelineSettings(fastProfile, false)
  const heavy = getRenderPipelineSettings(heavyProfile, 'traa')
  const cinematic = getRenderPipelineSettings(cinematicProfile, 'traa')
  const fastSun = {
    mapSize: 4096,
    radius: 1,
    samples: 5,
  }
  const heavySun = {
    mapSize: 4096,
    radius: 4,
    samples: 4,
  }
  const cinematicSun = {
    mapSize: 8192,
    radius: 8,
    samples: 16,
  }
  expect(getSunShadowSettings(fastProfile, 4096)).toEqual(fastSun)
  expect(getSunShadowSettings(heavyProfile, 4096)).toEqual(heavySun)
  expect(getSunShadowSettings(cinematicProfile, 4096)).toEqual(cinematicSun)
  expect(fast).toMatchObject({
    sunShadowMapSize: 4096,
    sunShadowRadius: 1,
    sunShadowSamples: 5,
  })
  expect(heavy).toMatchObject({
    sunShadowMapSize: 4096,
    sunShadowRadius: 4,
    sunShadowSamples: 4,
  })
  expect(cinematic).toMatchObject({
    sunShadowMapSize: 8192,
    sunShadowRadius: 8,
    sunShadowSamples: 16,
  })
  expect(heavyProfile.shadowSamples).toBe(4)
  expect(cinematicProfile.shadowSamples).toBe(16)
})
test('Cinematic scales Heavy’s four-texel lamp shadow filtering with its four times larger maps without changing their samples or Sun', () => {
  const fast = getRenderPipelineSettings(getGraphicsProfile(false), false)
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  expect(fast.lampShadowRadius).toBe(1)
  expect(heavy.lampShadowRadius).toBe(4)
  expect(cinematic.lampShadowRadius).toBe(16)
  expect(heavy.lampShadowSamples).toBe(4)
  expect(cinematic.lampShadowSamples).toBe(16)
  expect(heavy.sunShadowRadius).toBe(4)
  expect(cinematic.sunShadowRadius).toBe(8)
})
test('Cinematic alone adopts the tuned SSGI settings', () => {
  const fast = getRenderPipelineSettings(getGraphicsProfile(false), false)
  const heavy = getRenderPipelineSettings(getGraphicsProfile(true), 'traa')
  const cinematic = getRenderPipelineSettings(getGraphicsProfile(true, true), 'traa')
  expect(fast.screenSpaceIndirectLight).toBe(false)
  expect(heavy.screenSpaceIndirectLight).toBe(false)
  expect(heavy).toMatchObject({
    screenSpaceIndirectLightAmbientOcclusion: 0,
    screenSpaceIndirectLightBackfaceLighting: 0,
    screenSpaceIndirectLightExpFactor: 2,
    screenSpaceIndirectLightIntensity: 4,
    screenSpaceIndirectLightRadius: 12,
    screenSpaceIndirectLightResolutionScale: 1,
    screenSpaceIndirectLightSlices: 3,
    screenSpaceIndirectLightSteps: 16,
    screenSpaceIndirectLightTemporalFiltering: true,
    screenSpaceIndirectLightThickness: 1,
  })
  expect(cinematic.screenSpaceIndirectLight).toBe(true)
  expect(cinematic).toMatchObject({
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
  })
})
test('canvas texture resolutions stay within the texture size limit', () => {
  expect(fitCanvasTextureResolution(2, 1024, 246)).toBe(2)
  expect(fitCanvasTextureResolution(2, 7200, 3840) * 7200).toBe(8192)
  expect(fitCanvasTextureResolution(0.5, 7200, 3840)).toBe(0.5)
})
