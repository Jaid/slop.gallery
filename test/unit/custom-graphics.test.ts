import {expect, test} from 'bun:test'

import {getAntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'
import {defaultFov, fovKeys, fovLimits, getDefaultCustomGraphics, getTunedGraphics, stepFov, toggleGraphicsTuning, useCustomGraphics, useGraphicsTuning} from '../../src/lib/rendering/customGraphics.ts'
import {getGraphicsProfile} from '../../src/lib/rendering/graphicsMode.ts'
import {getRenderPipelineSettings} from '../../src/lib/rendering/renderPipelineSettings.ts'

test('the tuning panel starts from the pipeline of the page’s heavy graphics', () => {
  expect(getDefaultCustomGraphics()).toMatchObject(getRenderPipelineSettings(getGraphicsProfile(true), getAntiAliasing(true)))
})
test('the pipeline keeps the panel’s values after hiding it', () => {
  const defaults = getDefaultCustomGraphics()
  expect(getTunedGraphics()).toEqual(defaults)
  toggleGraphicsTuning()
  expect(useGraphicsTuning.getState().open).toBe(true)
  useCustomGraphics.setState({vignette: 0.5})
  expect(getTunedGraphics().vignette).toBe(0.5)
  toggleGraphicsTuning()
  expect(useGraphicsTuning.getState().open).toBe(false)
  expect(getTunedGraphics().vignette).toBe(0.5)
  useCustomGraphics.setState(defaults, true)
})
test('Numpad + and − narrow and widen the field of view by 5°, within the panel’s limits', () => {
  const defaults = getDefaultCustomGraphics()
  expect(fovKeys.NumpadAdd).toBe(-1)
  expect(fovKeys.NumpadSubtract).toBe(1)
  expect(defaults.fov).toBe(defaultFov)
  expect(stepFov(1)).toBe(defaultFov + 5)
  expect(getTunedGraphics().fov).toBe(defaultFov + 5)
  expect(stepFov(-1)).toBe(defaultFov)
  expect(stepFov(-1)).toBe(defaultFov - 5)
  useCustomGraphics.setState({fov: fovLimits[1] - 2})
  expect(stepFov(1)).toBe(fovLimits[1])
  expect(stepFov(1)).toBe(fovLimits[1])
  useCustomGraphics.setState({fov: fovLimits[0] + 2})
  expect(stepFov(-1)).toBe(fovLimits[0])
  expect(stepFov(-1)).toBe(fovLimits[0])
  useCustomGraphics.setState(defaults, true)
})
test('a field of view beyond the panel’s limits only steps back toward them', () => {
  const defaults = getDefaultCustomGraphics()
  useCustomGraphics.setState({fov: 2})
  expect(stepFov(-1)).toBe(2)
  expect(stepFov(1)).toBe(7)
  expect(stepFov(1)).toBe(12)
  useCustomGraphics.setState({fov: 150})
  expect(stepFov(1)).toBe(150)
  expect(stepFov(-1)).toBe(145)
  useCustomGraphics.setState(defaults, true)
})
