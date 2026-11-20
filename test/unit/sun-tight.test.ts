import {expect, test} from 'bun:test'

import {Box3, Sphere, Vector3} from 'three/webgpu'

import {moonfallSculpture} from '../../src/lib/gallery/moonfall/sculpture.ts'
import {sunTightSpaces} from '../../src/lib/gallery/sun.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

test('a sun-tight room’s space starts at its floor and keeps clear of its walls and ceiling', () => {
  const air = new Box3(new Vector3(-10, -3, -5), new Vector3(10, 6, 5))
  const [space, ...rest] = sunTightSpaces([
    {
      air: [air],
      floorY: 0,
      sunTight: true,
    },
    {
      air: [air.clone().translate(new Vector3(50, 0, 0))],
      floorY: 0,
      sunTight: false,
    },
  ])
  expect(rest).toEqual([])
  for (const [actual, expected] of [[space.min, [-9.65, 0, -4.65]], [space.max, [9.65, 5.65, 4.65]]] as const) {
    for (const [index, value] of actual.toArray().entries()) {
      expect(value).toBeCloseTo(expected[index], 9)
    }
  }
  // The room’s own air stays as it was.
  expect(air.min.toArray()).toEqual([-10, -3, -5])
})
test('Moonfall’s meteorite turns inside the gallery’s only sun-tight space', () => {
  const spaces = sunTightSpaces(slopGallery.rooms)
  expect(slopGallery.rooms.filter(room => room.sunTight).map(room => room.id)).toEqual(['moonfall'])
  expect(spaces).toHaveLength(1)
  // The meteorite’s bumps reach out to 0.91 m from its middle.
  const meteorite = new Sphere(new Vector3(...slopGallery.room('moonfall').toWorld(moonfallSculpture.center)), moonfallSculpture.coreRadius * 1.5)
  const bounds = meteorite.getBoundingBox(new Box3)
  expect(spaces[0].containsBox(bounds)).toBe(true)
})
