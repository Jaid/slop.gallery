import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {Geofence} from 'geofency'
import {Box3} from 'three/webgpu'

import {apseOpeningPoint, apseOpenings, bastionCurve, bastionLinkStripZ} from '../../src/lib/gallery/bastion.ts'
import {lodgeSpur, lodgeSpurArmor, lodgeSpurEnd} from '../../src/lib/gallery/bastionNetwork.ts'
import {cistern, cisternChunks, cisternFloor} from '../../src/lib/gallery/cistern/cistern.ts'
import {cisternWindow} from '../../src/lib/gallery/cistern/window.ts'
import {climbApproach} from '../../src/lib/gallery/climb.ts'
import corridor, {corridorLanding, corridorLandingPaving, corridorStairs} from '../../src/lib/gallery/corridor.ts'
import {insidePolygon, polygonBounds} from '../../src/lib/gallery/floorPolygons.ts'
import {floorTile} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import lodge, {lodgeEastWindow, lodgeWindow} from '../../src/lib/gallery/lodge.ts'
import lowerGallery, {oculusPlatform} from '../../src/lib/gallery/lowerGallery.ts'
import {salonSouthZ} from '../../src/lib/gallery/salon.ts'
import {stairFloorHeight, stairwayFootprint} from '../../src/lib/gallery/staircase.ts'
import tunnelDisplays from '../../src/lib/gallery/tunnelDisplays.ts'
import Cell from '../../src/rooms/cell/Cell.ts'
import CellLayout from '../../src/rooms/cell/CellLayout.ts'
import World from '../../src/worlds/base/World.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import {worlds} from '../../src/worlds/index.ts'
import knottingham from '../../src/worlds/knottingham/index.ts'
import sandbox from '../../src/worlds/sandbox/index.ts'

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
  const {door} = tunnelDisplays[0].stairway
  const over = door[1] + 1.6
  expect(slopGallery.roomAt([0, over, door[2]])?.id).toBe('oculus')
  for (const side of [-1, 1]) {
    expect(slopGallery.roomAt([side * (Math.abs(door[0]) - 0.5), over, door[2]])?.id).toBe('oculus')
    expect(slopGallery.roomAt([side * (Math.abs(door[0]) + 0.5), over, door[2]])?.id).toBe('exhibition')
  }
})
/** The sides of a fence’s box by their names, in the names’ order. */
const sides = (box: object) => Object.entries(box).toSorted(([a], [b]) => a.localeCompare(b)) as Array<[string, number]>
/** A world of a single Cell with fences beside its room’s. */
class FencedWorld extends World<Cell> {
  override readonly artworks = []
  override readonly defaultRoom = 'cell'
  override readonly id = 'sandbox'
  override readonly Minimap = sandbox.Minimap
  override readonly placement = sandbox.placement
  override readonly Scene = sandbox.Scene

  constructor(fences: Record<string, Geofence>) {
    super(worlds.sandbox, [[new Cell(new CellLayout(0)), [0, 0, 0]]], fences)
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
test('a world’s other fences come after its rooms’, under ids of their own, and never stand in for a room', () => {
  expect(knottingham.geofences.keys().toArray()).toEqual(['arena'])
  expect(sandbox.geofences.keys().toArray()).toEqual(['cell'])
  expect(slopGallery.geofences.keys().toArray()).toEqual([...slopGallery.rooms.map(room => room.id), 'lobby_north', 'lobby_middle', 'lobby_south', 'moonfall_stairs', 'knight_alley', 'bastion_cistern', 'bastion_gate', 'corridor_window'])
  // A fence reaching beyond the Cell and one far outside of it
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
  expect(world.geofences.keys().toArray()).toEqual(['cell', 'corner', 'far'])
  expect(world.geofences.getMatches([1, 1, 1])).toEqual(['cell', 'corner'])
  expect(world.roomAt([1, 1, 1])?.id).toBe('cell')
  expect(world.geofences.getMatches([80, 1, 80])).toEqual(['corner'])
  expect(world.roomAt([80, 1, 80])).toBeUndefined()
  expect(world.roomById('corner')).toBeUndefined()
  // A player in the Cell may be in the fence reaching into it, but never in the one far outside of it.
  expect(world.fencesIn('cell')).toEqual(['cell', 'corner'])
  expect(world.fencesIn('corner')).toEqual([])
  expect(() => new FencedWorld({cell: far})).toThrow('id of its own')
})
test('the gallery’s knight_alley fences the Bastion’s blind branch beside the Lodge, within the Bastion’s fence, from its doorway in the connecting tunnel’s wall to its closing wall', () => {
  const fence = slopGallery.geofences.get('knight_alley')!
  const bastion = slopGallery.room('bastion').fence
  const {route, width} = lodgeSpur
  // Along the whole branch from wall to wall, wherever a body is, standing, crouching or jumping
  for (let along = 0.05; along < route.length; along += 0.1) {
    const {point: [x, z], heading, y} = route.at(along)
    for (const across of [-1, 0, 1]) {
      const side = across * (width / 2 - 0.4)
      for (const height of [0.05, 0.9, 1.75, 2.7]) {
        const position: Vec3 = [x - Math.sin(heading) * side, y + height, z + Math.cos(heading) * side]
        expect(slopGallery.geofences.getMatches(position)).toEqual(['bastion', 'knight_alley'])
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  // Its boxes are the Bastion’s own around the branch, but for the rounding of the Bastion’s way from its origin and back, so the Bastion’s fence holds all of it.
  expect(fence.boxes).toHaveLength(lodgeSpur.chunks(0.35).length)
  for (const box of fence.boxes) {
    const twins = bastion.boxes.filter(candidate => sides(candidate).every(([side, value], index) => side === sides(box)[index][0] && Math.abs(value - sides(box)[index][1]) < 1e-9))
    expect(twins).toHaveLength(1)
  }
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
  expect(slopGallery.geofences.getMatches([endX, endY, endZ - 1])).toEqual(['bastion'])
  // Neither its walls’ far sides, nor the Lodge behind its side window, nor the Forge’s vestibule over its vault, nor the ground under it
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
test('the gallery’s lobby_north, lobby_middle and lobby_south split the Lobby’s fence in three along the line the Forge meets the Vesper on and the Salon the Banquet and a seam of its floor’s tiles south of its fountain', () => {
  const [whole] = dumped('lobby')
  const middleZ = -10
  expect(dumped('lobby_north')).toEqual([{
    ...whole,
    z2: salonSouthZ,
  }])
  expect(dumped('lobby_middle')).toEqual([{
    ...whole,
    z: salonSouthZ,
    z2: middleZ,
  }])
  expect(dumped('lobby_south')).toEqual([{
    ...whole,
    z: middleZ,
  }])
  // The rooms on either side of the Lobby meet on the first line.
  for (const [south, north] of [['vesper', 'forge'], ['banquet', 'salon']]) {
    expect(dumped(south)[0].z).toBe(salonSouthZ)
    expect(dumped(north)[0].z2).toBe(salonSouthZ)
  }
  // The second is a seam of the floor’s tiles, which are laid from the Lobby’s north wall, south of the fountain in its middle part and north of the arches into the Vesper and the Banquet in its south part.
  expect((middleZ - lobby.northZ) % floorTile).toBe(0)
  expect(slopGallery.geofences.getMatches([lobbyFountainSpot[0], 0.9, lobbyFountainSpot[2]])).toEqual(['lobby', 'lobby_middle'])
  for (const side of [-1, 1]) {
    expect(slopGallery.geofences.getMatches([side * (lobby.width / 2 - 0.5), 0.9, lobby.sideDoorZ])).toEqual(['lobby', 'lobby_south'])
  }
  // From wall to wall and from the slab up without end, a part on either side of each line and both of them on it
  for (const x of [-lobby.width / 2 + 0.01, 0, lobby.width / 2 - 0.01]) {
    for (const y of [0.05, 0.9, 1.75, 40]) {
      expect(slopGallery.geofences.getMatches([x, y, lobby.northZ + 0.01])).toEqual(['lobby', 'lobby_north'])
      expect(slopGallery.geofences.getMatches([x, y, salonSouthZ - 0.01])).toEqual(['lobby', 'lobby_north'])
      expect(slopGallery.geofences.getMatches([x, y, salonSouthZ])).toEqual(['lobby', 'lobby_north', 'lobby_middle'])
      expect(slopGallery.geofences.getMatches([x, y, salonSouthZ + 0.01])).toEqual(['lobby', 'lobby_middle'])
      expect(slopGallery.geofences.getMatches([x, y, middleZ - 0.01])).toEqual(['lobby', 'lobby_middle'])
      expect(slopGallery.geofences.getMatches([x, y, middleZ])).toEqual(['lobby', 'lobby_middle', 'lobby_south'])
      expect(slopGallery.geofences.getMatches([x, y, middleZ + 0.01])).toEqual(['lobby', 'lobby_south'])
      expect(slopGallery.geofences.getMatches([x, y, lobby.southZ - 0.01])).toEqual(['lobby', 'lobby_south'])
    }
  }
  // The glazed floor over the Oculus lies in the north part, where visitors arrive too, and the Oculus under it in none of them.
  const [openingX, openingZ] = lobby.opening.center
  expect(slopGallery.geofences.getMatches([openingX, 0.9, openingZ])).toEqual(['lobby', 'lobby_north'])
  expect(slopGallery.geofences.getMatches([openingX, lowerGallery.oculus.floorY + 0.9, openingZ])).toEqual(['oculus'])
  const [x, y, z] = slopGallery.spawn.position
  expect(slopGallery.geofences.getMatches([x, y + 0.9, z])).toEqual(['lobby', 'lobby_north'])
})
test('the gallery’s moonfall_stairs fences the stairway between the Antechamber and Moonfall: whatever of Moonfall’s fence lies outside of its hall', () => {
  const fence = slopGallery.geofences.get('moonfall_stairs')!
  const [hall, stairway] = slopGallery.room('moonfall').fence.boxes
  const eastX = lowerGallery.moonfall.center[0] + lowerGallery.moonfall.size[0] / 2
  let treads = 0
  // In columns over and around the stairway’s footprint, off the planes the boxes end on
  for (let x = stairwayFootprint.x - 1.03; x < stairwayFootprint.x2 + 1.03; x += 0.31) {
    for (let z = stairwayFootprint.z - 1.03; z < stairwayFootprint.z2 + 1.03; z += 0.31) {
      for (const y of [-12, -7.1, -2.1, -1.9, 0.9, 9]) {
        const position: Vec3 = [x, y, z]
        expect(fence.contains(position)).toBe(stairway.contains(position) && !hall.contains(position))
      }
      // Wherever a body is on its flights and its turn, standing, crouching or jumping
      const floor = stairFloorHeight(x, z)
      if (floor === undefined) {
        continue
      }
      treads++
      for (const height of bodyHeights) {
        const position: Vec3 = [x, floor + height, z]
        expect(slopGallery.geofences.getMatches(position)).toEqual(['moonfall', 'moonfall_stairs'])
        expect(slopGallery.roomAt(position)?.id).toBe('moonfall')
      }
    }
  }
  expect(treads).toBeGreaterThan(500)
  // It begins in the plane of the Antechamber’s east wall, where the upper flight sets out, and ends in the plane of Moonfall’s east wall, where the lower flight arrives.
  const [topX, topY, topZ] = [stairwayFootprint.x, 0.9, stairwayFootprint.z + 1.3]
  expect(slopGallery.geofences.getMatches([topX - 0.01, topY, topZ])).toEqual(['antechamber'])
  expect(slopGallery.geofences.getMatches([topX + 0.01, topY, topZ])).toEqual(['moonfall', 'moonfall_stairs'])
  const [footY, footZ] = [lowerGallery.floorY + 0.9, lowerGallery.moonfall.center[1]]
  expect(slopGallery.geofences.getMatches([eastX + 0.01, footY, footZ])).toEqual(['moonfall', 'moonfall_stairs'])
  expect(slopGallery.geofences.getMatches([eastX - 0.01, footY, footZ])).toEqual(['moonfall'])
  // Not the hall under where the upper flight sets out
  expect(slopGallery.geofences.getMatches([topX + 1, footY, topZ])).toEqual(['moonfall'])
  // Moonfall’s visitors arrive on its lower flight, in the fence.
  const [x, y, z] = slopGallery.room('moonfall').spawn.position
  expect(stairFloorHeight(x, z)).toBeDefined()
  expect(fence.contains([x, y + 0.9, z])).toBe(true)
})
test('the gallery’s bastion_cistern fences the Bastion’s cistern, within the Bastion’s fence, behind the flat wall it shares with the Forge’s vestibule and the approach', () => {
  const fence = slopGallery.geofences.get('bastion_cistern')!
  const bastion = slopGallery.room('bastion').fence
  const [centerX, wallZ] = cistern.center
  let floors = 0
  // Wherever a body is on its floor, standing, crouching or jumping
  for (let x = centerX - cistern.radius - 0.53; x < centerX + cistern.radius + 0.53; x += 0.31) {
    for (let z = wallZ - cistern.radius - 0.53; z < wallZ; z += 0.31) {
      const floor = cisternFloor(x, z)
      if (floor === undefined) {
        continue
      }
      floors++
      for (const height of bodyHeights) {
        const position: Vec3 = [x, floor + height, z]
        // The Bastion’s, and in its west the Lodge’s, whose fence reaches up through its roof
        expect(slopGallery.geofences.getMatches(position).filter(id => id !== 'lodge')).toEqual(['bastion', 'bastion_cistern'])
        expect(slopGallery.roomAt(position)?.id).toBe('bastion')
      }
    }
  }
  expect(floors).toBeGreaterThan(500)
  // Its boxes are the Bastion’s own around the cistern, but for the rounding of the Bastion’s way from its origin and back, so the Bastion’s fence holds all of it.
  expect(fence.boxes).toHaveLength(cisternChunks().length)
  for (const box of fence.boxes) {
    const twins = bastion.boxes.filter(candidate => sides(candidate).every(([side, value], index) => side === sides(box)[index][0] && Math.abs(value - sides(box)[index][1]) < 1e-9))
    expect(twins).toHaveLength(1)
  }
  // It begins in the plane of its flat wall, which the window from the Forge’s vestibule leads through.
  const [windowX] = cisternWindow.center
  expect(slopGallery.geofences.getMatches([windowX, 1.6, wallZ + 0.3])).toEqual(['forge'])
  expect(slopGallery.geofences.getMatches([windowX, 1.6, wallZ - 0.3])).toEqual(['bastion', 'bastion_cistern'])
  // Neither the Bastion’s approach in front of that wall, nor the Lodge under its floor, nor anything over its dome
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
test('the gallery’s bastion_gate fences the Bastion’s curve behind the gate in the crown of the Oculus’ apse, within the Bastion’s fence, north of the gate', () => {
  const fence = slopGallery.geofences.get('bastion_gate')!
  const bastion = slopGallery.room('bastion').fence
  const gate = apseOpenings.find(({name}) => name === 'gate')!
  const [, gateZ] = apseOpeningPoint(gate)
  const {route, width} = bastionCurve
  let inside = 0
  // Wherever a body is on the curve, standing, crouching or jumping: north of the gate in the fence, south of it not
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
  // Behind the gate and both windows, where they look out over the platform
  const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
  for (const opening of apseOpenings) {
    const [x, z] = apseOpeningPoint(opening, 1.2)
    expect(slopGallery.geofences.getMatches([x, platformY + 0.9, z])).toEqual(['bastion', 'bastion_gate'])
  }
  // Neither the apse in front of the gate, nor the floor under the curve, nor anything over its vault
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
test('the gallery’s corridor_window fences the Corridor’s long hall abreast of the Lodge’s west window, within the Corridor’s fence, from wall to glass', () => {
  const fence = slopGallery.geofences.get('corridor_window')!
  const reach = lodgeWindow.width / 2 + 1
  const westX = corridor.center[0] - corridor.size[0] / 2
  // Wherever a body is in the hall from a meter north of the window to a meter south of it, standing, crouching or jumping
  for (let z = lodgeWindow.z - reach + 0.05; z < lodgeWindow.z + reach; z += 0.1) {
    for (let x = westX + 0.35; x < lodgeWindow.tunnelX - 0.3; x += 0.25) {
      for (const height of [0.05, 0.9, 1.75, 2.7]) {
        expect(slopGallery.geofences.getMatches([x, corridor.floorY + height, z])).toEqual(['corridor', 'corridor_window'])
      }
    }
  }
  // Just beyond it along the hall, the Corridor’s alone
  for (const side of [-1, 1]) {
    expect(slopGallery.geofences.getMatches([corridor.center[0], corridor.floorY + 0.9, lodgeWindow.z + side * (reach + 0.01)])).toEqual(['corridor'])
  }
  // Not the window’s niche behind its glass, which is the Lodge’s, nor the ground under the hall, nor anything over its crown
  expect(fence.contains([lodgeWindow.tunnelX + 0.05, lodgeWindow.bottom + 0.2, lodgeWindow.z])).toBe(false)
  expect(fence.contains([corridor.center[0], corridor.floorY - 1.5, lodgeWindow.z])).toBe(false)
  expect(fence.contains([corridor.center[0], corridor.floorY + corridor.height + 1, lodgeWindow.z])).toBe(false)
  // The Corridor’s fence holds all of it.
  const corridorFence = slopGallery.room('corridor').fence
  const [box] = dumped('corridor_window')
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
