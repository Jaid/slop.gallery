import {expect, test} from 'bun:test'

import {DetachedCanvases} from '../../src/lib/rendering/detachedCanvases.ts'

test('detached canvases are active while anyone holds one and tell only the first coming in and the last going', () => {
  const canvases = new DetachedCanvases
  let calls = 0
  canvases.subscribe(() => calls++)
  expect(canvases.active).toBe(false)
  const releaseFirst = canvases.hold()
  const releaseSecond = canvases.hold()
  expect(canvases.getSnapshot()).toBe(true)
  expect(calls).toBe(1)
  releaseFirst()
  releaseFirst()
  expect(canvases.active).toBe(true)
  expect(calls).toBe(1)
  releaseSecond()
  expect(canvases.active).toBe(false)
  expect(calls).toBe(2)
})
