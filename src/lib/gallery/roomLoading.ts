import type {GalleryRoomId as RoomId} from '#src/worlds/gallery/index.ts'

import {create} from 'zustand'

import {trackLoadingItems} from '#src/lib/loadingItems.ts'

/** the rooms the world asked for whose parts haven’t mounted yet */
const pending = new Set<RoomId>
/** the rooms the world loads later, see {@link expectRooms} */
let expected: ReadonlyArray<RoomId> = []
/** the expected rooms that have neither mounted nor failed yet */
const unsettled = new Set<RoomId>
let mounted = 0
/** the rooms that have mounted, in that order, until the world unmounts */
const mountedIds = new Set<RoomId>
trackLoadingItems(() => [...pending].map(room => `room:${room}`))

/**
 * Whether the physics waits for rooms that haven’t mounted yet. Each room brings the colliders of its own floors and plinths, so without them, the player starting in that room, loose portraits there and the Oculus props would fall through.
 * The physics must read it inside the Canvas, like `GamePhysics` does, since props from outside of it reach the scene late.
 */
export const usePhysicsHold = create<{held: boolean}>(() => ({held: false}))

/** how many rooms the world asked for are still loading or waiting to mount; the loading screen waits for none to be left */
export const pendingRooms = () => pending.size

/** how many rooms have mounted so far, which grows whenever the world gains a room’s geometry */
export const mountedRooms = () => mounted

/** The ids of the rooms that have mounted so far, in that order. */
export const mountedRoomIds = (): ReadonlyArray<RoomId> => [...mountedIds]

/** Holds the physics until each of these rooms has mounted or failed to load. */
export function expectRooms(rooms: ReadonlyArray<RoomId>) {
  expected = rooms
  unsettled.clear()
  for (const room of rooms) {
    unsettled.add(room)
  }
  usePhysicsHold.setState({held: unsettled.size > 0})
}

/** Lists the room as loading until {@link endRoom} ends it. */
export function startRoom(room: RoomId) {
  pending.add(room)
}

/** Ends the room’s loading, counting it as mounted unless it failed. */
export function endRoom(room: RoomId, failed = false) {
  if (pending.delete(room) && !failed) {
    mounted++
    mountedIds.add(room)
  }
  if (unsettled.delete(room) && unsettled.size === 0) {
    usePhysicsHold.setState({held: false})
  }
}

/** Forgets every room still loading once the world unmounts, and holds the physics again for a world that mounts anew. */
export function clearRooms() {
  pending.clear()
  mountedIds.clear()
  expectRooms(expected)
}
