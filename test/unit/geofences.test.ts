import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Geofence, RelationalGeofence} from 'geofency'
import {Box3} from 'three/webgpu'

import {apseOpeningPoint, apseOpenings, bastionApproach, bastionCurve, bastionLinkStripZ} from '../../src/lib/gallery/bastion.ts'
import {bastionLink, lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {cistern, cisternFloor} from '../../src/lib/gallery/cistern/cistern.ts'
import {cisternWindow} from '../../src/lib/gallery/cistern/window.ts'
import {climbApproach} from '../../src/lib/gallery/climb.ts'
import corridor, {corridorBayPaving, corridorEndZ, corridorLanding, corridorLandingPaving, corridorStairs, lodgeThreshold} from '../../src/lib/gallery/corridor.ts'
import {insidePolygon, polygonBounds} from '../../src/lib/gallery/floorPolygons.ts'
import {groundFenceY} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import lodge, {lodgeEastWindow, lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import lowerGallery, {oculusPlatform} from '../../src/lib/gallery/lowerGallery.ts'
import staircase, {stairFloorHeight, stairwayAir} from '../../src/lib/gallery/staircase.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import Cell from '../../src/rooms/cell/Cell.ts'
import CellLayout from '../../src/rooms/cell/CellLayout.ts'
import World from '../../src/worlds/base/World.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {worlds} from '../../src/worlds/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/cell.ts'

/** how far apart the sampled columns stand along x and z, in meters; they stand in the middles of the cells of this grid, off the planes fences and floors end on */
const columnSpacing = 0.75
/** the steps a column is searched for floors in, closer than any two floors lie */
const floorProbe = 1
/** where a standing body reaches above the floor under it: its feet, its middle and its eyes */
const bodyHeights = [0.05, 0.9, 1.75]
test('the rooms’ fences cover every point a player’s body takes up on every floor', () => {
  const bounds = new Box3
  for (const room of slopGallery.rooms) {
    for (const box of room.air) {
      bounds.union(box)
    }
  }
  let samples = 0
  const uncovered: Array<Vec3> = []
  for (let x = bounds.min.x + columnSpacing / 2; x < bounds.max.x; x += columnSpacing) {
    for (let z = bounds.min.z + columnSpacing / 2; z < bounds.max.z; z += columnSpacing) {
      const floors = new Set<number>
      for (let y = bounds.min.y; y <= bounds.max.y + floorProbe; y += floorProbe) {
        floors.add(slopGallery.floorHeight([x, y, z]))
      }
      for (const floor of floors) {
        for (const height of bodyHeights) {
          const position: Vec3 = [x, floor + height, z]
          if (!slopGallery.contains(position)) {
            continue
          }
          samples++
          if (!slopGallery.roomAt(position)) {
            uncovered.push(position)
          }
        }
      }
    }
  }
  expect(samples).toBeGreaterThan(20_000)
  expect(uncovered.slice(0, 5)).toEqual([])
}, 30_000)
test('the Lodge’s window niche belongs to the Lodge, out to the glass in the Corridor’s lining', () => {
  const sill = lodgeWindow.bottom + 0.2
  for (const x of [lodgeWindow.roomX - 0.2, (lodgeWindow.roomX + lodgeWindow.tunnelX) / 2, lodgeWindow.tunnelX + 0.05]) {
    expect(slopGallery.roomAt([x, sill, lodgeWindow.z])?.id).toBe('lodge')
  }
  expect(slopGallery.roomAt([lodgeWindow.tunnelX - 0.3, sill, lodgeWindow.z])?.id).toBe('corridor')
})
test('the Sienna’s boards on the Corridor’s landing are the Sienna’s, the front half of the flight’s head tread and the flight the Corridor’s', () => {
  const y = corridorLanding.floorY + 0.9
  const boards = corridorLandingPaving.flatMap(polygon => {
    const {center: [x, z], size: [width, depth]} = polygonBounds(polygon)
    return Array.from({length: 40}, (_, i) => Array.from({length: 40}, (__, j): Vec3 => [x + width * ((i + 0.5) / 40 - 0.5), y, z + depth * ((j + 0.5) / 40 - 0.5)])).flat().filter(([px, , pz]) => insidePolygon(polygon, px, pz))
  })
  expect(boards.length).toBeGreaterThan(500)
  expect(boards.filter(position => slopGallery.roomAt(position)?.id !== 'sienna')).toEqual([])
  const [sx, , sz] = corridorStairs.start
  const [hx, hz] = corridorStairs.heading
  for (let along = -corridorStairs.run / 2 + 0.01; along <= 1; along += 0.05) {
    for (let across = -1.9; across <= 1.9; across += 0.2) {
      const position: Vec3 = [sx + hx * along - hz * across, corridorStairs.start[1] + Math.min(0, -along * corridorStairs.rise / corridorStairs.run) + 0.9, sz + hz * along + hx * across]
      expect(slopGallery.roomAt(position)?.id).toBe('corridor')
    }
  }
})
test('the balcony’s middle stays the Oculus’, the staff stairways behind the doors at its ends are the Exhibition’s', () => {
  for (const {direction, stairway: {door: [x, floor, z]}} of tunnelDisplays) {
    const y = floor + 1.6
    expect(slopGallery.geofences.getMatches([0, y, z])).toEqual(['oculus'])
    expect(slopGallery.geofences.getMatches([x - direction * 0.01, y, z])).toEqual(['oculus'])
    expect(slopGallery.geofences.getMatches([x + direction * 0.01, y, z])).toEqual(['exhibition'])
  }
})
/** The sides of a fence’s box by their names, in the names’ order. */
const sides = (box: object) => Object.entries(box).toSorted(([a], [b]) => a.localeCompare(b)) as Array<[string, number]>
/** A Cell with other fences beside its own, by their ids within it, relative to its origin. */
class FencedCell extends Cell {
  override readonly fences: ReadonlyMap<string, Geofence>

  constructor(fences: Record<string, Geofence>) {
    super(new CellLayout(0))
    this.fences = new Map(Object.entries(fences))
  }
}
/** A world of a single Cell with other fences beside its own, placed at the origin. */
class FencedWorld extends World<Cell> {
  override readonly artworks = []
  override readonly defaultRoom = 'cell'
  override readonly id = 'sandbox'
  override readonly Minimap = sandbox.Minimap
  override readonly placement = sandbox.placement
  override readonly Scene = sandbox.Scene

  constructor(fences: Record<string, Geofence>, origin: Vec3 = [0, 0, 0]) {
    super(worlds.sandbox, [[new FencedCell(fences), origin]])
  }

  override contains() {
    return true
  }

  override floorHeight() {
    return 0
  }

  override wallDistance() {
    return Infinity
  }
}
test('a room’s other fences come after the rooms’, under the room’s global ids, where the world places the room, and never stand in for a room', () => {
  expect(knottingham.geofences.keys().toArray()).toEqual(['arena'])
  expect(sandbox.geofences.keys().toArray()).toEqual(['cell'])
  expect(slopGallery.geofences.keys().toArray()).toEqual([...slopGallery.rooms.map(room => room.id), 'lobby-north', 'lobby-middle', 'lobby-south', 'moonfall-stairs', 'bastion-knight_alley', 'bastion-cistern', 'bastion-gate', 'bastion-seeing_lodge_floor', 'corridor-window', 'corridor-seeing_lodge_floor'])
  // a fence reaching beyond the Cell and one far outside of it
  const corner = new Geofence([{
    x: 0,
    z: 0,
    x2: 90,
    z2: 90,
  }])
  const far = new Geofence([{
    x: 500,
    z: 500,
    x2: 600,
    z2: 600,
  }])
  const world = new FencedWorld({
    corner,
    far,
  })
  expect(world.geofences.keys().toArray()).toEqual(['cell', 'cell-corner', 'cell-far'])
  expect(world.geofences.getMatches([1, 1, 1])).toEqual(['cell', 'cell-corner'])
  expect(world.roomAt([1, 1, 1])?.id).toBe('cell')
  expect(world.geofences.getMatches([80, 1, 80])).toEqual(['cell-corner'])
  expect(world.roomAt([80, 1, 80])).toBeUndefined()
  expect(world.roomById('cell-corner')).toBeUndefined()
  // A player in the Cell may be in the fence reaching into it, but never in the one far outside of it.
  expect(world.fencesIn('cell')).toEqual(['cell', 'cell-corner'])
  expect(world.fencesIn('cell-corner')).toEqual([])
  // They move with the room.
  const moved = new FencedWorld({corner}, [1000, 0, 0])
  expect(moved.geofences.getMatches([1001, 1, 1])).toEqual(['cell', 'cell-corner'])
  expect(moved.geofences.getMatches([1, 1, 1])).toEqual([])
  // The empty id within a room is the room’s own.
  expect(() => new FencedWorld({'': far})).toThrow('id of its own')
})
test('the gallery’s bastion-knight_alley fences the Bastion’s blind branch beside the Lodge, within the Bastion’s fence, from its doorway in the connecting tunnel’s wall to its closing wall', () => {
  const fence = slopGallery.geofences.get('bastion-knight_alley')!
  const bastion = slopGallery.room('bastion').fence
  const {route, width} = lodgeSpur
  // along the whole branch from wall to wall, wherever a body is, standing, crouching or jumping
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], heading, y} = route.at(along)
    for (const across of [-1, 0, 1]) {
      const side = across * (width / 2 - 0.4)
      for (const height of [0.05, 0.9, 1.75, 2.7]) {
        const position: Vec3 = [x - Math.sin(heading) * side, y + height, z + Math.cos(heading) * side]
        // The Lodge’s east window looks into it, so wherever the Bastion sees the Lodge’s planks takes it in too.
        expect(slopGallery.geofences.getMatches(position)).toEqual(['bastion', 'bastion-knight_alley', 'bastion-seeing_lodge_floor'])
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  // The Bastion uses the same single box for the ramp and the level alley beyond it.
  expect(fence.boxes).toHaveLength(1)
  expect(bastion.boxes).toContainEqual(fence.boxes[0])
  // It begins in the plane of the connecting tunnel’s wall, where the doorway into it is, and ends at its closing wall, behind which the run toward the Lodge passes.
  const [startX, startZ] = route.start
  const startY = route.at(0).y + 0.9
  expect(fence.contains([startX, startY, startZ + 0.01])).toBe(false)
  expect(fence.contains([startX, startY, startZ - 0.01])).toBe(true)
  expect(slopGallery.geofences.getMatches([startX, startY, bastionLinkStripZ])).toEqual(['bastion'])
  const {point: [endX, endZ], y: floorY} = route.end
  const endY = floorY + 0.9
  expect(endZ).toBe(lodgeSpurEnd.center[2])
  expect(fence.contains([endX, endY, endZ + 0.01])).toBe(true)
  expect(fence.contains([endX, endY, endZ - 0.01])).toBe(false)
  // Behind it, the run looks down the approach to the Lodge.
  expect(slopGallery.geofences.getMatches([endX, endY, endZ - 1])).toEqual(['bastion', 'bastion-seeing_lodge_floor'])
  // neither its walls’ far sides, nor the Lodge behind its side window, nor the Forge’s vestibule over its vault, nor the ground under it
  for (const side of [-1, 1]) {
    expect(fence.contains([endX + side * (width / 2 + 0.01), endY, endZ + 2])).toBe(false)
  }
  expect(slopGallery.geofences.getMatches([lodgeEastWindow.x - 0.5, endY, lodgeEastWindow.z])).toEqual(['lodge'])
  expect(slopGallery.geofences.getMatches([endX, 0.9, endZ + 2])).toEqual(['forge'])
  expect(fence.contains([endX, floorY - 1.5, endZ + 2])).toBe(false)
  // The empty suit of armor stands in it, and no room’s visitors arrive in it.
  const [armorX, armorY, armorZ] = lodgeSpurArmor
  expect(fence.contains([armorX, armorY + 1, armorZ])).toBe(true)
  for (const room of slopGallery.rooms) {
    const [x, y, z] = room.spawn.position
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
})
/** The boxes of the gallery’s fence with the id as the plain data its dump gives, a tenth of a millimeter exact. */
const dumped = (id: string) => slopGallery.dumpGeofences().find(fence => fence.id === id)!.boxes as Array<Record<string, number>>
test('the gallery’s lobby-north, lobby-middle and lobby-south make up the Lobby’s fence, split in three along the south edge of its glazed floor over the Oculus and the north edge of its arches into the Vesper and the Banquet', () => {
  // everything over the Lobby’s floor plan from the slab up
  const whole = {
    x: -lobby.width / 2,
    x2: lobby.width / 2,
    z: lobby.northZ,
    z2: lobby.southZ,
    floor: groundFenceY,
  }
  expect(slopGallery.room('lobby').fence).toBeInstanceOf(RelationalGeofence)
  expect(slopGallery.geofences.resolve('lobby')!.boxes).toEqual(['lobby-north', 'lobby-middle', 'lobby-south'].flatMap(part => slopGallery.geofences.get(part)!.boxes))
  const [{z2: glassZ}] = dumped('lobby-north')
  const [{z: archZ}] = dumped('lobby-south')
  expect(glassZ).toBe(lobby.opening.center[1] + lobby.opening.size[1] / 2)
  expect(archZ).toBeCloseTo(lobby.sideDoorZ - lobby.sideDoorWidth / 2, 9)
  expect([glassZ, archZ]).toEqual([-20, -1.5])
  expect(dumped('lobby-north')).toEqual([{
    ...whole,
    z2: glassZ,
  }])
  expect(dumped('lobby-middle')).toEqual([{
    ...whole,
    z: glassZ,
    z2: archZ,
  }])
  expect(dumped('lobby-south')).toEqual([{
    ...whole,
    z: archZ,
  }])
  // The fountain stands in the middle part, the arches open from the south part, all the way across them on the planes of the walls they go through.
  expect(slopGallery.geofences.getMatches([lobbyFountainSpot[0], 0.9, lobbyFountainSpot[2]])).toEqual(['lobby', 'lobby-middle'])
  for (const [side, room] of [[-1, 'vesper'], [1, 'banquet']] as const) {
    for (let z = archZ + 0.01; z < archZ + lobby.sideDoorWidth; z += 0.1) {
      expect(slopGallery.geofences.getMatches([side * (lobby.width / 2 - 0.5), 0.9, z])).toEqual(['lobby', 'lobby-south'])
      expect(slopGallery.geofences.getMatches([side * lobby.width / 2, 0.9, z])).toEqual(['lobby', room, 'lobby-south'])
    }
  }
  // from wall to wall and from the slab up without end, a part on either side of each line and both of them on it
  for (const x of [-lobby.width / 2 + 0.01, 0, lobby.width / 2 - 0.01]) {
    for (const y of [0.05, 0.9, 1.75, 40]) {
      expect(slopGallery.geofences.getMatches([x, y, lobby.northZ + 0.01])).toEqual(['lobby', 'lobby-north'])
      expect(slopGallery.geofences.getMatches([x, y, glassZ - 0.01])).toEqual(['lobby', 'lobby-north'])
      expect(slopGallery.geofences.getMatches([x, y, glassZ])).toEqual(['lobby', 'lobby-north', 'lobby-middle'])
      expect(slopGallery.geofences.getMatches([x, y, glassZ + 0.01])).toEqual(['lobby', 'lobby-middle'])
      expect(slopGallery.geofences.getMatches([x, y, archZ - 0.01])).toEqual(['lobby', 'lobby-middle'])
      expect(slopGallery.geofences.getMatches([x, y, archZ])).toEqual(['lobby', 'lobby-middle', 'lobby-south'])
      expect(slopGallery.geofences.getMatches([x, y, archZ + 0.01])).toEqual(['lobby', 'lobby-south'])
      expect(slopGallery.geofences.getMatches([x, y, lobby.southZ - 0.01])).toEqual(['lobby', 'lobby-south'])
    }
  }
  // The whole glazed floor over the Oculus lies in the north part, where visitors arrive too, and the Oculus under it in none of them.
  const {center: [openingX, openingZ], size: [openingWidth, openingDepth]} = lobby.opening
  for (const across of [-1, 1]) {
    for (const along of [-1, 1]) {
      expect(slopGallery.geofences.getMatches([openingX + across * (openingWidth / 2 - 0.01), 0.9, openingZ + along * (openingDepth / 2 - 0.01)])).toEqual(['lobby', 'lobby-north'])
    }
  }
  expect(slopGallery.geofences.getMatches([openingX, lowerGallery.oculus.floorY + 0.9, openingZ])).toEqual(['oculus'])
  const [x, y, z] = slopGallery.spawn.position
  expect(slopGallery.geofences.getMatches([x, y + 0.9, z])).toEqual(['lobby', 'lobby-north'])
})
test('the gallery’s moonfall-stairs fences the stairway between the Antechamber and Moonfall: whatever of Moonfall’s fence lies outside of its hall', () => {
  const fence = slopGallery.geofences.get('moonfall-stairs')!
  const [hall, ...stairway] = slopGallery.room('moonfall').fence.boxes
  const {startX, endX, z: topZ, returnZ: footZ} = staircase
  const maxX = Math.max(...stairwayAir.map(({max}) => max[0]))
  let treads = 0
  for (let x = endX - 1.03; x < maxX + 1.03; x += 0.31) {
    for (let z = topZ - 2.03; z < footZ + 3.03; z += 0.31) {
      for (const y of [-12, -7.1, -2.1, -1.9, 0.9, 9]) {
        const position: Vec3 = [x, y, z]
        expect(fence.contains(position)).toBe(stairway.some(box => box.contains(position)) && !hall.contains(position))
      }
      // wherever a body is on its flights and its turn, standing, crouching or jumping
      const floor = stairFloorHeight(x, z)
      if (floor === undefined) {
        continue
      }
      treads++
      for (const height of bodyHeights) {
        const position: Vec3 = [x, floor + height, z]
        expect(slopGallery.geofences.getMatches(position)).toEqual(['moonfall', 'moonfall-stairs'])
        expect(slopGallery.roomAt(position)?.id).toBe('moonfall')
      }
    }
  }
  expect(treads).toBeGreaterThan(500)
  expect(slopGallery.geofences.getMatches([startX - 0.01, 0.9, topZ])).toEqual(['antechamber'])
  expect(slopGallery.geofences.getMatches([startX + 0.01, 0.9, topZ])).toEqual(['moonfall', 'moonfall-stairs'])
  const footY = lowerGallery.floorY + 0.9
  expect(slopGallery.geofences.getMatches([endX + 0.01, footY, footZ])).toEqual(['moonfall', 'moonfall-stairs'])
  expect(slopGallery.geofences.getMatches([endX - 0.01, footY, footZ])).toEqual(['moonfall'])
  expect(slopGallery.geofences.getMatches([startX + 1, footY, topZ])).toEqual([])
  // Moonfall’s visitors arrive on its lower flight, in the fence.
  const [x, y, z] = slopGallery.room('moonfall').spawn.position
  expect(stairFloorHeight(x, z)).toBeDefined()
  expect(fence.contains([x, y + 0.9, z])).toBe(true)
})
test('the gallery’s bastion-cistern fences the Bastion’s cistern, within the Bastion’s fence, behind the flat wall it shares with the Forge’s vestibule and the approach', () => {
  const fence = slopGallery.geofences.get('bastion-cistern')!
  const bastion = slopGallery.room('bastion').fence
  const [centerX, wallZ] = cistern.center
  let floors = 0
  // wherever a body is on its floor, standing, crouching or jumping
  for (let x = centerX - cistern.radius - 0.53; x < centerX + cistern.radius + 0.53; x += 0.31) {
    for (let z = wallZ - cistern.radius - 0.53; z < wallZ; z += 0.31) {
      const floor = cisternFloor(x, z)
      if (floor === undefined) {
        continue
      }
      floors++
      for (const height of bodyHeights) {
        const position: Vec3 = [x, floor + height, z]
        // the Bastion’s, and in its west the Lodge’s, whose fence reaches up through its roof
        expect(slopGallery.geofences.getMatches(position).filter(id => id !== 'lodge')).toEqual(['bastion', 'bastion-cistern'])
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  expect(floors).toBeGreaterThan(500)
  // The Bastion uses the same single box for the cistern, up to rounding from the trip through its local coordinates.
  expect(fence.boxes).toHaveLength(1)
  const bounds = sides(fence.boxes[0])
  const twins = bastion.boxes.filter(candidate => sides(candidate).every(([side, value], index) => side === bounds[index][0] && Math.abs(value - bounds[index][1]) < 1e-9))
  expect(twins).toHaveLength(1)
  // It begins in the plane of its flat wall, which the window from the Forge’s vestibule leads through.
  const [windowX] = cisternWindow.center
  expect(slopGallery.geofences.getMatches([windowX, 1.6, wallZ + 0.3])).toEqual(['forge'])
  expect(slopGallery.geofences.getMatches([windowX, 1.6, wallZ - 0.3])).toEqual(['bastion', 'bastion-cistern'])
  // neither the Bastion’s approach in front of that wall, nor the Lodge under its floor, nor anything over its dome
  const {route} = climbApproach
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], y} = route.at(along)
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
  expect(slopGallery.geofences.getMatches([centerX - 4, lodge.floorY + 0.9, wallZ - 1.5])).toEqual(['lodge'])
  expect(fence.contains([centerX, cistern.crown + 1, wallZ - 1.5])).toBe(false)
  for (const room of slopGallery.rooms) {
    const [x, y, z] = room.spawn.position
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
})
test('the gallery’s bastion-gate fences the Bastion’s curve behind the gate in the crown of the Oculus’ apse, within the Bastion’s fence, north of the gate', () => {
  const fence = slopGallery.geofences.get('bastion-gate')!
  const bastion = slopGallery.room('bastion').fence
  const gate = apseOpenings.find(({name}) => name === 'gate')!
  const [, gateZ] = apseOpeningPoint(gate)
  const {route, width} = bastionCurve
  let inside = 0
  // wherever a body is on the curve, standing, crouching or jumping: north of the gate in the fence, south of it not
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], heading, y} = route.at(along)
    for (const across of [-1, 0, 1]) {
      const side = across * (width / 2 - 0.4)
      const [pointX, pointZ] = [x - Math.sin(heading) * side, z + Math.cos(heading) * side]
      if (Math.abs(pointZ - gateZ) < 0.01) {
        continue
      }
      for (const height of [0.05, 0.9, 1.75, 2.7]) {
        const position: Vec3 = [pointX, y + height, pointZ]
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
        expect(fence.contains(position)).toBe(pointZ < gateZ)
        inside += Number(pointZ < gateZ)
      }
    }
  }
  expect(inside).toBeGreaterThan(300)
  // Its boxes are the curve’s own north of the gate, cut off along it, so the Bastion’s fence holds all of it.
  for (const box of fence.boxes) {
    const [x, x2, y, y2, z, z2] = sides(box).map(([, value]) => value)
    expect(z2).toBeLessThanOrEqual(gateZ + 1e-9)
    expect(bastion.boxes.some(candidate => {
      const [cx, cx2, cy, cy2, cz, cz2] = sides(candidate).map(([, value]) => value)
      return x >= cx - 1e-9 && x2 <= cx2 + 1e-9 && y >= cy - 1e-9 && y2 <= cy2 + 1e-9 && z >= cz - 1e-9 && z2 <= cz2 + 1e-9
    })).toBe(true)
  }
  // behind the gate and both windows, where they look out over the platform, and down the curve to the Lodge too
  const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
  for (const opening of apseOpenings) {
    const [x, z] = apseOpeningPoint(opening, 1.2)
    expect(slopGallery.geofences.getMatches([x, platformY + 0.9, z])).toEqual(['bastion', 'bastion-gate', 'bastion-seeing_lodge_floor'])
  }
  // neither the apse in front of the gate, nor the floor under the curve, nor anything over its vault
  const behindGateZ = gateZ - 2
  expect(slopGallery.geofences.getMatches([0, platformY + 0.9, gateZ + 1])).toEqual(['oculus'])
  expect(fence.contains([0, platformY - 1.5, behindGateZ])).toBe(false)
  expect(fence.contains([0, platformY + 6, behindGateZ])).toBe(false)
  // Visitors to the Bastion arrive in it, behind the gate, and no other room’s.
  for (const room of slopGallery.rooms) {
    const [x, y, z] = room.spawn.position
    expect(fence.contains([x, y + 0.9, z])).toBe(room.id === 'bastion')
  }
})
test('the gallery’s corridor-window fences the Corridor’s long hall abreast of the Lodge’s west window, within the Corridor’s fence, from wall to glass', () => {
  const fence = slopGallery.geofences.get('corridor-window')!
  const reach = lodgeWindow.width / 2 + 1
  const westX = corridor.center[0] - corridor.size[0] / 2
  // wherever a body is in the hall from a meter north of the window to a meter south of it, standing, crouching or jumping
  for (let z = lodgeWindow.z - reach + 0.05; z < lodgeWindow.z + reach; z += 0.1) {
    for (let x = westX + 0.35; x < lodgeWindow.tunnelX - 0.3; x += 0.25) {
      for (const height of [0.05, 0.9, 1.75, 2.7]) {
        expect(slopGallery.geofences.getMatches([x, corridor.floorY + height, z])).toEqual(['corridor', 'corridor-window'])
      }
    }
  }
  // just beyond it along the hall, the Corridor’s alone
  for (const side of [-1, 1]) {
    expect(slopGallery.geofences.getMatches([corridor.center[0], corridor.floorY + 0.9, lodgeWindow.z + side * (reach + 0.01)])).toEqual(['corridor'])
  }
  // not the window’s niche behind its glass, which is the Lodge’s, nor the ground under the hall, nor anything over its crown
  expect(fence.contains([lodgeWindow.tunnelX + 0.05, lodgeWindow.bottom + 0.2, lodgeWindow.z])).toBe(false)
  expect(fence.contains([corridor.center[0], corridor.floorY - 1.5, lodgeWindow.z])).toBe(false)
  expect(fence.contains([corridor.center[0], corridor.floorY + corridor.height + 1, lodgeWindow.z])).toBe(false)
  // The Corridor’s fence holds all of it.
  const corridorFence = slopGallery.room('corridor').fence
  const [box] = dumped('corridor-window')
  for (const x of [box.x, box.x2]) {
    for (const z of [box.z, box.z2]) {
      for (const y of [box.y, box.y2]) {
        expect(corridorFence.contains([x, y, z])).toBe(true)
      }
    }
  }
  for (const room of slopGallery.rooms) {
    const [x, y, z] = room.spawn.position
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
})
/** where a body standing on the floor at the height reaches above it: its feet, its middle, its eyes and its head in a jump */
const body = (x: number, y: number, z: number) => [0.05, 0.9, 1.75, 2.7].map((height): Vec3 => [x, y + height, z])
test('the gallery’s bastion-seeing_lodge_floor fences wherever the Bastion sees the Lodge’s planks, within the Bastion’s fence: down the approach and round the curve to the crown of the Oculus’ apse, the mouth of the link and the knight’s alley', () => {
  const fence = slopGallery.geofences.get('bastion-seeing_lodge_floor')!
  const bastion = slopGallery.room('bastion').fence
  // the approach from the curve to the Lodge’s east doorway, from wall to wall
  const [[fromX, approachZ], [toX]] = bastionApproach.path
  for (let x = fromX + 0.05; x < toX; x += 0.1) {
    for (const across of [-1, 0, 1]) {
      for (const position of body(x, lodge.floorY, approachZ + across * (bastionApproach.width / 2 - 0.4))) {
        expect(fence.contains(position)).toBe(true)
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  // along the curve: in it down to the crown of the apse, well past the crown not
  const {route} = bastionCurve
  let curve = 0
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], y} = route.at(along)
    if (Math.abs(x) < 5) {
      continue
    }
    for (const position of body(x, y, z)) {
      expect(`${x.toFixed(2)}, ${z.toFixed(2)}: ${fence.contains(position)}`).toBe(`${x.toFixed(2)}, ${z.toFixed(2)}: ${x < 0}`)
      curve += Number(x < 0)
    }
  }
  expect(curve).toBeGreaterThan(300)
  // half a meter into the link, from its mouth in the curve’s south wall
  const {route: link} = bastionLink
  const {point: [linkX, linkZ], y: linkY} = [0.5, link.length - 0.5].map(along => link.at(along)).toSorted((a, b) => a.point[1] - b.point[1])[0]
  for (const position of body(linkX, linkY, linkZ)) {
    expect(fence.contains(position)).toBe(true)
  }
  // the knight’s alley, from its doorway to its closing wall
  for (let along = 0.05; along < lodgeSpur.route.length; along += 0.1) {
    const {point: [x, z], y} = lodgeSpur.route.at(along)
    for (const position of body(x, y, z)) {
      expect(fence.contains(position)).toBe(true)
    }
  }
  // not the climb over the Lodge toward the Forge, whose floor mirrors the ground level’s plane, nor the Lodge itself
  for (let along = 0.05; along < climbApproach.route.length; along += 0.5) {
    const {point: [x, z], y} = climbApproach.route.at(along)
    expect(fence.contains([x, y + 0.9, z])).toBe(false)
  }
  expect(fence.contains([lodge.center[0], lodge.floorY + 0.9, lodge.center[1]])).toBe(false)
  // Its boxes are the Bastion’s own, so the Bastion’s fence holds all of it.
  for (const box of fence.boxes) {
    const [x, x2, y, y2, z, z2] = sides(box).map(([, value]) => value)
    expect(bastion.boxes.some(candidate => {
      const [cx, cx2, cy, cy2, cz, cz2] = sides(candidate).map(([, value]) => value)
      return x >= cx - 1e-9 && x2 <= cx2 + 1e-9 && y >= cy - 1e-9 && y2 <= cy2 + 1e-9 && z >= cz - 1e-9 && z2 <= cz2 + 1e-9
    })).toBe(true)
  }
})
test('the gallery’s corridor-seeing_lodge_floor fences the Corridor round the Lodge’s bay, which looks back through the doorway into the bay, within the Corridor’s fence and up to the Lodge’s threshold', () => {
  const fence = slopGallery.geofences.get('corridor-seeing_lodge_floor')!
  let inside = 0
  for (const polygon of corridorBayPaving) {
    const {center: [centerX, centerZ], size: [width, depth]} = polygonBounds(polygon)
    for (let x = centerX - width / 2 + 0.005; x < centerX + width / 2; x += 0.2) {
      for (let z = centerZ - depth / 2 + 0.005; z < centerZ + depth / 2; z += 0.2) {
        if (!insidePolygon(polygon, x, z)) {
          continue
        }
        for (const height of [0.05, 0.9, 1.75, 2.7]) {
          // The box round the Lodge’s bay takes in a corner of the diagonal, where the player is in the Lodge, whose planks the mirror shows anyway.
          const position: Vec3 = [x, corridor.floorY + height, z]
          expect(slopGallery.geofences.getMatches(position)).toEqual(slopGallery.room('lodge').fence.contains(position) ? ['lodge', 'corridor'] : ['corridor', 'corridor-seeing_lodge_floor'])
          inside++
        }
      }
    }
  }
  expect(inside).toBeGreaterThan(500)
  // not the Lodge’s threshold beyond it, nor the hall down the Lodge’s west side, nor the ground under it or anything over its crown
  const [thresholdX, thresholdZ] = lodgeThreshold.center
  expect(slopGallery.geofences.getMatches([thresholdX, corridor.floorY + 0.9, thresholdZ])).toEqual(['lodge'])
  expect(fence.contains([corridor.center[0], corridor.floorY + 0.9, corridor.center[1]])).toBe(false)
  expect(fence.contains([thresholdX, corridor.floorY - 1.5, corridorEndZ - 1])).toBe(false)
  expect(fence.contains([thresholdX, corridor.floorY + corridor.height + 1, corridorEndZ - 1])).toBe(false)
  // The Corridor’s fence holds all of it.
  const corridorFence = slopGallery.room('corridor').fence
  for (const box of fence.boxes) {
    const [x1, x2, y1, y2, z1, z2] = sides(box).map(([, value]) => value)
    for (const x of [x1, x2]) {
      for (const z of [z1, z2]) {
        for (const y of [y1, y2]) {
          expect(corridorFence.contains([x, y, z])).toBe(true)
        }
      }
    }
  }
})
