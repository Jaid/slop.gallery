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
  expect(() => moved.setStyle({layer: 'typo'})).toThrow('Unknown overlay layer')
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
