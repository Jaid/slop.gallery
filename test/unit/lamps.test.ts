import type Passage from '../../src/lib/gallery/passages/Passage.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {PlacedLamp} from '../../src/worlds/base/PlacedRoom.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/SlopGallery.ts'
import type {BufferGeometry} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {bastionCurve, bastionGateLantern} from '../../src/lib/gallery/bastion.ts'
import {corridorLandingLantern, corridorPassage} from '../../src/lib/gallery/corridor.ts'
import {lobbyChandeliers} from '../../src/lib/gallery/lobbyVault.ts'
import {lodgeWindowRibCutouts} from '../../src/lib/gallery/lodge.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import TimberGeometry from '../../src/lib/gallery/passages/TimberGeometry.ts'
import {corridorLightSpacing, passagePendantMounts, routePendantMounts} from '../../src/lib/gallery/pendants/mounts.ts'
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
/** The lights of a passage’s kept lanterns in world meters, hung like the fixtures that carry them: the mounts the lantern bodies hang from, by index, each light lowered by its drop. */
const lanterns = (passage: Passage, surfaces: ReadonlyArray<BufferGeometry>, kept: ReadonlyArray<readonly [index: number, drop: number]>, spacing?: number, ribs?: BufferGeometry) => {
  const mounts = passagePendantMounts(passage, surfaces, spacing, ribs)
  return kept.map(([index, drop]): Vec3 => [mounts[index].light[0], mounts[index].light[1] + drop, mounts[index].light[2]])
}
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
  expect(slopGallery.lampRooms(lamp('exhibition-tunnel_red')).toSorted()).toEqual(['exhibition', 'moonfall', 'oculus'])
  expect(slopGallery.lampRooms(lamp('exhibition-west_stairway_door')).toSorted()).toEqual(['exhibition', 'lobby', 'oculus'])
  // The lantern behind the apse’s gate lights the platform through the gate and both windows beside it.
  expect(slopGallery.lampRooms(lamp('bastion-lantern_north')).toSorted()).toEqual(['bastion', 'lodge', 'oculus'])
  expect(slopGallery.lampRooms(lamp('corridor-lantern_landing')).toSorted()).toEqual(['corridor', 'sienna'])
  expect(slopGallery.lampRooms(lamp('sienna-chandelier')).toSorted()).toEqual(['corridor', 'lobby', 'sienna', 'vesper'])
  // The approach’s last lantern hangs right before the arch of the Forge’s vestibule and lights it too.
  expect(slopGallery.lampRooms(lamp('bastion-lantern_strip')).toSorted()).toEqual(['bastion', 'forge'])
})
test('the passages’ lamps hang under the lanterns the fixtures hang from their vaults and ribs', () => {
  const vault = new RouteVaultGeometry(bastionCurve)
  const timber = TimberGeometry.passage(corridorPassage, lodgeWindowRibCutouts)
  try {
    const [{light}] = routePendantMounts(bastionCurve, [vault.shell, vault.ribs], [bastionGateLantern])
    expectNear(lamp('bastion-lantern_north').position, [light[0], light[1] - 0.6, light[2]])
    const [doorway, north, middle, south] = lanterns(corridorPassage, [timber.shell, timber.ribs], [[0, -0.3], [3, -0.3], [5, -0.4], [8, -0.4]], corridorLightSpacing, timber.ribs)
    expectNear(lamp('corridor-lantern_lodge').position, doorway)
    expectNear(lamp('corridor-lantern_north').position, north)
    expectNear(lamp('corridor-lantern_middle').position, middle)
    expectNear(lamp('corridor-lantern_south').position, south)
    const [x, y, z] = corridorLandingLantern.light
    expectNear(lamp('corridor-lantern_landing').position, [x, y - 0.3, z])
  } finally {
    vault.dispose()
    timber.dispose()
  }
})
test('the Lobby’s lamps hang under its chandeliers', () => {
  const lobby = slopGallery.room('lobby')
  const chandeliers = ['north', 'middle', 'south'].map(name => lamp(`lobby-chandelier_${name}`))
  expect(chandeliers.map(({position}) => position[2] - lobby.origin[2])).toEqual([...lobbyChandeliers.offsets])
  expect(chandeliers.every(({position}) => position[1] === lobbyChandeliers.lightY)).toBe(true)
})
test('only Moonfall’s spotlight is a spot, and it casts a real shadow', () => {
  const spots = lamps.filter((value): value is Extract<PlacedLamp, {kind: 'spot'}> => value.kind === 'spot')
  expect(spots.map(({id}) => id)).toEqual(['moonfall-spotlight'])
  expect(spots[0].shadow).toBe(true)
})
