import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Box2, ExtrudeGeometry, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector2, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry, wallFace} from '../../src/lib/gallery/architecture.ts'
import {vaultShellThickness} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionClearance, bastionDoorway} from '../../src/lib/gallery/bastion.ts'
import {bastionLinkGate, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import {insideCisternPlan} from '../../src/lib/gallery/cistern/cistern.ts'
import {climbApproach, climbArch, climbCrossfall, climbCulvert, climbDoorway, climbDrain, climbHairpin, climbLanterns, climbMouth, climbRun} from '../../src/lib/gallery/climb.ts'
import {easedRampGradient} from '../../src/lib/gallery/easedRamp.ts'
import {insidePolygon, slabHulls} from '../../src/lib/gallery/floorPolygons.ts'
import forge, {forgeVestibule} from '../../src/lib/gallery/forge.ts'
import {forgeRoundVestibule, vestibuleArches} from '../../src/lib/gallery/forgeVestibule.ts'
import lodge from '../../src/lib/gallery/lodge.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import tower, {towerBridge, towerFloorHeight} from '../../src/lib/gallery/oculusTower.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import roundRevealGeometry from '../../src/lib/gallery/roundRevealGeometry.ts'
import {roundVestibuleFloorShape, vestibuleArchOpening} from '../../src/lib/gallery/roundVestibule.ts'
import {vesper} from '../../src/lib/gallery/vesper.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {insideOpening, wallCoordinates, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'
import {addOculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
const {route} = climbHairpin
/** the climb’s routed passages, from the hairpin up to the vestibule */
const routed = [climbHairpin, climbRun, climbApproach] as const
const routeVaults = routed.map(passage => new RouteVaultGeometry(passage))
const mouthVault = new VaultGeometry(climbMouth)
const sunkenPaving = climbMouthHollow.geometry()
const ground = new OculusGroundGeometry
const wallById = (id: string) => walls.find(wall => wall.id === id)!
const architecture = walls.filter(wall => wall.room === 'bastion' || ['forge-north', 'forge-vestibule', 'oculus-west'].includes(wall.id)).map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
const vestibuleWall = wallById('forge-vestibule')
const vestibuleFloor = new ExtrudeGeometry(roundVestibuleFloorShape(forgeRoundVestibule), {
  depth: 0.24,
  bevelEnabled: false,
  curveSegments: 96,
})
vestibuleFloor.rotateX(-Math.PI / 2).translate(forgeVestibule.center[0], -0.24, forgeVestibule.center[1])
const vestibulePlacement = new Matrix4
vestibulePlacement.makeRotationY(vestibuleWall.rotation).setPosition(...vestibuleWall.center)
/** the vestibule’s floor slab and the reveals of its arches, in world meters */
const vestibuleParts = [
  vestibuleFloor,
  ...vestibuleArches.map(arch => {
    const reveal = roundRevealGeometry(vestibuleWall, vestibuleWall.holes!.find(hole => hole.name === arch.name)!, vestibuleArchOpening(forgeRoundVestibule, arch))
    return reveal.applyMatrix4(vestibulePlacement)
  }),
]
afterAll(() => {
  for (const vault of [...routeVaults, mouthVault]) {
    vault.dispose()
  }
  sunkenPaving.dispose()
  ground.dispose()
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
  for (const geometry of vestibuleParts) {
    geometry.dispose()
  }
})
/** how steeply the hairpin’s floor climbs `along` meters down it, over 2 cm */
const slope = (along: number) => (route.at(along + 0.01).y - route.at(along - 0.01).y) / 0.02
/** stations every half meter along the hairpin’s center line */
const stations = Array.from({length: Math.floor(route.length / 0.5) + 1}, (_, i) => route.at(i * 0.5))
/** the corners of the mouth’s path after its start, which a player walks round carefully */
const elbows = climbMouth.path.slice(1).map(([x, z]): readonly [number, number, boolean] => [x, z, true])
/** the rectangle on the floor plan round the points, in x and z */
const area = (points: ReadonlyArray<readonly [number, number]>) => {
  const box = new Box2
  return box.setFromPoints(points.map(([x, z]) => new Vector2(x, z)))
}
/** stations every half meter along a routed passage’s center line */
const along = (passage: typeof routed[number]) => Array.from({length: Math.floor(passage.route.length / 0.5) + 1}, (_, i) => passage.route.at(i * 0.5))
/** points every half meter along the mouth’s center line, with its floor height */
const mouthPoints = climbMouth.spans.flatMap(({start, end, length}) => Array.from({length: Math.floor(length / 0.5) + 1}, (_, i) => {
  const share = i * 0.5 / length
  return [start[0] + (end[0] - start[0]) * share, climbMouth.floorY, start[1] + (end[1] - start[1]) * share] as const
}))
describe('the Bastion’s way from the Oculus up to the Forge', () => {
  test('its passages join end to end, from the doorway at the west bridge to the west arch of the Forge’s vestibule', () => {
    expect(climbDoorway).toEqual({
      ...bastionDoorway,
      x: -bastionDoorway.x,
    })
    expect(climbMouth.path[0]).toEqual([climbDoorway.x, climbDoorway.z])
    expect(route.start).toEqual(climbMouth.path.at(-1)!)
    for (const [before, after] of [[climbHairpin, climbRun], [climbRun, climbApproach]] as const) {
      expect(before.route.end.point[0]).toBeCloseTo(after.route.start[0], 9)
      expect(before.route.end.point[1]).toBeCloseTo(after.route.start[1], 9)
      expect(before.route.end.heading).toBeCloseTo(after.route.heading, 9)
    }
    expect(route.end.heading).toBeCloseTo(-Math.PI / 2, 9)
    // Round its turn and straight east at the vestibule’s middle, up to where the plane touching its wall there crosses the line
    const [turn, strip] = climbApproach.route.pieces
    expect([turn.kind, strip.kind]).toEqual(['arc', 'line'])
    expect(climbApproach.route.end.point[0]).toBeCloseTo(forgeVestibule.center[0] - forgeVestibule.radius, 9)
    expect(climbApproach.route.end.point[1]).toBeCloseTo(forgeVestibule.center[1], 9)
    expect(climbApproach.route.end.heading).toBeCloseTo(0, 9)
    expect(strip.kind === 'line' && strip.start[1]).toBeCloseTo(forgeVestibule.center[1], 9)
    // From the west bridge’s end up to the Forge’s floor
    expect(climbMouth.floorY).toBeCloseTo(tower.floorY + tower.height + towerBridge.rise, 9)
    expect(route.y).toBe(climbMouth.floorY)
    expect(route.height).toBe(climbMouth.height)
    // The hairpin tops out half a meter under it; the run eases up the rest of the way to the approach, which runs on level.
    expect(route.end.y).toBe(-0.5)
    expect(climbRun.route.y).toBe(route.end.y)
    expect(climbRun.route.end.y).toBe(0)
    expect(climbRun.route.pieces.every(piece => piece.startHeight === 3.1 && piece.endHeight === 3.1)).toBe(true)
    expect(climbApproach.route.pieces.every(piece => piece.startY === 0 && piece.endY === 0 && piece.startHeight === 3.1 && piece.endHeight === 3.1)).toBe(true)
    // As wide as the Bastion all the way to the vestibule
    expect([climbMouth.width, climbHairpin.width, climbRun.width, climbApproach.width]).toEqual([4, 4, 4, 4])
  })
  test('the hairpin eases up by the whole climb over its two legs and its turn, no steeper than 1 in 4', () => {
    const [west, turn, east] = route.pieces
    expect([west.kind, turn.kind, east.kind]).toEqual(['line', 'arc', 'line'])
    expect(west.length).toBeCloseTo(east.length, 9)
    expect(turn.kind === 'arc' && Math.abs(turn.sweep)).toBeCloseTo(Math.PI, 9)
    expect(west.ramp).toBe(turn.ramp)
    expect(turn.ramp).toBe(east.ramp)
    const ramp = west.ramp!
    expect([ramp.from, ramp.length]).toEqual([0, route.length])
    expect([ramp.startY, ramp.endY]).toEqual([climbMouth.floorY, route.end.y])
    expect(Math.abs(slope(0.02))).toBeLessThan(0.025)
    expect(Math.abs(slope(route.length - 0.02))).toBeLessThan(0.025)
    expect((route.end.y - climbMouth.floorY) * easedRampGradient(route.length / 2, route.length)).toBeCloseTo(0.25, 9)
    let previous = climbMouth.floorY
    for (let distance = 0; distance <= route.length; distance += 0.05) {
      const {y} = route.at(distance)
      expect(y - previous).toBeGreaterThanOrEqual(0)
      expect(y - previous).toBeLessThanOrEqual(0.25 * 0.05 + 1e-9)
      previous = y
    }
  })
  test('navigation follows its floors and fences the whole way, the run north over the mouth and over the Lodge included', () => {
    for (const [x, y, z] of mouthPoints) {
      const position: Vec3 = [x, y + 1.6, z]
      expect(climbMouth.floorAt(x, z)).toBe(y)
      expect(insideGallery(position)).toBe(true)
      expect(floorHeight(position)).toBeCloseTo(y, 6)
      expect(roomAt(position)).toBe('bastion')
    }
    for (const passage of routed) {
      for (const station of along(passage)) {
        const {point: [x, z], y} = station
        // its paving, falling toward its middle along the hairpin
        const floor = y - passage.sag(station, 0)
        const position: Vec3 = [x, floor + 1.6, z]
        expect(passage.floorAt(x, z)).toBeCloseTo(floor, 6)
        expect(insideGallery(position)).toBe(true)
        // Where it meets the next passage, the higher floor of both counts.
        if (station.along > 0.05 && station.along < passage.route.length - 0.05) {
          expect(floorHeight(position)).toBeCloseTo(floor, 6)
        }
        expect(roomAt(position)).toBe('bastion')
      }
    }
    // Where the run crosses over the mouth, the floor under a player is the one they stand on.
    const [crossingX] = climbRun.route.start
    const crossingZ = climbDoorway.z
    expect(floorHeight([crossingX, 1.6, crossingZ])).toBeCloseTo(climbRun.floorAt(crossingX, crossingZ)!, 6)
    expect(floorHeight([crossingX, climbMouth.floorY + 1.6, crossingZ])).toBe(climbMouth.floorY)
    expect(roomAt([crossingX, 1.6, crossingZ])).toBe('bastion')
    expect(roomAt([crossingX, climbMouth.floorY + 1.6, crossingZ])).toBe('bastion')
    // Over the Lodge, the run is the climb’s and the room under it stays the Lodge’s.
    const overLodge: Vec3 = [crossingX, 1.6, lodge.center[1] + lodge.size[1] / 2 - 0.5]
    expect(roomAt(overLodge)).toBe('bastion')
    expect(roomAt([overLodge[0], lodge.floorY + 1.6, overLodge[2]])).toBe('lodge')
    expect(floorHeight(overLodge)).toBeCloseTo(climbRun.floorAt(overLodge[0], overLodge[2])!, 6)
  })
  test('the run north clears the Lodge’s roof and the mouth’s vault, and the approach and the Forge’s vestibule the Bastion’s vaults, the approach keeping off the Forge’s walls', () => {
    // The Lodge’s ceiling slab tops out 24 cm over its height; the run’s and the approach’s paving hangs 24 cm under their floor.
    const lodgeSouthZ = lodge.center[1] + lodge.size[1] / 2
    const overLodge = along(climbRun).filter(({point: [, z]}) => z < lodgeSouthZ + wallFace)
    expect(overLodge.length).toBeGreaterThan(0)
    expect(Math.min(...overLodge.map(({y}) => y)) - 0.24).toBeGreaterThan(lodge.floorY + lodge.height + 0.24 + 0.3)
    // Where the run falls lowest, over the mouth, its paving still clears the mouth’s vault and the slab over it.
    const overMouth = along(climbRun).filter(({point: [, z]}) => Math.abs(z - climbDoorway.z) < climbMouth.width / 2 + vaultShellThickness)
    expect(overMouth.length).toBeGreaterThan(0)
    expect(Math.min(...overMouth.map(({y}) => y)) - 0.24).toBeGreaterThan(climbMouth.floorY + climbMouth.height + Math.max(vaultShellThickness, 0.24) + 0.2)
    // The Bastion’s air under the approach and the vestibule reaches up to the crowns of its vaults, whose shells stand 22 cm higher and whose slabs over them 24 cm.
    const {center: [vestibuleX, vestibuleZ], radius} = forgeVestibule
    const above = [...climbApproach.chunks(0).map(({min, max}) => area([[min[0], min[2]], [max[0], max[2]]])), area([[vestibuleX - radius, vestibuleZ - radius], [vestibuleX + radius, vestibuleZ + radius]])]
    const below = slopGallery.room('bastion').air.filter(box => box.max.y < climbApproach.route.y && above.some(region => region.intersectsBox(area([[box.min.x, box.min.z], [box.max.x, box.max.z]]))))
    expect(below.length).toBeGreaterThan(0)
    expect(Math.max(...below.map(box => box.max.y)) + Math.max(vaultShellThickness, 0.24) + 0.3).toBeLessThan(climbApproach.route.y - 0.24)
    // All round its turn and along its strip, the approach’s walls keep the Bastion’s clearance off the Forge’s, as the run does along its west wall.
    const [west, east] = [forge.center[0] - forge.size[0] / 2, forge.center[0] + forge.size[0] / 2]
    const [north, south] = [forge.center[1] - forge.size[1] / 2, forge.center[1] + forge.size[1] / 2]
    for (const station of along(climbApproach)) {
      for (const side of [-1, 1]) {
        const reach = climbApproach.reach(station, side)
        const [x, z] = [station.point[0] - Math.sin(station.heading) * side * reach, station.point[1] + Math.cos(station.heading) * side * reach]
        const apart = Math.hypot(Math.max(west - x, 0, x - east), Math.max(north - z, 0, z - south))
        expect(apart).toBeGreaterThanOrEqual(bastionClearance - 1e-9)
      }
    }
    // Behind the Forge’s west wall, the hairpin’s east leg keeps the Bastion’s clearance, and the turn stays off the Vesper’s.
    expect(west - (route.end.point[0] + climbHairpin.width / 2)).toBeCloseTo(0.3, 9)
    const vesperWestX = vesper.center[0] - vesper.size[0] / 2
    for (const station of stations) {
      for (const side of [-1, 1]) {
        const reach = climbHairpin.reach(station, side)
        expect(station.point[0] - Math.sin(station.heading) * side * reach).toBeLessThanOrEqual(vesperWestX - 0.3 + 1e-9)
      }
    }
  })
  test('beside the passages, behind their walls, lies neither the climb nor anything else', () => {
    for (const passage of routed) {
      for (const station of along(passage)) {
        const {point: [x, z], heading, y} = station
        for (const side of [-1, 1]) {
          const out = passage.reach(station, side) + 0.2
          const beside: Vec3 = [x - Math.sin(heading) * side * out, y + 1.6, z + Math.cos(heading) * side * out]
          expect(passage.floorAt(beside[0], beside[2])).toBeUndefined()
          // Its strip runs into the vestibule’s arch, where the Forge begins, and behind the approach’s north wall lies the Bastion’s cistern.
          if (passage !== climbApproach || station.along < passage.route.length - 0.3) {
            expect(insideGallery(beside)).toBe(passage === climbApproach && insideCisternPlan(beside[0], beside[2]))
          }
        }
      }
    }
  })
  test('the approach turns on from the run as wide as it, widening out into the corner behind its turn: its north wall closes the run across its whole width, facing down it, with the cistern’s culvert in its middle, and a chamfer leads back to the strip’s north wall', () => {
    expect(walls.some(wall => wall.id === 'bastion-climb_screen')).toBe(false)
    expect([...climbRun.walls, ...climbApproach.walls].every(wall => wall.cornice === false)).toBe(true)
    // Where the run ends, the approach’s walls stand where the run’s do.
    const start = climbApproach.route.at(0)
    expect([-1, 1].map(side => climbApproach.reach(start, side))).toEqual([climbRun.width / 2, climbRun.width / 2])
    expect(climbApproach.route.height).toBe(climbArch.height)
    const [runX] = climbRun.route.end.point
    const northWallZ = forgeVestibule.center[1] - forgeVestibule.radius
    // The outline’s walls come first, in its first piece’s place.
    const [west, north, chamfer] = climbApproach.walls
    expect(west.center[0]).toBeCloseTo(runX - climbRun.width / 2, 9)
    expect(north.center[0]).toBeCloseTo(runX, 9)
    expect(north.center[2]).toBeCloseTo(northWallZ, 9)
    expect(north.width).toBeCloseTo(climbRun.width, 9)
    expect(north.rotation).toBeCloseTo(0, 9)
    expect(chamfer.rotation).toBeCloseTo(-Math.PI / 4, 9)
    expect(north.holes!.map(hole => hole.name)).toEqual(['cistern'])
    expect(north.holes![0].u).toBeCloseTo(climbCulvert.x - north.center[0], 9)
    // Its floor reaches into the corner behind the turn and on to the north wall, and nowhere past it.
    expect(climbApproach.floorAt(runX - climbRun.width / 2 + 0.2, northWallZ + 0.2)).toBe(0)
    expect(climbApproach.floorAt(runX, northWallZ + 0.05)).toBe(0)
    expect(climbApproach.floorAt(runX, northWallZ - 0.05)).toBeUndefined()
    // Facing down the run, half a meter in front of the culvert lies the approach’s floor, with the drain the culvert spills into.
    const [frontX, , frontZ] = wallPosition(north, north.holes![0].u, 0, 0.5)
    expect(climbApproach.floorAt(frontX, frontZ)).toBe(0)
    expect(climbApproach.drains).toHaveLength(1)
    // The paving that shows is cut round the drain, the one that collides runs on under its grate.
    const vault = routeVaults[2]
    expect(vault.paving).not.toBe(vault.pavingCollision)
    const down = new Vector3(0, -1, 0)
    const [drainX, drainZ] = climbDrain.center
    const hits = (geometry: typeof vault.paving) => {
      const material = new MeshBasicMaterial
      try {
        const ray = new Raycaster(new Vector3(drainX, 1, drainZ), down)
        return ray.intersectObject(new Mesh(geometry, material)).length > 0
      } finally {
        material.dispose()
      }
    }
    expect(hits(vault.paving)).toBe(false)
    expect(hits(vault.pavingCollision)).toBe(true)
  })
  test('the run north falls gently toward the hairpin, no steeper than 1 in 10, so orbs drifting out of the cistern roll on down it, and lies level for its last meter before the approach', () => {
    let previous = climbRun.route.y
    for (let distance = 0.05; distance <= climbRun.route.length; distance += 0.05) {
      const {y} = climbRun.route.at(distance)
      expect(y - previous).toBeGreaterThanOrEqual(0)
      expect(y - previous).toBeLessThanOrEqual(0.05 / 10)
      previous = y
    }
    expect(climbRun.route.pieces.at(-1)).toMatchObject({
      kind: 'line',
      length: 1,
      startY: 0,
      endY: 0,
    })
  })
  test('the hairpin’s paving falls 1 in 11 from the faces of its walls toward its middle, easing out to meet the run’s level floor at its top, while the run’s and the approach’s lie level across', () => {
    expect(climbHairpin.crossfall?.slope).toBe(climbCrossfall)
    expect(climbCrossfall).toBe(1 / 11)
    const half = climbHairpin.width / 2 - wallFace
    for (const station of stations) {
      // short of the top, where it eases out
      if (station.along > route.length - 2) {
        continue
      }
      expect(climbHairpin.sag(station, 0)).toBeCloseTo(climbCrossfall * half, 9)
      expect(climbHairpin.sag(station, half / 2)).toBeCloseTo(climbCrossfall * half / 2, 9)
      expect(climbHairpin.sag(station, -half)).toBe(0)
    }
    expect(climbHairpin.sag(route.end, 0)).toBe(0)
    for (const passage of [climbRun, climbApproach]) {
      expect(passage.crossfall).toBeUndefined()
    }
    // Its paving bends down to its middle with its crossfall, at its foot as all along.
    const position = routeVaults[0].paving.getAttribute('position')
    const [footX, footZ] = route.start
    let lowest = Infinity
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getZ(i) - footZ) < 1e-4 && Math.abs(position.getX(i) - footX) < 1e-4) {
        lowest = Math.min(lowest, position.getY(i))
      }
    }
    expect(lowest).toBeCloseTo(route.y - climbCrossfall * half, 5)
  })
  test('in the mouth’s elbow, the paving falls on from the hairpin’s foot toward the tunnel’s mouth and has sunk into a hollow toward the gate’s hatch, level along its walls and where it opens east', () => {
    const {hatch, wall} = bastionLinkGate
    const hatchX = wall.center[0] + hatch.u
    const mouthNorthZ = climbMouth.path[0][1] - climbMouth.width / 2
    const [footX, footZ] = route.start
    const mouthWestX = footX - climbMouth.width / 2
    const elbowEastX = footX + climbMouth.width / 2
    // The fall runs on from the hairpin’s foot, as deep along its middle, and bends to meet the middle of the tunnel’s mouth.
    for (let right = -2; right <= 2; right += 0.1) {
      expect(climbMouthHollow.sink(footX + right, footZ)).toBeCloseTo(climbHairpin.sag(route.at(0), -right) + climbMouthHollow.hollowAt(footX + right, footZ), 9)
    }
    expect(climbMouthHollow.hollowAt(footX, footZ)).toBe(0)
    expect(climbMouthHollow.sink(hatchX, mouthNorthZ) - climbMouthHollow.hollowAt(hatchX, mouthNorthZ)).toBeCloseTo(climbCrossfall * (climbMouth.width / 2 - wallFace), 9)
    // Deepest just beyond the gate, under the hatch, where it steps down onto the tunnel’s floor
    expect(climbMouthHollow.hollowAt(hatchX, mouthNorthZ)).toBeGreaterThan(0.1)
    expect(climbMouthHollow.hollowAt(hatchX, mouthNorthZ - 0.3)).toBeGreaterThan(climbMouthHollow.hollowAt(hatchX, mouthNorthZ))
    expect(climbMouthHollow.outletY).toBeLessThan(climbMouth.floorY - climbMouthHollow.sink(hatchX, mouthNorthZ))
    // Sloping down toward the hatch from across the elbow, so whatever rolls in it ends up there
    for (const [x, z] of [[hatchX + 0.8, mouthNorthZ + 0.3], [hatchX + 1.5, mouthNorthZ + 1], [hatchX, mouthNorthZ + 2], [mouthWestX + 0.4, mouthNorthZ + 1.5]] as const) {
      expect(climbMouthHollow.sink(x, z)).toBeGreaterThan(0)
      expect(climbMouthHollow.sink(x + (hatchX - x) * 0.2, z + (mouthNorthZ - z) * 0.2)).toBeGreaterThan(climbMouthHollow.sink(x, z))
    }
    // Level with the floor along the faces of its walls and where the elbow opens onto the straight run east
    for (let share = 0; share <= 1; share += 0.01) {
      expect(climbMouthHollow.sink(mouthWestX + wallFace, mouthNorthZ + share * 4.8)).toBeLessThan(1e-12)
      expect(climbMouthHollow.sink(elbowEastX - wallFace, mouthNorthZ + share * 4.8)).toBeLessThan(1e-12)
      const x = mouthWestX + share * 4
      if (Math.abs(x - hatchX) >= bastionLinkGate.hole.width / 2) {
        expect(climbMouthHollow.sink(x, mouthNorthZ + wallFace)).toBeLessThan(1e-12)
      }
    }
    // Its surface takes up the whole elbow, cut out of the mouth’s floors, which close round it.
    expect(climbMouthHollow.footprint).toEqual({
      center: [footX, (mouthNorthZ + footZ) / 2],
      size: [climbMouth.width, footZ - mouthNorthZ],
    })
    const {center: [cx, cz], size: [width, depth]} = climbMouthHollow.footprint
    const cut = climbMouth.floors.flatMap(floor => climbMouthHollow.cut(floor))
    const inFloors = (x: number, z: number) => cut.some(floor => insidePolygon(floor, x, z))
    expect(inFloors(cx, cz)).toBe(false)
    expect(inFloors(footX, footZ - 0.1)).toBe(false)
    expect(inFloors(elbowEastX + 0.2, cz)).toBe(true)
    expect(inFloors((climbDoorway.x + elbowEastX) / 2, climbDoorway.z)).toBe(true)
    // Its surface meets the floor round it along its edges and reaches down to the tunnel’s floor under the gate.
    const position = sunkenPaving.getAttribute('position')
    let lowest = Infinity
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)]
      lowest = Math.min(lowest, y)
      // as precise as its 32-bit floats, out in front of the wall, where the step down under the gate isn’t
      if (z > cz - depth / 2 + 1e-5 && (Math.abs(x - (cx - width / 2)) < 1e-5 || Math.abs(x - (cx + width / 2)) < 1e-5)) {
        expect(y).toBeCloseTo(climbMouth.floorY, 5)
      }
      // and along the hairpin’s foot, its paving’s
      if (Math.abs(z - (cz + depth / 2)) < 1e-5) {
        expect(y).toBeCloseTo(climbHairpin.floorAt(x, z + 1e-4)!, 4)
      }
    }
    expect(lowest).toBeLessThan(climbMouthHollow.outletY)
  })
  test('the doorways at both ends match the passages that lead through them', () => {
    const oculusWest = wallById('oculus-west')
    const climb = oculusWest.holes!.find(hole => hole.name === 'bastion')!
    const bastion = wallById('oculus-east').holes!.find(hole => hole.name === 'bastion')!
    // The Bastion’s doorway mirrored: the same opening, measured the other way along its wall
    expect<typeof bastion>({
      ...climb,
      name: 'bastion',
      u: -climb.u,
    }).toEqual(bastion)
    expect(wallPosition(oculusWest, climb.u, 0, 0)[2]).toBeCloseTo(climbDoorway.z, 9)
    // The vestibule’s west arch, where the approach ends, spans as much straight across between its jambs as the approach’s arch, and is as high.
    const arch = vestibuleWall.holes!.find(hole => hole.name === 'bastion')!
    const [endX, endZ] = climbApproach.route.end.point
    const [x, , z] = wallPosition(vestibuleWall, arch.u, 0, 0)
    expect(x).toBeCloseTo(endX, 9)
    expect(z).toBeCloseTo(endZ, 9)
    const jambs = [-1, 1].map(side => wallPosition(vestibuleWall, arch.u + side * arch.width / 2, 0, 0))
    expect(Math.abs(jambs[0][2] - jambs[1][2])).toBeCloseTo(climbArch.width, 9)
    expect([arch.height, arch.profile]).toEqual([climbArch.height, climbArch.profile])
    expect(insideOpening(arch, wallCoordinates(vestibuleWall, [endX + 0.1, 0, endZ]), 1.7)).toBe(true)
    expect(roomAt([endX + 0.05, 1.7, endZ])).toBe('forge')
    expect(roomAt([endX - 0.05, 1.7, endZ])).toBe('bastion')
  })
  test('its lanterns hang between the hairpin’s ribs and its lamps under them', () => {
    for (const hung of Object.values(climbLanterns)) {
      expect(climbHairpin.ribs.some(rib => Math.abs(rib - hung) < 0.3)).toBe(false)
    }
    const ids = ['climb', 'elbow', 'mouth', 'run', 'strip', 'turn', 'west'].map(id => `bastion-lantern_${id}`)
    const lamps = slopGallery.room('bastion').lamps().filter(({id}) => ids.includes(id))
    expect(lamps.map(({id}) => id).toSorted()).toEqual(ids)
    for (const {position} of lamps) {
      expect(roomAt(position)).toBe('bastion')
      // Under the crown, over a person’s head, even over the middle of the hairpin, where its paving falls lowest
      expect(position[1] - floorHeight(position)).toBeGreaterThan(1.7)
      expect(position[1] - floorHeight(position)).toBeLessThan(2.4)
    }
  })
  for (const sprint of [false, true]) {
    for (const returning of [false, true]) {
      test(`a player walks from the west bridge through the doorway up the hairpin, round into the Forge’s vestibule and on into the Forge, sprint ${sprint}, returning ${returning}`, () => {
        const world = new RAPIER.World({
          x: 0,
          y: -9.81,
          z: 0,
        })
        const fps = 60
        world.timestep = 1 / fps
        for (const {wall, geometry} of architecture) {
          for (const args of geometry.collision) {
            const rotation = new Quaternion
            world.createCollider(RAPIER.ColliderDesc.trimesh(...args, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(...wall.center).setRotation(rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)))
          }
        }
        for (const geometry of [ground, ...routeVaults.flatMap(vault => [vault.shell, vault.ribs]), mouthVault.shell, mouthVault.ribs, ...vestibuleParts]) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry)))
        }
        // The paving and the mouth’s sunken paving welded, as the game builds them, like the walls
        for (const geometry of [...routeVaults.map(vault => vault.pavingCollision), sunkenPaving]) {
          const [vertices, indices] = colliderGeometry(geometry)
          world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin))
        }
        for (const floor of climbMouth.floors.flatMap(piece => climbMouthHollow.cut(piece))) {
          for (const corners of slabHulls(floor, climbMouth.floorY - 0.24, climbMouth.floorY)) {
            world.createCollider(RAPIER.ColliderDesc.convexHull(corners)!)
          }
        }
        world.createCollider(RAPIER.ColliderDesc.cuboid(forge.size[0] / 2, 0.12, forge.size[1] / 2).setTranslation(forge.center[0], -0.12, forge.center[1]))
        addOculusRailings(world)
        const bridgeX = tower.x - 5
        const bridge = towerFloorHeight(bridgeX, tower.z)!
        // Through the doorway and round every elbow like a player, at a walk; the straight stretches at a sprint if asked.
        const path: Array<readonly [x: number, z: number, careful?: boolean]> = [
          [bridgeX, tower.z],
          [climbDoorway.x - 0.6, tower.z, true],
          ...elbows,
          ...stations.filter((_, i) => i % 2 === 0).map(({point}) => point),
          ...[climbRun, climbApproach].flatMap(passage => along(passage).filter((_, i) => i % 2 === 0).map(({point}): readonly [number, number, boolean] => [...point, true])),
          // Through the vestibule’s middle and out through the arch in the Forge’s north wall
          [forgeVestibule.center[0], forgeVestibule.center[1], true],
          [forge.center[0], forge.center[1] - 3],
        ]
        if (returning) {
          path.reverse()
        }
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], (returning ? 0 : bridge) + 0.04, path[0][1]))
        const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
        const motor = new EgoMotor(RAPIER, world, body, collider)
        const facing = new Quaternion
        try {
          let target = 1
          for (let i = 0; i < fps * 90 && target < path.length; i++) {
            const position = body.translation()
            const dx = path[target][0] - position.x
            const dz = path[target][1] - position.z
            if (Math.hypot(dx, dz) < Math.max(0.3, (sprint ? 8 : 3) / fps)) {
              target++
              continue
            }
            facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
            motor.step(world.timestep, {
              forward: true,
              sprint: sprint && !path[target][2],
            }, facing)
            world.step()
          }
          expect({
            target,
            position: body.translation(),
          }).toMatchObject({target: path.length})
          for (let i = 0; i < fps; i++) {
            motor.step(world.timestep, {}, facing)
            world.step()
          }
          const {x, z} = body.translation()
          expect(body.translation().y).toBeCloseTo((returning ? towerFloorHeight(x, z)! : 0) + 0.02, 2)
          expect(motor.grounded).toBe(true)
        } finally {
          motor.dispose()
          world.free()
        }
      })
    }
  }
})
