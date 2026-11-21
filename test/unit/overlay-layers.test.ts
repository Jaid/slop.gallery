import {expect, test} from 'bun:test'

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
