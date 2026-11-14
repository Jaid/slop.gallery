import '../../src/lib/rendering/nodeTime.ts'

import {afterEach, beforeEach, expect, spyOn, test} from 'bun:test'

import {NodeFrame} from 'three/webgpu'

import worldClock from '../../src/lib/worldClock.ts'

let wall = 0
let performanceNow: ReturnType<typeof spyOn<Performance, 'now'>>
beforeEach(() => {
  wall = performance.now()
  performanceNow = spyOn(performance, 'now').mockImplementation(() => wall)
})
afterEach(() => {
  performanceNow.mockRestore()
})
test('the time shaders read follows the world’s clock: it stands still while the world is frozen, however often a renderer updates it, and goes on from there', () => {
  const frame = new NodeFrame
  frame.update()
  expect(frame.time).toBe(0)
  expect(frame.deltaTime).toBe(0)
  expect(frame.frameId).toBe(1)
  wall += 250
  frame.update()
  expect(frame.time).toBeCloseTo(0.25, 9)
  expect(frame.deltaTime).toBeCloseTo(0.25, 9)
  const release = worldClock.freeze()
  try {
    // three’s own animation loop keeps updating it while nothing is drawn.
    for (let update = 0; update < 5; update++) {
      wall += 1000
      frame.update()
      expect(frame.time).toBeCloseTo(0.25, 9)
      expect(frame.deltaTime).toBe(0)
    }
    expect(frame.frameId).toBe(7)
  } finally {
    release()
  }
  frame.update()
  expect(frame.time).toBeCloseTo(0.25, 9)
  wall += 100
  frame.update()
  expect(frame.time).toBeCloseTo(0.35, 9)
  expect(frame.deltaTime).toBeCloseTo(0.1, 9)
})
test('every renderer’s frame keeps its own time, and a time set from outside is where it goes on from', () => {
  const first = new NodeFrame
  const second = new NodeFrame
  first.update()
  wall += 500
  second.update()
  expect(second.time).toBe(0)
  first.update()
  expect(first.time).toBeCloseTo(0.5, 9)
  // Offline renderers, like the studio snapshots’, set the time of the frame they draw themselves.
  second.time = 12
  wall += 20
  second.update()
  expect(second.time).toBeCloseTo(12.02, 9)
})
