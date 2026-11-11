import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'
import type {Object3D} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {Box3, Frustum, Group, Matrix4, Mesh, PerspectiveCamera, Vector3} from 'three/webgpu'

import lobbyLayout from '../../src/lib/gallery/lobby.ts'
import {ownerRoom, portals, roomContaining, roomsAt, screenRect, updatePickupRoom, visibleRegions, visibleRooms} from '../../src/lib/gallery/roomVisibility.ts'
import {openingTop, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import relations, {openings} from '../../src/worlds/gallery/relations.ts'
import {rooms} from './fixtures/gallery.ts'

const viewProjection = (position: Vec3, target: Vec3) => {
  const camera = new PerspectiveCamera(62, 16 / 9, 0.05, 90)
  camera.position.set(...position)
  camera.lookAt(...target)
  camera.updateMatrixWorld()
  const matrix = new Matrix4
  return matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
}
const view = (position: Vec3, target: Vec3) => {
  const frustum = new Frustum
  return frustum.setFromProjectionMatrix(viewProjection(position, target))
}
test('every room contains its own center', () => {
  for (const room of rooms) {
    expect(roomContaining([room.center[0], room.floorY + 1.6, room.center[1]])).toBe(room.id)
  }
})
test('every room is reachable through its portals', () => {
  const linked = new Set(portals.flatMap(portal => portal.rooms))
  expect(rooms.filter(room => !linked.has(room.id))).toEqual([])
})
test('the rooms only relate rooms they can reach through up to three openings', () => {
  const neighbours = new Map<string, Set<string>>
  for (const {rooms: pair} of portals) {
    for (const [from, to] of [pair, [pair[1], pair[0]]] as const) {
      neighbours.set(from, (neighbours.get(from) ?? new Set).add(to))
    }
  }
  const withinThree = (start: string) => {
    const seen = new Set([start])
    let frontier = [start]
    for (let depth = 0; depth < 3; depth++) {
      frontier = frontier.flatMap(room => [...neighbours.get(room) ?? []]).filter(room => !seen.has(room) && seen.add(room))
    }
    return seen
  }
  for (const [room, {rooms: related}] of Object.entries(relations)) {
    const reachable = withinThree(room)
    for (const other of related) {
      expect(`${room} relates ${reachable.has(other) ? '' : 'unreachable '}${other}`).toBe(`${room} relates ${other}`)
    }
  }
  // The Forge’s doorway leads into the Bastion and its glass wall looks into the Lobby, which both relate it first, and it them.
  expect(relations.forge.rooms.slice(0, 2).toSorted()).toEqual(['bastion', 'lobby'])
  expect(relations.bastion.rooms).toContain('forge' as never)
  expect(relations.lobby.rooms).toContain('forge' as never)
  // Moonfall’s stairway is visible through the Antechamber from the Lobby.
  expect(relations.lobby.rooms).toContain('moonfall' as never)
})
test('a room shows the rooms behind the openings in view', () => {
  // From the Vesper through both side doors of the Lobby into the Banquet, through the Lobby’s glass wall into the Salon and through the Antechamber down the stairway to Moonfall, but no further.
  const vesper = visibleRooms('vesper', view([-14, 1.6, 3], [14, 1.6, 3]))
  expect(['banquet', 'salon', 'moonfall'].filter(room => vesper.has(room as never))).toEqual(['banquet', 'salon', 'moonfall'])
  expect(['exhibition', 'lodge', 'corridor'].filter(room => vesper.has(room as never))).toEqual([])
  // The Salon’s glass wall shows the Lobby extension, and the Lobby’s shows the Salon.
  expect(visibleRooms('salon', view([16, 1.6, -20], [0, 1.6, -20])).has('lobby')).toBe(true)
  expect(visibleRooms('lobby', view([0, 1.6, -28], [8, 1.6, -24])).has('salon')).toBe(true)
  // And so do the Forge’s and the Lobby’s across from them.
  expect(visibleRooms('forge', view([-16, 1.6, -20], [0, 1.6, -20])).has('lobby')).toBe(true)
  expect(visibleRooms('lobby', view([0, 1.6, -28], [-8, 1.6, -24])).has('forge')).toBe(true)
  // Facing the blank west wall of the Vesper.
  expect([...visibleRooms('vesper', view([-14, 1.6, 0], [-20, 1.6, 0]))]).toEqual(['vesper'])
  // The north wall shared with the Forge is closed.
  expect([...visibleRooms('vesper', view([-14, 1.6, -12], [-14, 1.6, -24]))]).toEqual(['vesper'])
  // Facing south down the Lobby, the Oculus’ north arch into the Bastion lies behind the camera.
  const lobby = visibleRooms('lobby', view([0, 1.6, -28], [0, 1.6, 8]))
  expect(lobby.has('bastion')).toBe(false)
  expect(lobby.has('lodge')).toBe(false)
  expect(lobby.has('antechamber')).toBe(true)
  // The Moonfall stairway is visible from the Lobby at the reported camera position.
  expect(visibleRegions(['lobby'], viewProjection([-2.321, 1.62, 5.655], [5.248, 0.815, 13.195])).has('moonfall')).toBe(true)
})
/** the owner room of the object, by its ancestors like RoomCulling’s traversal */
const ownerOf = (object: Object3D): GalleryRoomId | undefined => ownerRoom(object, object.parent ? ownerOf(object.parent) : undefined)
test('a mesh belongs to the room that names itself its owner nearest above it, wherever its bounds reach', () => {
  const lobby = new Group
  lobby.userData.room = 'lobby'
  const vault = new Mesh
  lobby.add(vault)
  // The Lobby’s vault reaches over the Forge, and yet it is the Lobby’s alone.
  expect(ownerOf(vault)).toBe('lobby')
  const wall = new Group
  wall.userData.room = 'forge'
  const wallMesh = new Mesh
  lobby.add(wall)
  wall.add(wallMesh)
  expect(ownerOf(wallMesh)).toBe('forge')
  expect(ownerOf(new Mesh)).toBeUndefined()
  // Knottingham’s rooms are no rooms of the gallery.
  const arena = new Group
  arena.userData.room = 'arena'
  lobby.add(arena)
  expect(ownerOf(arena)).toBeUndefined()
})
test('a pickup belongs to the room it is in and keeps it in passages', () => {
  const lobby = new Group
  lobby.userData.room = 'lobby'
  const pickup = new Group
  pickup.userData.pickup = true
  const mesh = new Mesh
  lobby.add(pickup)
  pickup.add(mesh)
  const carry = (position: Vec3) => {
    pickup.position.set(...position)
    lobby.updateMatrixWorld()
    updatePickupRoom(pickup)
    return ownerOf(mesh)
  }
  expect(carry([-14, 1.6, 0])).toBe('vesper')
  // In the doorway between the Vesper and the Lobby, which neither room’s air takes in alone.
  expect(roomContaining([-8, 1.6, lobbyLayout.sideDoorZ])).toBeUndefined()
  expect(carry([-8, 1.6, lobbyLayout.sideDoorZ])).toBe('vesper')
  expect(carry([0, 1.6, -6])).toBe('lobby')
  expect(carry([-8, 1.6, lobbyLayout.sideDoorZ])).toBe('lobby')
  // Outside of every room, a pickup that never had one stays without.
  const lost = new Group
  lost.userData.pickup = true
  lost.position.set(500, 1.6, 500)
  lost.updateMatrixWorld()
  updatePickupRoom(lost)
  expect(ownerOf(lost)).toBeUndefined()
})
test('the Corridor’s stair flight and landing belong to the Corridor, and the vestibule beyond to the Sienna', () => {
  expect(roomContaining([-29.8, -0.9, 6.5])).toBe('corridor')
  expect(roomContaining([-26.1, 1.6, 10.2])).toBe('corridor')
  expect(roomContaining([-22.4, 1.6, 10.4])).toBe('sienna')
  // Flying at the hall’s south end, where the flight turns off onto the diagonal, with the vestibule’s arch out of view.
  expect(roomsAt([-33.7, -3.4, 2.6])).toEqual(['corridor'])
})
test('a camera stands in the rooms around it', () => {
  expect(roomsAt([-14, 1.6, 0])).toEqual(['vesper'])
  expect(roomsAt([500, 1.6, 500])).toEqual([])
})
test('rooms behind openings only show through them', () => {
  const position: Vec3 = [-14, 1.6, lobbyLayout.sideDoorZ]
  const target: Vec3 = [14, 1.6, lobbyLayout.sideDoorZ]
  const regions = visibleRegions(roomsAt(position), viewProjection(position, target))
  // Through the Lobby’s side doors into the Banquet, but not to the Salon and Antechamber, whose openings lie outside the door the Vesper looks through.
  const coarse = visibleRooms('vesper', view(position, target))
  expect(regions.keys().filter(room => !coarse.has(room)).toArray()).toEqual([])
  expect(regions.has('banquet')).toBe(true)
  expect(regions.has('salon')).toBe(false)
  const [left, bottom, right, top] = regions.get('lobby')![0]
  // The door into the Lobby covers only part of the screen.
  expect((right - left) * (top - bottom)).toBeLessThan(4)
  expect(visibleRegions(['vesper'], viewProjection([-14, 1.6, 0], [-20, 1.6, 0])).keys().toArray()).toEqual(['vesper'])
})
test('a camera in a room’s threshold beyond one of its openings sees through it', () => {
  // The Lodge owns half of the doorway passage to the Corridor, 1.6 m past its bay’s back wall; from its far end, looking up the passage, the Corridor once showed nothing but the sky.
  const dumped: Vec3 = [-24.638, -3.38, -43.796]
  expect(roomsAt(dumped)).toEqual(['lodge'])
  expect(visibleRegions(['lodge'], viewProjection(dumped, [-25.116, -3.7, -48.335])).has('corridor')).toBe(true)
  for (const {rooms: pair, holes} of openings) {
    for (const [wallId, name] of holes) {
      const wall = slopGallery.walls.find(value => value.id === wallId)!
      const hole = wall.holes!.find(value => value.name === name)!
      const other = pair.find(room => room !== wall.room)!
      const bottom = hole.bottom ?? 0
      const y = wall.center[1] + bottom + Math.min(1.6, (openingTop(hole, hole.u) - bottom) / 2)
      for (let step = 1; step <= 30; step++) {
        const depth = step / 10
        const position = wallPosition(wall, hole.u, y, -depth)
        if (roomsAt(position).join() !== wall.room) {
          continue
        }
        const sees = visibleRegions([wall.room as GalleryRoomId], viewProjection(position, wallPosition(wall, hole.u, y, -depth - 5))).has(other)
        expect(`${wallId} ${name} ${depth} m behind: ${sees ? 'sees' : 'misses'} ${other}`).toBe(`${wallId} ${name} ${depth} m behind: sees ${other}`)
      }
    }
  }
})
test('of a box reaching behind the camera, only the part in front of it shows', () => {
  const matrix = viewProjection([0, 1.6, 0], [10, 1.6, 0])
  // Overhead, from behind the camera to in front of it, like a skylight, but far above the view.
  expect(screenRect(new Box3(new Vector3(-3, 7.5, -3), new Vector3(3, 9.75, 3)), matrix)).toBeUndefined()
  // Around the camera, like a doorway it stands in.
  expect(screenRect(new Box3(new Vector3(-1, 0, -1), new Vector3(1, 3, 1)), matrix)).toEqual([-1, -1, 1, 1])
  // To the left, from behind the camera to 3 m in front of it, it only reaches in from the left edge.
  const [left, bottom, right, top] = screenRect(new Box3(new Vector3(-2, 1, -4), new Vector3(3, 2, -3)), matrix)!
  expect([left, bottom, top]).toEqual([-1, -1, 1])
  expect(right).toBeLessThan(-0.9)
})
test('the Forge–Bastion threshold stays visible at the reported camera pose', () => {
  const camera = new PerspectiveCamera(62, 16 / 9, 0.1, 1000)
  camera.position.set(-16.963, 1.62, -35.459)
  camera.rotation.set(-0.0472, 1.6118, 0, 'YXZ')
  camera.updateMatrixWorld()
  const matrix = new Matrix4
  matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  const from = roomsAt(camera.position.toArray())
  expect(from).toEqual(['forge'])
  expect(visibleRegions(from, matrix).get('bastion')).toContainEqual([-1, -1, 1, 1])
})
test('portal boxes contain the entire opening, including the bulge of curved walls', () => {
  for (const [index, {holes}] of openings.entries()) {
    const {box} = portals[index]
    for (const [wallId, name] of holes) {
      const wall = slopGallery.walls.find(value => value.id === wallId)!
      const hole = wall.holes!.find(value => value.name === name)!
      for (let step = 0; step <= 100; step++) {
        const u = hole.u + hole.width * (step / 100 - 0.5)
        // Both faces of the portal’s 0.8 m padding, and the wall itself, at the sill and crown heights.
        for (const offset of [-0.8, 0, 0.8]) {
          for (const height of [hole.bottom ?? 0, openingTop(hole, hole.u)]) {
            const position = new Vector3(...wallPosition(wall, u, wall.center[1] + height, offset))
            expect(box.distanceToPoint(position), `${wallId}/${name} at ${u}, offset ${offset}`).toBeLessThan(1e-9)
          }
        }
      }
    }
  }
})
test('crossing the Forge–Bastion threshold keeps both rooms visible in either direction', () => {
  // Sweep across the formerly missing strip, across the doorway and at crouching, standing and flying eye heights.
  for (let step = 0; step <= 24; step++) {
    for (const z of [-36.5, -35, -33.5]) {
      for (const y of [0.6, 1.62, 2.2]) {
        const position: Vec3 = [-17.2 + step * 0.025, y, z]
        const from = roomsAt(position)
        expect(from.length).toBeGreaterThan(0)
        for (const direction of [-1, 1]) {
          const regions = visibleRegions(from, viewProjection(position, [position[0] + direction, y, z]))
          for (const room of ['forge', 'bastion'] as const) {
            expect(regions.get(room), `${position.join(', ')} facing ${direction}: ${room}`).toContainEqual([-1, -1, 1, 1])
          }
        }
      }
    }
  }
})
