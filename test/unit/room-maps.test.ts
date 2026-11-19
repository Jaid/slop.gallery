import {expect, test} from 'bun:test'

import {wallPosition} from '#src/lib/placement/wallGeometry.ts'
import {RoomMap} from '#src/rooms/index.ts'
import slopGallery from '#src/worlds/gallery/index.ts'

test('a room map renders at its viewBox and unclipped, whatever size the file gives it', () => {
  const map = new RoomMap('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="160" height="400" viewBox="-8 -20, 16 40" overflow="hidden" stroke-width="0.2"><path d="M 0 0 H 1"/></svg>\n')
  expect(map.frame).toEqual([-8, -20, 16, 40])
  const svg: Array<Record<string, string>> = []
  const paths: Array<string | null> = []
  const rewriter = new HTMLRewriter
  rewriter.on('svg', {element: element => {
    svg.push(Object.fromEntries(element.attributes))
  }}).on('svg > path', {element: element => {
    paths.push(element.getAttribute('d'))
  }}).transform(map.markup)
  expect(svg).toHaveLength(1)
  expect(svg[0].viewbox.trim().split(/[\s,]+/u).map(Number)).toEqual([...map.frame])
  expect(svg[0]).toMatchObject({
    x: '-8',
    y: '-20',
    width: '16',
    height: '40',
    overflow: 'visible',
    'stroke-width': '0.2',
  })
  expect(paths).toEqual(['M 0 0 H 1'])
  expect(map.placedFrame([10, -5])).toEqual([2, -25, 16, 40])
})
test.each([
  '<path d="M 0 0 H 1"/>',
  '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 H 1"/></svg>',
  '<svg viewBox="0 0 10"><path d="M 0 0 H 1"/></svg>',
  '<svg viewBox="0 0 0 10"><path d="M 0 0 H 1"/></svg>',
  '<svg viewBox="0 0 ten 10"><path d="M 0 0 H 1"/></svg>',
])('a room map needs a viewBox with an area: %s', svg => {
  expect(() => new RoomMap(svg)).toThrow()
})
test('ids in the gallery’s room maps start with their room’s id, as all of them share one document', () => {
  for (const room of slopGallery.rooms) {
    const markup = room.map!.markup + (room.upperMap?.map.markup ?? '')
    for (const [, id] of markup.matchAll(/\sid="([^"]*)"/gu)) {
      expect(id).toStartWith(`${room.id}-`)
    }
  }
})
test('every room of the gallery frames its walls on its map, relative to its origin', () => {
  for (const room of slopGallery.rooms) {
    expect(room.map).toBeInstanceOf(RoomMap)
    const [x, z, width, depth] = room.map!.placedFrame(room.center)
    for (const wall of room.walls()) {
      for (let step = 0; step <= 8; step++) {
        const [wallX, , wallZ] = wallPosition(wall, wall.width * (step / 8 - 0.5), 0, 0)
        expect(wallX).toBeGreaterThanOrEqual(x - 0.01)
        expect(wallX).toBeLessThanOrEqual(x + width + 0.01)
        expect(wallZ).toBeGreaterThanOrEqual(z - 0.01)
        expect(wallZ).toBeLessThanOrEqual(z + depth + 0.01)
      }
    }
  }
})
