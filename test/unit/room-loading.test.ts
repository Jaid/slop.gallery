import {expect, test} from 'bun:test'

import {clearRooms, endRoom, expectRooms, mountedRoomIds, pendingRooms, startRoom, usePhysicsHold} from '../../src/lib/gallery/roomLoading.ts'

const held = () => usePhysicsHold.getState().held
test('the physics waits until every expected room has mounted or failed, and again for a world that mounts anew', () => {
  expectRooms(['salon', 'oculus'])
  expect(held()).toBe(true)
  startRoom('salon')
  startRoom('oculus')
  endRoom('salon')
  expect(held()).toBe(true)
  endRoom('oculus', true)
  expect(held()).toBe(false)
  expect(pendingRooms()).toBe(0)
  // A room that failed to load never mounted.
  expect(mountedRoomIds()).toEqual(['salon'])
  clearRooms()
  expect(mountedRoomIds()).toEqual([])
  expect(held()).toBe(true)
  endRoom('salon')
  endRoom('oculus')
  expect(held()).toBe(false)
  expectRooms([])
  expect(held()).toBe(false)
})
