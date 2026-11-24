import {afterEach, expect, test} from 'bun:test'

import readQueryOverrides from '../../src/lib/queryOverrides.ts'
import {getAntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'
import {defaultFov, fovKeys, fovLimits} from '../../src/lib/rendering/fov.ts'
import {getGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings} from '../../src/lib/rendering/renderPipelineSettings.ts'
import {dumpWorldTuning, setWorldTuning} from '../../src/lib/webmcp/worldTuning.ts'
import {lastTuningSource} from '../../src/lib/worldTuning/base/TuningModule.ts'
import worldTuning from '../../src/lib/worldTuning/index.ts'
import {lightingTuning} from '../../src/lib/worldTuning/LightingTuningModule.ts'
import {toggleWorldTuning, useWorldTuningPanel} from '../../src/lib/worldTuning/panel.ts'
import {pipelineTuning} from '../../src/lib/worldTuning/PipelineTuningModule.ts'
import {viewTuning} from '../../src/lib/worldTuning/ViewTuningModule.ts'
import {readWorldTuning} from '../../src/lib/worldTuning/worldTuningParameter.ts'

afterEach(() => {
  worldTuning.reset()
})
test('the gallery is tuned by its view, its lighting, its render pipeline and its overlay, in that order', () => {
  expect(worldTuning.modules.map(module => module.id)).toEqual(['view', 'lighting', 'pipeline', 'overlay'])
  expect(lightingTuning.available).toBe(true)
})
test('the render pipeline starts from the pipeline of the page’s heavy graphics, the view from the default field of view', () => {
  expect(pipelineTuning.initial).toEqual(getRenderPipelineSettings(getGraphicsProfile(true), getAntiAliasing(true)))
  expect(viewTuning.initial).toEqual({
    fov: defaultFov,
    renderScale: 1,
    toneMapping: 'aces',
  })
})
test('every value of a module has a control or a group heading, and every control one of its values', () => {
  for (const module of worldTuning.modules) {
    const keys = module.entries.keys().toArray().toSorted()
    // The gallery has the sun the sun shadow tunes.
    expect(keys).toEqual(Object.keys(module.initial).toSorted())
  }
})
test('the values stay in effect after hiding the panel', () => {
  toggleWorldTuning()
  expect(useWorldTuningPanel.getState().open).toBe(true)
  pipelineTuning.set({vignette: 0.5}, 'panel')
  expect(pipelineTuning.get().vignette).toBe(0.5)
  toggleWorldTuning()
  expect(useWorldTuningPanel.getState().open).toBe(false)
  expect(pipelineTuning.get().vignette).toBe(0.5)
  expect(worldTuning.changes()).toEqual({pipeline: {vignette: 0.5}})
})
test('Numpad + and − narrow and widen the field of view by 5°, within the world tuning’s limits', () => {
  expect(fovKeys.NumpadAdd).toBe(-1)
  expect(fovKeys.NumpadSubtract).toBe(1)
  expect(viewTuning.stepFov(1)).toBe(defaultFov + 5)
  expect(viewTuning.get().fov).toBe(defaultFov + 5)
  expect(lastTuningSource.current).toBe('key')
  expect(viewTuning.stepFov(-1)).toBe(defaultFov)
  expect(viewTuning.stepFov(-1)).toBe(defaultFov - 5)
  viewTuning.set({fov: fovLimits[1] - 2})
  expect(viewTuning.stepFov(1)).toBe(fovLimits[1])
  expect(viewTuning.stepFov(1)).toBe(fovLimits[1])
  viewTuning.set({fov: fovLimits[0] + 2})
  expect(viewTuning.stepFov(-1)).toBe(fovLimits[0])
  expect(viewTuning.stepFov(-1)).toBe(fovLimits[0])
})
test('a field of view beyond the limits only steps back toward them', () => {
  viewTuning.set({fov: 2})
  expect(viewTuning.stepFov(-1)).toBe(2)
  expect(viewTuning.stepFov(1)).toBe(7)
  expect(viewTuning.stepFov(1)).toBe(12)
  viewTuning.set({fov: 150})
  expect(viewTuning.stepFov(1)).toBe(150)
  expect(viewTuning.stepFov(-1)).toBe(145)
})
test('setting values checks all of them first, so a bad one sets none, and tells what it takes', () => {
  expect(() => worldTuning.set({
    view: {fov: 50},
    pipeline: {vignette: 7},
  })).toThrow('pipeline.vignette is a number from 0.05 to 1, or 0 for off.')
  expect(viewTuning.get().fov).toBe(defaultFov)
  expect(() => worldTuning.set({studio: {walls: 'cell'}})).toThrow('This page tunes no “studio”. Its modules: view, lighting, pipeline, overlay.')
  expect(() => worldTuning.set({view: {zoom: 2}})).toThrow('View has no value “zoom”. Its values: renderScale, fov, toneMapping.')
  expect(() => worldTuning.set({view: {toneMapping: 'filmic'}})).toThrow('view.toneMapping is one of “aces” (ACES Filmic), “agx” (AgX),')
  expect(() => worldTuning.set({pipeline: {ambientOcclusionSamples: 4.5}})).toThrow('pipeline.ambientOcclusionSamples is an integer from 4 to 64.')
  expect(() => worldTuning.set({pipeline: {bloom: 1}})).toThrow('pipeline.bloom switches its group on or off, so it is true or false.')
  expect(() => worldTuning.set({pipeline: {antiAliasing: 'fxaa'}})).toThrow('pipeline.antiAliasing is “traa” when on or false when off.')
  expect(() => worldTuning.set({pipeline: {sunShadowMapSize: 1000}})).toThrow('pipeline.sunShadowMapSize is one of 1024 (1024²), 2048 (2048²)')
  expect(worldTuning.changes()).toEqual({})
})
test('setting values reports what changed, and null brings back the start', () => {
  expect(worldTuning.set({
    view: {
      fov: 50,
      toneMapping: 'agx',
    },
    pipeline: {
      bloom: !pipelineTuning.initial.bloom,
      vignette: pipelineTuning.initial.vignette,
    },
  }, 'webmcp')).toEqual([{
    module: 'view',
    key: 'fov',
    from: defaultFov,
    to: 50,
  }, {
    module: 'view',
    key: 'toneMapping',
    from: 'aces',
    to: 'agx',
  }, {
    module: 'pipeline',
    key: 'bloom',
    from: pipelineTuning.initial.bloom,
    to: !pipelineTuning.initial.bloom,
  }])
  expect(lastTuningSource.current).toBe('webmcp')
  expect(worldTuning.set({view: {fov: null}})).toEqual([{
    module: 'view',
    key: 'fov',
    from: 50,
    to: defaultFov,
  }])
  expect(worldTuning.changes()).toEqual({
    view: {toneMapping: 'agx'},
    pipeline: {bloom: !pipelineTuning.initial.bloom},
  })
})
test('switching a value off keeps the one it had, which switching it on brings back', () => {
  worldTuning.set({pipeline: {vignette: 0.3}})
  worldTuning.set({pipeline: {vignette: 0}})
  expect(pipelineTuning.parked.getState().vignette).toBe(0.3)
  const vignette = pipelineTuning.entries.get('vignette')!.switch!
  pipelineTuning.switch(vignette, true)
  expect(pipelineTuning.get().vignette).toBe(0.3)
  pipelineTuning.switch(vignette, false)
  expect(pipelineTuning.get().vignette).toBe(0)
  // Off as the page started, but keeping another value than it started with.
  expect(pipelineTuning.isChanged('vignette')).toBe(true)
  pipelineTuning.reset(['vignette'])
  expect(pipelineTuning.isChanged('vignette')).toBe(false)
  expect(pipelineTuning.parked.getState().vignette).toBe(0.2)
})
test('the tools see every value with its control, its group and what it starts from', () => {
  worldTuning.set({view: {fov: 40}})
  const [view, lighting, pipeline] = worldTuning.describe()
  expect(view).toMatchObject({
    id: 'view',
    title: 'View',
    shown: true,
  })
  expect(view.controls.find(control => control.key === 'fov')).toEqual({
    key: 'fov',
    group: 'View',
    label: 'Field of view',
    kind: 'range',
    value: 40,
    initial: defaultFov,
    min: fovLimits[0],
    max: fovLimits[1],
    step: 1,
    unit: '°',
  })
  expect(lighting.controls.find(control => control.key === 'lampSet')).toMatchObject({
    kind: 'select',
    group: 'Lamps',
    options: [{
      value: 'all',
      label: 'All',
    }, {
      value: 'essential',
      label: 'Essential',
    }],
    off: 'none',
  })
  expect(pipeline.controls.find(control => control.key === 'antiAliasing')).toMatchObject({
    kind: 'switch',
    label: 'Temporal antialiasing',
    on: 'traa',
    off: false,
    rebuilds: true,
  })
  expect(pipeline.controls.find(control => control.key === 'vignette')).toMatchObject({
    kind: 'range',
    group: 'Finish',
    percent: true,
    off: 0,
  })
  expect(pipeline.controls.find(control => control.key === 'bloomStrength')).not.toHaveProperty('rebuilds')
  // Fast graphics have no pipeline to tune.
  expect(pipeline.shown).toBe(false)
  expect(pipeline.hint).toBe('Switch graphics on in the menu to tune the pipeline.')
})
test('?world_tuning starts the page with the panel shown, but only with ?development, which the panel needs', () => {
  expect(readWorldTuning('http://localhost/?development&world_tuning')).toBe(true)
  expect(readWorldTuning('http://localhost/?development&world_tuning=true')).toBe(true)
  expect(readWorldTuning('http://localhost/?development&world_tuning=false')).toBe(false)
  expect(readWorldTuning('http://localhost/?world_tuning')).toBe(false)
  expect(readWorldTuning('http://localhost/')).toBe(false)
  expect(readQueryOverrides('http://localhost/?development&world_tuning')).toEqual({
    development: true,
    world_tuning: true,
  })
})
test('the tools tell the world tuning of a page without ?development, but set nothing there, where it takes no effect', () => {
  expect(dumpWorldTuning()).toMatchObject({
    development: false,
    open: false,
  })
  expect(dumpWorldTuning().modules.map(module => module.id)).toEqual(['view', 'lighting', 'pipeline', 'overlay'])
  expect(() => setWorldTuning({values: {view: {fov: 50}}})).toThrow('The world tuning only takes effect on a page opened with ?development, which this one was not.')
  expect(viewTuning.get().fov).toBe(defaultFov)
})
