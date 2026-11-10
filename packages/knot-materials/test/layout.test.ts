import {expect, test} from 'bun:test'

import KnotLayout from '../src/KnotLayout.ts'

test('room width follows the longest displayed row and depth follows candidate count', () => {
  const one = new KnotLayout([1, 1])
  const eight = new KnotLayout([8])
  const nine = new KnotLayout([8, 1, 3, 8, 17, 1, 8, 8, 8])
  expect(eight.size[0] - one.size[0]).toBe(7 * one.itemSpacing)
  expect(nine.size[0] - eight.size[0]).toBe(9 * one.itemSpacing)
  expect(nine.size[2] - eight.size[2]).toBe(8 * one.rowSpacing)
  expect(one.maxRowLength).toBe(1)
  expect(eight.maxRowLength).toBe(8)
  expect(nine.maxRowLength).toBe(17)
  expect(nine.size).toEqual([69.25, 5.8, 55])
  for (const layout of [eight, nine, new KnotLayout([])]) {
    expect(layout.previewX).toBeGreaterThan(layout.bounds.minX)
  }
  for (const layout of [one, eight, nine, new KnotLayout([])]) {
    expect(layout.rowHalfWidth).toBeLessThan(layout.bounds.maxX)
    expect(layout.center[0]).toBe((layout.bounds.minX + layout.bounds.maxX) / 2)
    expect(layout.center[2]).toBe((layout.bounds.northZ + layout.bounds.southZ) / 2)
  }
})
test('rejects invalid row sizes and left-aligns sparse rows', () => {
  for (const count of [0, -1, 0.5, Infinity, Number.NaN]) {
    expect(() => new KnotLayout([count])).toThrow()
  }
  const layout = new KnotLayout([1, 17])
  expect(layout.rowCenterX(1)).toBe(-layout.rowHalfWidth)
  expect(layout.rowCenterX(17)).toBe(0)
  expect(layout.slotX(0)).toBe(-layout.rowHalfWidth)
  expect(layout.slotX(16)).toBe(layout.rowHalfWidth)
  expect(() => layout.slotX(17)).toThrow(RangeError)
})
test('a lone Knot gets a square room centered on it, without billboard', () => {
  const layout = new KnotLayout([1])
  expect(layout.billboard).toBe(false)
  expect(layout.previewX).toBeNull()
  const {minX, maxX, northZ, southZ} = layout.bounds
  expect(maxX - minX).toBe(southZ - northZ)
  expect(layout.size[0]).toBe(layout.size[2])
  expect(layout.center).toEqual([layout.slotX(0), 0, layout.rowZ(0)])
  // the candidate sign hangs between the Knot and the north wall, facing the Knot and the spawn south of it
  expect(layout.candidateSign.x).toBe(layout.slotX(0))
  expect(layout.candidateSign.rotation).toBe(0)
  const signZ = layout.rowZ(0) + layout.candidateSign.z
  expect(signZ).toBeLessThan(layout.rowZ(0) - 1.5)
  expect(signZ).toBeGreaterThan(northZ + 1.5)
})
test('rows with several Knots, or several rows of one, keep their billboards', () => {
  for (const rowLengths of [[2], [1, 1], [3, 1], [1, 5]]) {
    const layout = new KnotLayout(rowLengths)
    expect(layout.billboard).toBe(true)
    expect(layout.previewX).toBe(-layout.rowHalfWidth - 6.25)
    expect(layout.candidateSign).toEqual({
      x: layout.previewX!,
      z: 0,
      rotation: Math.PI / 2,
    })
  }
})
