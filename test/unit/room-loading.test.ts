import {expect, test} from 'bun:test'

import {clearRooms, endRoom, expectRooms, pendingRooms, startRoom, usePhysicsHold} from '../../src/lib/gallery/roomLoading.ts'

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
  clearRooms()
  expect(held()).toBe(true)
  endRoom('salon')
  endRoom('oculus')
  expect(held()).toBe(false)
  expectRooms([])
  expect(held()).toBe(false)
})
test('a narrowed startup scope holds physics only for rooms actually requested, including the Lobby', () => {
  expectRooms(['lobby'])
  startRoom('lobby')
  expect(held()).toBe(true)
  endRoom('lobby')
  expect(held()).toBe(false)
  clearRooms()
  expect(held()).toBe(true)
  startRoom('lobby')
  endRoom('lobby', true)
  expect(held()).toBe(false)
  expectRooms([])
})
