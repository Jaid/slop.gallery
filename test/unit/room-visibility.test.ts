import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Activation} from '../../src/worlds/gallery/activations.ts'
import type {GalleryRoomId} from '../../src/worlds/gallery/index.ts'
import type {Object3D} from 'three/webgpu'

import {expect, test} from 'bun:test'

import {Box3, Frustum, Group, Matrix4, Mesh, PerspectiveCamera, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {corridorLanding, corridorPassage, corridorStairs} from '../../src/lib/gallery/corridor.ts'
import {floorTile} from '../../src/lib/gallery/floors.ts'
import lobbyLayout from '../../src/lib/gallery/lobby.ts'
import {ownerRoom, portals, roomContaining, roomsAt, screenRect, updatePickupRoom, visibleRegions, visibleRooms, whereaboutsAt} from '../../src/lib/gallery/roomVisibility.ts'
import {siennaVestibule} from '../../src/lib/gallery/sienna.ts'
import {stairFlights} from '../../src/lib/gallery/staircase.ts'
import {openingTop, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import activations, {enabledRooms} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {openings} from '../../src/worlds/gallery/relations.ts'
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
test('the fences only keep rooms enabled that the rooms they lie in can reach through up to three openings', () => {
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
  for (const [fence, {rooms: enabled = []}] of Object.entries<Activation>(activations)) {
    // A room’s fence lies in the room, and a part of a room in the room around it.
    const within = slopGallery.rooms.filter(room => slopGallery.fencesIn(room.id).includes(fence)).map(room => room.id)
    expect(`${fence} lies in ${within.length} rooms`).toBe(`${fence} lies in 1 rooms`)
    const reachable = withinThree(within[0])
    for (const other of enabled) {
      expect(`${fence} keeps ${reachable.has(other) ? '' : 'unreachable '}${other === within[0] ? 'its own ' : ''}${other}`).toBe(`${fence} keeps ${other}`)
    }
  }
  // The Forge’s doorway leads into the Bastion and its glass wall looks into the Lobby, which both keep it enabled first, and it them.
  expect(activations.forge.rooms.slice(0, 2).toSorted()).toEqual(['bastion', 'lobby'])
  expect(activations.bastion.rooms).toContain('forge' as never)
  expect(activations.lobby.rooms).toContain('forge' as never)
  // Moonfall’s stairway is visible through the Antechamber from the Lobby, but only from its south part.
  expect(activations.lobby_south.rooms).toContain('moonfall' as never)
  for (const part of ['lobby_north', 'lobby_middle']) {
    expect(enabledRooms(['lobby', part])).not.toContain('moonfall')
  }
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
  // The Moonfall stairway is visible from the Lobby at the reported camera position, in its south part, which keeps Moonfall enabled.
  const reported: Vec3 = [-2.321, 1.62, 5.655]
  expect(visibleRegions(['lobby'], viewProjection(reported, [5.248, 0.815, 13.195])).has('moonfall')).toBe(true)
  expect(whereaboutsAt(reported)).toEqual(['lobby', 'lobby_south'])
  expect(enabledRooms(whereaboutsAt(reported))).toContain('moonfall')
})
test('a camera is in the rooms around it and in every other fence holding it, which keep rooms enabled together', () => {
  const lobby = activations.lobby.rooms
  expect(whereaboutsAt([0, 1.6, -28])).toEqual(['lobby', 'lobby_north'])
  expect(enabledRooms(whereaboutsAt([0, 1.6, -28]))).toEqual(lobby)
  expect(whereaboutsAt([0, 4, -12])).toEqual(['lobby', 'lobby_middle'])
  expect(enabledRooms(whereaboutsAt([0, 4, -12]))).toEqual(lobby)
  expect(enabledRooms(whereaboutsAt([0, 1.6, 0]))).toEqual([...lobby, 'moonfall'])
  // On the line between two parts, it is in both.
  expect(whereaboutsAt([0, 1.6, -10])).toEqual(['lobby', 'lobby_middle', 'lobby_south'])
  // In the doorway between the Vesper and the Lobby, which neither room’s air takes in alone, it is in both rooms and in the part of the Lobby the doorway opens into.
  expect(whereaboutsAt([-8, 1.6, lobbyLayout.sideDoorZ])).toEqual(['lobby', 'vesper', 'lobby_south'])
  expect(enabledRooms(whereaboutsAt([-8, 1.6, lobbyLayout.sideDoorZ]))).toEqual([...new Set<GalleryRoomId>([...lobby, ...activations.vesper.rooms, 'moonfall'])])
  // Given the rooms, it takes them as they are.
  expect(whereaboutsAt([0, 1.6, 0], ['vesper'])).toEqual(['vesper', 'lobby_south'])
  expect(whereaboutsAt([-14, 1.6, 0])).toEqual(['vesper'])
  expect(whereaboutsAt([500, 1.6, 500])).toEqual([])
})
test('no eye in the Lobby’s north and middle parts sees through the doorway into the Antechamber and on through the one onto Moonfall’s stairway', () => {
  const doorway = slopGallery.wall('lobby-south')!
  const door = doorway.holes!.find(hole => hole.name === 'antechamber')!
  const stairwall = slopGallery.wall('antechamber-east')!
  const stairs = stairwall.holes!.find(hole => hole.name === 'stairway')!
  // Both openings in plan: the doorway’s jambs along x through the wall between the Lobby and the Antechamber, from face to face, and the stairway’s along z from the face of the Antechamber’s east wall to its center line, where Moonfall’s stairway begins. The casings round them stand out further and only narrow the view.
  expect(stairwall.center[0]).toBe(stairFlights[0].start[0])
  const [doorWest, doorEast] = [-1, 1].map(side => wallPosition(doorway, door.u + side * door.width / 2, 0, 0)[0]).toSorted((a, b) => a - b)
  const [stairsNorth, stairsSouth] = [-1, 1].map(side => wallPosition(stairwall, stairs.u + side * stairs.width / 2, 0, 0)[2]).toSorted((a, b) => a - b)
  const [doorZ, stairsX] = [doorway.center[2], stairwall.center[0]]
  for (const [index, value] of [doorWest, doorEast, doorZ, stairsNorth, stairsSouth, stairsX].entries()) {
    expect(value).toBeCloseTo([-1.3, 1.3, 8, 10.7, 13.3, 4][index], 9)
  }
  /** Whether a straight line from the eye passes both openings, seen from above: the headings that pass each face of each opening, as meters east per meter south, leave some heading in common. */
  const sees = (x: number, z: number) => {
    let [least, most] = [0, Infinity]
    for (const face of [doorZ - wallFace, doorZ + wallFace]) {
      least = Math.max(least, (doorWest - x) / (face - z))
      most = Math.min(most, (doorEast - x) / (face - z))
    }
    for (const face of [stairsX - wallFace, stairsX]) {
      least = Math.max(least, (face - x) / (stairsSouth - z))
      most = Math.min(most, (face - x) / (stairsNorth - z))
    }
    return least <= most
  }
  // The reported camera position sees it, and so does an eye in the doorway.
  expect(sees(-2.321, 5.655)).toBe(true)
  expect(sees(0, 7)).toBe(true)
  // Any line of sight from further north crosses the line the south part begins on, so no eye on that line seeing it means none north of it does, from wall face to wall face.
  const [{z: line}] = slopGallery.dumpGeofences().find(fence => fence.id === 'lobby_south')!.boxes
  const reach = lobbyLayout.width / 2 - wallFace
  for (let x = -reach; x <= reach; x += 0.01) {
    expect(`${x.toFixed(2)}: ${sees(x, line) ? 'sees' : 'blind'}`).toBe(`${x.toFixed(2)}: blind`)
  }
  // An eye hugging the west wall sees it from furthest north, and the south part begins on the seam of the floor’s tiles next north of there: less than a tile further.
  let limit = line
  while (!sees(-reach, limit)) {
    limit += 0.001
  }
  expect(limit - line).toBeGreaterThan(0.1)
  expect(limit - line).toBeLessThan(floorTile)
  expect((line - lobbyLayout.northZ) % floorTile).toBe(0)
  expect(slopGallery.geofences.getMatches([-reach, 1.6, limit])).toEqual(['lobby', 'lobby_south'])
  // An eye by that wall just north of where the Lobby’s side walls with the arches begin still sees it, so that line would not do for the south part.
  expect(sees(-reach + 0.3, lobbyLayout.previousNorthZ - 0.2)).toBe(true)
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
  // Knottingham’s rooms are no rooms of the gallery, and neither are its fences that are no room’s.
  const arena = new Group
  arena.userData.room = 'arena'
  lobby.add(arena)
  expect(ownerOf(arena)).toBeUndefined()
  const part = new Group
  part.userData.room = 'lobby_south'
  lobby.add(part)
  expect(ownerOf(part)).toBeUndefined()
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
test('the Corridor’s stair flight and its head tread belong to the Corridor, and the landing’s boards and the vestibule beyond to the Sienna', () => {
  const head = new Vector3(...corridorStairs.start)
  const {x, y, z} = head.clone().lerp(new Vector3(...corridorStairs.end), 0.5)
  expect(roomContaining([x, y + 1.6, z])).toBe('corridor')
  // The front half of the head tread, out of reach of the boards’ chunks, from where the Vesper lies beyond sight.
  const [hx, hz] = corridorStairs.heading
  const tread: Vec3 = [head.x - hx * corridorStairs.run / 4, head.y + 1.6, head.z - hz * corridorStairs.run / 4]
  expect(roomsAt(tread)).toEqual(['corridor'])
  const [landingX, landingZ] = corridorLanding.path[1]
  expect(roomsAt([landingX, 1.6, landingZ])).toEqual(['sienna'])
  expect(roomContaining([siennaVestibule.center[0], 1.6, siennaVestibule.center[1]])).toBe('sienna')
  // Flying at the hall’s south end, where the flight turns off onto the diagonal, with the vestibule’s arch out of view.
  const [hallX, hallZ] = corridorPassage.path.at(-2)!
  expect(roomsAt([hallX, corridorPassage.floorY + 1.6, hallZ])).toEqual(['corridor'])
})
test('the Sienna’s arches by its corners show where they lead, both ways', () => {
  const vesperArch = slopGallery.walls.find(wall => wall.id === 'sienna-north')!
  const [archX, , archZ] = wallPosition(vesperArch, vesperArch.holes![0].u, 1.6, 0)
  expect(visibleRegions(['vesper'], viewProjection([archX, 1.6, archZ - 3], [archX, 1.6, archZ + 6])).has('sienna')).toBe(true)
  expect(visibleRegions(['sienna'], viewProjection([archX, 1.6, archZ + 3], [archX, 1.6, archZ - 6])).has('vesper')).toBe(true)
  const [vestibuleX, vestibuleZ] = siennaVestibule.center
  const [landingX] = corridorLanding.path[1]
  expect(visibleRegions(['sienna'], viewProjection([vestibuleX, 1.6, vestibuleZ], [landingX, 1.6, vestibuleZ])).has('corridor')).toBe(true)
  // From the landing’s boards down the flight, and from its head back up into the vestibule.
  const [headX, , headZ] = corridorStairs.start
  const [hx, hz] = corridorStairs.heading
  expect(visibleRegions(['sienna'], viewProjection([landingX, 1.6, vestibuleZ], [headX + hx * 6, -1, headZ + hz * 6])).has('corridor')).toBe(true)
  expect(visibleRegions(['corridor'], viewProjection([headX - hx * 0.1, 1.6, headZ - hz * 0.1], [vestibuleX, 1.6, vestibuleZ])).has('sienna')).toBe(true)
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
