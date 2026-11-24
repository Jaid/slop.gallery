import type {PlacardSide} from '../../src/lib/gallery/portraitLabel.ts'

import {expect, test} from 'bun:test'

import {placardSide} from '../../src/lib/gallery/portraitLabel.ts'
import {galleryPlacement} from './fixtures/gallery.ts'

// A 1 m work aimed at the Lobby’s south wall, beside the door, from 8 m away.
const aim = (y: number, placard: PlacardSide) => galleryPlacement.findPlacement([-4.6, y, 1], [0, 0, 1], 1, 1, [], {placard})
test('a placard that blocks a low spot moves above the frame', () => {
  const placement = aim(1.2, 'below')
  expect(placement?.valid).toBe(true)
  expect(placement?.placard).toBe('above')
})
test('a placard above stays there wherever it fits', () => {
  expect(aim(2.7, 'above')?.placard).toBe('above')
  expect(aim(2.7, 'below')?.placard).toBe('below')
})
test('a placard that blocks a high spot above the frame moves back below it', () => {
  const placement = aim(4.2, 'above')
  expect(placement?.valid).toBe(true)
  expect(placement?.placard).toBe('below')
})
test('a spot the frame itself does not fit stays invalid on either side', () => {
  const placement = aim(0.5, 'below')
  expect(placement?.valid).toBe(false)
  expect(placement?.placard).toBe('below')
})
test('a work that never gets a placard gets none wherever it is aimed', () => {
  expect(aim(1.2, 'none')).toMatchObject({
    valid: true,
    placard: 'none',
  })
  expect(aim(0.5, 'none')).toMatchObject({
    valid: false,
    placard: 'none',
  })
})
test('only a work with nothing told about it on a page that never writes placards goes without one', () => {
  expect(placardSide({}, true)).toBe('below')
  expect(placardSide({labelAbove: true}, true)).toBe('above')
  expect(placardSide({}, false)).toBe('none')
  expect(placardSide({labelAbove: true}, false)).toBe('none')
  expect(placardSide({title: ''}, false)).toBe('none')
  expect(placardSide({title: 'Untitled'}, false)).toBe('below')
  expect(placardSide({
    creator: 'Jane Doe',
    labelAbove: true,
  }, false)).toBe('above')
  expect(placardSide({pending: true}, false)).toBe('below')
})
