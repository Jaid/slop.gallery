import type {RenderPipelineSettings} from '../../src/lib/rendering/renderPipelineSettings.ts'

import {expect, test} from 'bun:test'

import {fitCanvasTextureResolution, getGraphicsProfile, getSunShadowSettings, graphicsProfile, graphicsQuality, graphicsQualityName, isCinematicGraphics, isHeavyGraphics, readCinematicGraphics, readGraphicsMode, readGraphicsModeName, readGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings, getRenderPipelineStructure} from '../../src/lib/rendering/renderPipelineSettings.ts'

test('graphics URL names round-trip through their booleans and default to fast', () => {
  expect(readGraphicsMode()).toBe(false)
  for (const isHeavy of [true, false]) {
    const name = graphicsQualityName(isHeavy)
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
test('the cinematic profile raises intermediate resolutions, AO quality, shadow samples and lamp filter radius, texture filtering, curve tessellation and indirect light over Heavy and keeps the rest', () => {
  const cinematicProfile = getGraphicsProfile(true, true)
  const heavy: Record<string, unknown> = getGraphicsProfile(true)
  const cinematic: Record<string, unknown> = cinematicProfile
  const raised = ['canvasTextureResolution', 'curveDetail', 'ambientOcclusionResolutionScale', 'ambientOcclusionSamples', 'reflectionResolutionScale', 'shadowMapScale', 'lampShadowRadius', 'shadowSamples', 'sunShadowRadius', 'sunShadowSamples', 'surfaceAnisotropy', 'volumetricLightSteps']
  for (const key of raised) {
    expect(cinematic[key] as number, key).toBeGreaterThan(heavy[key] as number)
  }
  const switched = ['canvasTextureMipmaps', 'indirectLight']
  for (const key of switched) {
    expect(heavy[key], key).toBe(false)
    expect(cinematic[key], key).toBe(true)
  }
  const added = ['ambientOcclusionThickness', 'bloomTuning', 'contactShadowTuning', 'sunShadowMapSize', 'ssgi', 'voxelIndirectLightBounces']
  for (const key of added) {
    expect(heavy[key], key).toBeUndefined()
    expect(cinematic[key], key).toBeDefined()
  }
  for (const [key, value] of Object.entries(heavy)) {
    if (![...raised, ...switched].includes(key)) {
      expect(cinematic[key], key).toEqual(value)
    }
  }
  expect(getGraphicsProfile(true, true)).toBe(cinematicProfile)
  expect(getGraphicsProfile(false, true)).toBe(getGraphicsProfile(false))
})
test('this page went by the fast profile as it loaded, and every profile keeps its identity', () => {
  expect(isHeavyGraphics).toBe(false)
  expect(isCinematicGraphics).toBe(false)
  expect(graphicsQuality).toBe('fast')
  expect(graphicsProfile).toBe(getGraphicsProfile(false))
  expect(getGraphicsProfile(false).postprocessing).toBe(false)
  expect(getGraphicsProfile(true)).toBe(getGraphicsProfile(true))
  expect(getGraphicsProfile(false)).toBe(getGraphicsProfile(false))
})
const profiles = {
  fast: getGraphicsProfile(false),
  heavy: getGraphicsProfile(true),
  cinematic: getGraphicsProfile(true, true),
}
const pipelines = {
  fast: getRenderPipelineSettings(profiles.fast, false),
  heavy: getRenderPipelineSettings(profiles.heavy, 'traa'),
  cinematic: getRenderPipelineSettings(profiles.cinematic, 'traa'),
}
/** the settings whose names start with `prefix`, but for those named in `except` */
const settingsOf = (settings: RenderPipelineSettings, prefix: string, ...except: Array<string>) => Object.fromEntries(Object.entries(settings).filter(([key]) => key.startsWith(prefix) && !except.includes(key)))
test('heavy and cinematic share the volumetric sunlight, but for cinematic’s finer raymarch', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(fast.volumetricLight).toBe(false)
  expect(heavy.volumetricLight).toBe(true)
  expect(settingsOf(cinematic, 'volumetricLight', 'volumetricLightSteps')).toEqual(settingsOf(heavy, 'volumetricLight', 'volumetricLightSteps'))
  expect(cinematic.volumetricLightSteps).toBeGreaterThan(heavy.volumetricLightSteps)
})
test('every profile shares the AO radius and strength, and Cinematic raises the AO quality', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(settingsOf(fast, 'ambientOcclusion')).toEqual(settingsOf(heavy, 'ambientOcclusion'))
  expect(heavy.ambientOcclusion).toBe(true)
  expect(cinematic).toMatchObject({
    ambientOcclusion: true,
    ambientOcclusionRadius: heavy.ambientOcclusionRadius,
    ambientOcclusionScale: heavy.ambientOcclusionScale,
  })
  for (const key of ['ambientOcclusionResolutionScale', 'ambientOcclusionSamples', 'ambientOcclusionThickness'] as const) {
    expect(cinematic[key], key).toBeGreaterThan(heavy[key])
  }
})
test('Heavy and Cinematic add screen-space reflections on metallic surfaces to the floor reflections', () => {
  expect(pipelines.fast).toMatchObject({
    mirrorReflections: false,
    screenSpaceReflections: false,
  })
  expect(pipelines.heavy).toMatchObject({
    mirrorReflections: true,
    screenSpaceReflections: true,
  })
  expect(pipelines.cinematic).toMatchObject({
    mirrorReflections: true,
    screenSpaceReflections: true,
  })
})
test('Cinematic alone casts contact shadows, with its own tuning', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(fast.contactShadows).toBe(false)
  expect(heavy.contactShadows).toBe(false)
  expect(cinematic.contactShadows).toBe(true)
  expect(cinematic).toMatchObject(profiles.cinematic.contactShadowTuning!)
  expect(settingsOf(cinematic, 'contactShadow')).not.toEqual(settingsOf(heavy, 'contactShadow'))
})
test('Fast leaves out bloom, which Cinematic tunes on top of Heavy’s', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(fast.bloom).toBe(false)
  expect(heavy.bloom).toBe(true)
  expect(cinematic.bloom).toBe(true)
  const tuned = Object.keys(profiles.cinematic.bloomTuning!)
  expect(cinematic).toMatchObject(profiles.cinematic.bloomTuning!)
  expect(settingsOf(cinematic, 'bloom', ...tuned)).toEqual(settingsOf(heavy, 'bloom', ...tuned))
  expect(settingsOf(cinematic, 'bloom')).not.toEqual(settingsOf(heavy, 'bloom'))
})
test('bloom blur quality controls rebuild the render pipeline', () => {
  const settings = pipelines.heavy
  const structure = getRenderPipelineStructure(settings)
  for (const key of ['bloomGaussianKernelSize', 'bloomMipCount', 'bloomResolutionScale'] as const) {
    expect(getRenderPipelineStructure({
      ...settings,
      [key]: settings[key] + 1,
    }), key).not.toEqual(structure)
  }
})
test('no graphics mode traces voxel indirect light, which the world tuning switches on with one bounce, or two in Cinematic', () => {
  const {fast, heavy, cinematic} = pipelines
  for (const settings of [fast, heavy, cinematic]) {
    expect(settings.voxelIndirectLight).toBe(false)
    expect(settingsOf(settings, 'voxelIndirectLight', 'voxelIndirectLightBounces')).toEqual(settingsOf(heavy, 'voxelIndirectLight', 'voxelIndirectLightBounces'))
  }
  expect(heavy.voxelIndirectLightBounces).toBe(1)
  expect(cinematic.voxelIndirectLightBounces).toBe(2)
})
test('the sun’s shadows follow each profile’s map, radius and samples, Cinematic’s finer than Heavy’s', () => {
  for (const name of ['fast', 'heavy', 'cinematic'] as const) {
    const sun = getSunShadowSettings(profiles[name], 4096)
    expect(pipelines[name]).toMatchObject({
      sunShadowMapSize: sun.mapSize,
      sunShadowRadius: sun.radius,
      sunShadowSamples: sun.samples,
    })
  }
  const heavy = getSunShadowSettings(profiles.heavy, 4096)
  const cinematic = getSunShadowSettings(profiles.cinematic, 4096)
  for (const key of ['mapSize', 'radius', 'samples'] as const) {
    expect(cinematic[key], key).toBeGreaterThan(heavy[key])
  }
  // A profile without a map size of its own keeps the one it’s given.
  expect(getSunShadowSettings(profiles.heavy, 2048).mapSize).toBe(2048)
})
test('Cinematic widens the lamps’ shadow filter as far as its shadow maps grow, with more samples', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(cinematic.lampShadowRadius / heavy.lampShadowRadius).toBe(profiles.cinematic.shadowMapScale / profiles.heavy.shadowMapScale)
  expect(heavy.lampShadowRadius).toBeGreaterThan(fast.lampShadowRadius)
  expect(cinematic.lampShadowSamples).toBeGreaterThan(heavy.lampShadowSamples)
})
test('Cinematic alone lights indirectly in screen space, with its own tuning', () => {
  const {fast, heavy, cinematic} = pipelines
  expect(fast.screenSpaceIndirectLight).toBe(false)
  expect(heavy.screenSpaceIndirectLight).toBe(false)
  expect(cinematic.screenSpaceIndirectLight).toBe(true)
  expect(cinematic).toMatchObject(profiles.cinematic.ssgi!)
  expect(settingsOf(cinematic, 'screenSpaceIndirectLight')).not.toEqual(settingsOf(heavy, 'screenSpaceIndirectLight'))
})
test('canvas texture resolutions stay within the texture size limit', () => {
  expect(fitCanvasTextureResolution(2, 1024, 246)).toBe(2)
  expect(fitCanvasTextureResolution(2, 7200, 3840) * 7200).toBe(8192)
  expect(fitCanvasTextureResolution(0.5, 7200, 3840)).toBe(0.5)
})
