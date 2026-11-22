import {expect, test} from 'bun:test'

import {closestRatio, imageModelRatios, ratioAspect, requestedRatio} from '../../src/lib/ai/imageRatios.ts'
import {readAiSettings} from '../../src/lib/ai/settings.ts'

test('the default image model has known ratios', () => {
  expect(Object.hasOwn(imageModelRatios, readAiSettings().image_model)).toBe(true)
})
test('every model can be asked for the shapes of the portrait slots', () => {
  for (const ratios of Object.values(imageModelRatios)) {
    for (const ratio of ['1:1', '2:3', '3:2', '9:16', '16:9'] as const) {
      expect(ratios).toContain(ratio)
    }
  }
})
test('ratios read as width divided by height', () => {
  expect(ratioAspect('16:9')).toBe(16 / 9)
  expect(ratioAspect('9:19.5')).toBe(9 / 19.5)
})
test('the closest ratio is closest on a logarithmic scale', () => {
  // 1:2 and 2:1 are equally far from 1:1, so the first one listed wins a tie.
  expect(closestRatio(1, ['1:2', '2:1'])).toBe('1:2')
  expect(closestRatio(1, ['2:1', '1:2'])).toBe('2:1')
  expect(closestRatio(1.25, ['1:1', '5:4', '4:3'])).toBe('5:4')
  // 1.235 is a little closer to 1:1 than to 3:2 by difference, but not by factor.
  expect(closestRatio(1.235, ['1:1', '3:2'])).toBe('3:2')
  expect(closestRatio(1, [])).toBeUndefined()
})
test('a known model is asked for its supported ratio closest to the work', () => {
  expect(requestedRatio('google/gemini-nano-banana-2.1', 1)).toBe('1:1')
  expect(requestedRatio('google/gemini-nano-banana-2.1', 0.8)).toBe('4:5')
  expect(requestedRatio('google/gemini-nano-banana-2.1', 1.5)).toBe('3:2')
  expect(requestedRatio('openai/gpt-image-2.5-sunburst', 0.8)).toBe('4:5')
  expect(requestedRatio('openai/gpt-image-2.5-sunburst', 0.5)).toBe('1:2')
  expect(requestedRatio('openai/gpt-image-2.5-sunburst', 3)).toBe('3:1')
  // Sunburst goes no wider than 3:1.
  expect(requestedRatio('openai/gpt-image-2.5-sunburst', 4)).toBe('3:1')
  expect(requestedRatio('x-ai/grok-imagine-image-2.0', 2)).toBe('2:1')
  expect(requestedRatio('x-ai/grok-imagine-image-2.0', 2.5)).toBe('5:2')
  expect(requestedRatio('x-ai/grok-imagine-image-2.0', 16 / 9)).toBe('16:9')
})
test('an unknown model or shape is asked for no ratio', () => {
  expect(requestedRatio('test-image-model', 1)).toBeUndefined()
  expect(requestedRatio('toString', 1)).toBeUndefined()
  for (const aspect of [0, -1, Number.NaN, Infinity]) {
    expect(requestedRatio('google/gemini-nano-banana-2.1', aspect)).toBeUndefined()
  }
})
