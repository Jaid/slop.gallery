import type {InterleavedBufferAttribute} from 'three/webgpu'

import {expect, test} from 'bun:test'

import LiveSegmentsGeometry from '../../src/lib/overlay/LiveSegmentsGeometry.ts'
import WorldOverlay from '../../src/lib/overlay/WorldOverlay.ts'

test('moving and clearing drawings respects ownership and invalidates old handles', () => {
  const overlay = new WorldOverlay
  const layer = overlay.addLayer({id: 'notes'})
  expect(overlay.hasDrawings()).toBe(false)
  expect(() => overlay.addLayer({id: layer})).toThrow('already exists')
  const implicit = overlay.addPoint([0, 0, 0])
  const moved = overlay.addCircle([0, 1, 0], 1, {color: 'lime'})
  moved.setStyle({layer})
  overlay.addLine([0, 0, 0], [0, 1, 1], {layer})
  expect(() => moved.setStyle({layer: ' '})).toThrow('nonblank id')
  expect(overlay.clearLayer(layer)).toBe(2)
  moved.setStyle({layer: 'default'})
  moved.remove()
  expect(overlay.clearLayer(layer)).toBe(0)
  overlay.addPoint([0, 0, 0], {layer})
  expect(overlay.clearDrawings()).toBe(2)
  expect(overlay.hasDrawings()).toBe(false)
  implicit.remove()
  expect(overlay.clearDrawings()).toBe(0)
})
test('drawing on a new layer registers it and subsequent drawings reuse it', () => {
  const overlay = new WorldOverlay
  const point = overlay.addPoint([0, 0, 0], {layer: 'pins'})
  expect(() => overlay.addLayer({id: 'pins'})).toThrow('already exists')
  point.setStyle({layer: 'measurements'})
  overlay.addLine([0, 0, 0], [0, 1, 0], {layer: 'measurements'})
  expect(overlay.clearLayer('pins')).toBe(0)
  expect(overlay.clearLayer('measurements')).toBe(2)
  expect(() => overlay.clearLayer('unused')).toThrow('Unknown overlay layer')
})
test('live strokes move retained endpoint blocks when a preceding block changes size and release their producer only on removal', () => {
  const a = new Float32Array([0, 0, 0, 1, 1, 1])
  const b = new Float32Array([2, 2, 2, 3, 3, 3])
  let blocks = [a]
  let disposed = 0
  const geometry = new LiveSegmentsGeometry({
    read: () => blocks,
    dispose: () => disposed++,
  })
  const drawn = () => {
    geometry.update()
    const {data} = geometry.getAttribute('instanceStart') as InterleavedBufferAttribute
    return [...data.array.subarray(0, geometry.instanceCount * 6)]
  }
  expect(drawn()).toEqual([...a])
  blocks = [a, b]
  expect(drawn()).toEqual([...a, ...b])
  blocks = [new Float32Array(0), b]
  expect(drawn()).toEqual([...b])
  expect(disposed).toBe(0)
  geometry.dispose()
  expect(disposed).toBe(1)
})
