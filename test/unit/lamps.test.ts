import type {PendantMount} from '../../src/lib/gallery/pendants/CeilingProbe.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/SlopGallery.ts'

import {expect, test} from 'bun:test'

import {bastionCurve, bastionGateLantern} from '../../src/lib/gallery/bastion.ts'
import {corridorHallLanterns, corridorLandingLantern, corridorPassage} from '../../src/lib/gallery/corridor.ts'
import {lobbyChandeliers} from '../../src/lib/gallery/lobbyVault.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {timberRibSpacing} from '../../src/lib/gallery/passages/timberLayout.ts'
import {routePendantMounts} from '../../src/lib/gallery/pendants/mounts.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations, {visibleLamps} from '../../src/worlds/gallery/relations.ts'

const lamps = slopGallery.lamps()
const byId = new Map(lamps.map(lamp => [lamp.id, lamp]))
const lamp = (id: string) => {
  const result = byId.get(id)
  if (!result) {
    throw new Error(`The gallery has no lamp “${id}”.`)
  }
  return result
}
const expectNear = (actual: Vec3, expected: Vec3) => {
  for (const [index, value] of actual.entries()) {
    expect(value).toBeCloseTo(expected[index], 3)
  }
}
const below = ({light: [x, y, z]}: PendantMount, distance: number): Vec3 => [x, y - distance, z]
test('every lamp has a world-wide id of its own and lies in its own room', () => {
  expect(byId.size).toBe(lamps.length)
  for (const {id, position, room} of lamps) {
    expect(`${id} in ${slopGallery.roomAt(position)?.id}`).toBe(`${id} in ${room}`)
  }
})
test('the rooms only keep lamps that exist, and none of their own', () => {
  for (const room of Object.keys(relations) as Array<GalleryRoomId>) {
    for (const id of visibleLamps(room)) {
      expect(`${room} keeps ${lamp(id).room === room ? 'its own ' : ''}${id}`).toBe(`${room} keeps ${id}`)
    }
  }
})
test('a lamp shines in its own room and in the rooms that keep it', () => {
  expect(slopGallery.lampRooms(lamp('lodge-fire')).toSorted()).toEqual(['bastion', 'corridor', 'lodge'])
  expect(slopGallery.lampRooms(lamp('exhibition-tunnel_south')).toSorted()).toEqual(['exhibition', 'moonfall', 'oculus'])
  expect(slopGallery.lampRooms(lamp('exhibition-west_stairway_door')).toSorted()).toEqual(['exhibition', 'lobby', 'oculus'])
  // The lantern behind the apse’s gate lights the platform through the gate and both windows beside it.
  expect(slopGallery.lampRooms(lamp('bastion-lantern_north')).toSorted()).toEqual(['bastion', 'lodge', 'oculus'])
  expect(slopGallery.lampRooms(lamp('corridor-lantern_landing')).toSorted()).toEqual(['corridor', 'sienna'])
  expect(slopGallery.lampRooms(lamp('sienna-chandelier')).toSorted()).toEqual(['corridor', 'lobby', 'sienna', 'vesper'])
})
test('the passages’ lamps hang under the lanterns the fixtures hang from their vaults and ribs', () => {
  const vault = new RouteVaultGeometry(bastionCurve)
  try {
    const [{light}] = routePendantMounts(bastionCurve, [vault.shell, vault.ribs], [bastionGateLantern])
    expectNear(lamp('bastion-lantern_north').position, [light[0], light[1] - 0.6, light[2]])
    const [north, middle, south] = corridorHallLanterns
    expectNear(lamp('corridor-lantern_north').position, below(north, 0.3))
    expectNear(lamp('corridor-lantern_middle').position, below(middle, 0.4))
    expectNear(lamp('corridor-lantern_south').position, below(south, 0.4))
    expectNear(lamp('corridor-lantern_landing').position, below(corridorLandingLantern, 0.3))
  } finally {
    vault.dispose()
  }
})
test('the Corridor’s hall lanterns hang at both of its ends and in its middle', () => {
  const hall = corridorPassage.spans[3]
  const [north, middle, south] = corridorHallLanterns.map(({light}) => light[2] - hall.start[1])
  expect(north).toBeLessThan(hall.from + timberRibSpacing)
  expect(Math.abs(middle - hall.length / 2)).toBeLessThanOrEqual(timberRibSpacing / 2)
  expect(south).toBeGreaterThan(hall.to - timberRibSpacing)
})
test('the Lobby’s lamps hang under its chandeliers', () => {
  const lobby = slopGallery.room('lobby')
  const chandeliers = ['north', 'middle', 'south'].map(name => lamp(`lobby-chandelier_${name}`))
  expect(chandeliers.map(({position}) => position[2] - lobby.origin[2])).toEqual([...lobbyChandeliers.offsets])
  expect(chandeliers.every(({position}) => position[1] === lobbyChandeliers.lightY)).toBe(true)
})
