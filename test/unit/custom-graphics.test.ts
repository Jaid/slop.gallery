import {expect, test} from 'bun:test'

import {getAntiAliasing} from '../../src/lib/rendering/antiAliasing.ts'
import {getDefaultCustomGraphics, getTunedGraphics, toggleGraphicsTuning, useCustomGraphics, useGraphicsTuning} from '../../src/lib/rendering/customGraphics.ts'
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
