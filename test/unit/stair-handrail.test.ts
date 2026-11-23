import {expect, test} from 'bun:test'

import {stairHandrailBend, stairHandrailEase} from '../../src/lib/gallery/stairs/StairHandrailGeometry.ts'

test('the handrail ease is flat outside its bend and continuous through it', () => {
  expect(stairHandrailEase(stairHandrailBend)).toBe(0)
  expect(stairHandrailEase(-stairHandrailBend)).toBe(0)
  expect(stairHandrailEase(0)).toBeGreaterThan(0)
  expect(stairHandrailEase(stairHandrailBend / 2)).toBeGreaterThan(0)
})
