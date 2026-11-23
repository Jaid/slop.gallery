import {expect, test} from 'bun:test'

import staircase, {galleryStairs, moonfallStairs, stairRoofs} from '../../src/lib/gallery/staircase.ts'
import walls, {insideGallery, roomAt} from './fixtures/gallery.ts'

test('the Moonfall flight runs east from the landing into the hall and the gallery flight runs east up from the wing', () => {
  expect(moonfallStairs.start[2]).toBe(moonfallStairs.end[2])
  expect(moonfallStairs.end[0]).toBeGreaterThan(moonfallStairs.start[0])
  expect(moonfallStairs.end[1]).toBeLessThan(moonfallStairs.start[1])
  expect(galleryStairs.start[2]).toBe(galleryStairs.end[2])
  expect(galleryStairs.start[0]).toBeGreaterThan(galleryStairs.end[0])
  expect(galleryStairs.start[1]).toBeGreaterThan(galleryStairs.end[1])
  expect(moonfallStairs.width).toBe(staircase.width)
  expect(galleryStairs.width).toBe(staircase.galleryWidth)
  expect(insideGallery([moonfallStairs.start[0] + 0.3, 1.2, moonfallStairs.start[2]])).toBe(true)
  expect(roomAt([moonfallStairs.start[0] + 0.3, 1.2, moonfallStairs.start[2]])).toBe('moonfall')
  expect(roomAt([galleryStairs.start[0] - 0.3, galleryStairs.start[1] + 1.2, galleryStairs.start[2]])).toBe('antechamber')
})
test('both flights have side walls and roofs as wide as their steps', () => {
  for (const flight of [moonfallStairs, galleryStairs]) {
    for (const side of [-1, 1]) {
      expect(walls.some(wall => wall.id === flight.wall(side).id)).toBe(true)
    }
  }
  expect(stairRoofs[0].size[2]).toBe(staircase.width)
  expect(stairRoofs[1].size[2]).toBe(staircase.galleryWidth)
  expect(walls.find(wall => wall.id === 'antechamber-landing_east')!.holes![0].width).toBe(staircase.width)
})
