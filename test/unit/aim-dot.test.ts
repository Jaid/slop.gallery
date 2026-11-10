import {afterEach, expect, test} from 'bun:test'

import aimDot from '../../src/lib/aimDot.ts'
import {cameraPose, setCameraFocused} from '../../src/lib/gallery/actions.ts'

afterEach(() => {
  setCameraFocused(false)
  aimDot.setBlocked('zoom', false)
})
test('camera focus suppresses the aim dot for the full viewing lifecycle', () => {
  setCameraFocused(true)
  expect(cameraPose.focused).toBe(true)
  expect(aimDot.getSnapshot()).toBe(false)
  setCameraFocused(false)
  expect(cameraPose.focused).toBe(false)
  expect(aimDot.getSnapshot()).toBe(true)
})
