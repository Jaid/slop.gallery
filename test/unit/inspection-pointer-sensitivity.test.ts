import {expect, test} from 'bun:test'

import inspectionPointerSensitivity from '../../src/lib/camera/inspectionPointerSensitivity.ts'

test('inspection pointer modifiers slow the look down for precision and speed it up otherwise, precision winning over both', () => {
  const base = 0.002
  const precise = inspectionPointerSensitivity(base, true, false)
  const accelerated = inspectionPointerSensitivity(base, false, true)
  expect(inspectionPointerSensitivity(base, false, false)).toBe(base)
  expect(precise).toBeGreaterThan(0)
  expect(precise).toBeLessThan(base)
  expect(accelerated).toBeGreaterThan(base)
  expect(inspectionPointerSensitivity(base, true, true)).toBe(precise)
})
