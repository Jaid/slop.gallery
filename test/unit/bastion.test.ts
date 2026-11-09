import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {corniceBands} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionApproach, bastionCurve, bastionDoorway, bastionMouth, bastionOrigin, bastionPassages, bastionTransition} from '../../src/lib/gallery/bastion.ts'
import {bastionLink, lodgeSpur} from '../../src/lib/gallery/bastionNetwork.ts'
import {easedRampGradient} from '../../src/lib/gallery/easedRamp.ts'
import {slabHulls} from '../../src/lib/gallery/floorPolygons.ts'
import lodge from '../../src/lib/gallery/lodge.ts'
import {oculusPlatform} from '../../src/lib/gallery/lowerGallery.ts'
import oculusApse, {apseArcs, insideApse} from '../../src/lib/gallery/oculusApse.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import tower, {towerBridge, towerFloorHeight} from '../../src/lib/gallery/oculusTower.ts'
import PassageRoute from '../../src/lib/gallery/passages/PassageRoute.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import VaultGeometry from '../../src/lib/gallery/passages/VaultGeometry.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'
import {addBastionCrater} from './helpers/bastionCrater.ts'
import {addOculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
const {route} = bastionCurve
const curve = new RouteVaultGeometry(bastionCurve)
const vaults = [new VaultGeometry(bastionMouth), curve, new VaultGeometry(bastionApproach, bastionTransition.length)]
const ground = new OculusGroundGeometry
const architecture = walls.filter(wall => wall.room === 'bastion' || wall.id === 'oculus-east').map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
afterAll(() => {
  for (const vault of vaults) {
    vault.dispose()
  }
  ground.dispose()
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
})
const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
/** how steeply the curve’s floor climbs `along` meters down it, over 2 cm */
const slope = (along: number) => (route.at(along + 0.01).y - route.at(along - 0.01).y) / 0.02
/** stations every half meter along the curve’s center line */
const stations = Array.from({length: Math.floor(route.length / 0.5) + 1}, (_, i) => route.at(i * 0.5))
describe('the Bastion’s route round the Oculus', () => {
  test('its three passages join end to end, from the doorway at the east bridge to the Lodge’s east wall', () => {
    expect(bastionMouth.path[0]).toEqual([bastionDoorway.x, bastionDoorway.z])
    expect(route.start).toEqual(bastionMouth.path.at(-1)!)
    expect(route.end.point[0]).toBeCloseTo(bastionApproach.path[0][0], 9)
    expect(route.end.point[1]).toBeCloseTo(bastionApproach.path[0][1], 9)
    expect(route.end.heading).toBeCloseTo(-Math.PI, 9)
    expect(bastionApproach.path.at(-1)).toEqual([lodge.center[0] + lodge.size[0] / 2, lodge.tunnelZ])
    // From the east bridge’s end at the doorway down to the platform round the apse and up to the Lodge’s floor
    expect(bastionMouth.floorY).toBeCloseTo(tower.floorY + tower.height + towerBridge.rise, 9)
    expect(route.y).toBe(bastionMouth.floorY)
    expect(route.height).toBe(bastionMouth.height)
    expect(route.end.y).toBeCloseTo(lodge.floorY, 9)
    expect(route.end.height).toBeCloseTo(bastionApproach.height, 9)
    expect(bastionApproach.floorY).toBe(lodge.floorY)
    for (const passage of bastionPassages) {
      expect(passage.width).toBe(4)
    }
    expect(bastionMouth.height).toBeCloseTo(2.64, 9)
    expect(bastionApproach.height).toBe(3.1)
  })
  test('the casing round the doorway’s arch runs up into the lower band of the Oculus’ cornice and ends flush with its top', () => {
    const wall = walls.find(value => value.id === 'oculus-east')!
    const hole = wall.holes!.find(value => value.name === 'bastion')!
    const [band] = corniceBands
    expect(hole.profile).toBe('arch')
    expect(hole.height + wallOpeningTrim).toBeCloseTo(wall.height - band.drop + band.height / 2, 9)
    // The opening itself stays under the band, which stands proud of the plain casing and hides its crown.
    expect(hole.height).toBeLessThan(wall.height - band.drop - band.height / 2)
    expect(band.front).toBeGreaterThan(0.25)
    expect(wall.center[1] + hole.height).toBeCloseTo(bastionDoorway.y + bastionDoorway.height, 9)
    const geometry = createArchitectureGeometry(wall)
    const material = new MeshBasicMaterial
    try {
      // Straight up from the floor through the doorway’s middle, the first thing above it is the casing’s crown, inside the band.
      const meshes = [...geometry.trim, ...geometry.cornice].map(part => new Mesh(part, material))
      const up = new Raycaster(new Vector3(hole.u, hole.height - 0.5, 0.2), new Vector3(0, 1, 0))
      const [crown] = up.intersectObjects(meshes)
      expect(crown.object).toBe(meshes[0])
      expect(crown.point.y).toBeCloseTo(hole.height, 3)
      // In front of the casing, the band covers the crown from where it enters the band to its top.
      const front = new Raycaster(new Vector3(hole.u, wall.height - band.drop, 1), new Vector3(0, 0, -1))
      expect(front.intersectObjects(meshes)[0].object).toBe(meshes[1])
    } finally {
      geometry.dispose()
      material.dispose()
    }
  })
  test('its curve keeps 30 cm behind the apse’s walls, round both shoulders and the crown', () => {
    const arcs = apseArcs()
    for (const piece of route.pieces.slice(1, 5)) {
      expect(piece.kind).toBe('arc')
      if (piece.kind !== 'arc') {
        continue
      }
      const arc = arcs.find(({center}) => Math.hypot(center[0] - piece.center[0], center[1] - piece.center[1]) < 1e-9)!
      expect(arc).toBeDefined()
      expect(piece.radius - bastionCurve.width / 2 - arc.radius).toBeCloseTo(0.3, 9)
    }
    for (const {point: [x, z]} of stations) {
      expect(insideApse(x, z, bastionCurve.width / 2)).toBe(false)
    }
  })
  test('navigation follows its floor, which eases down from the doorway into the turn round the east shoulder, stays at the platform’s level round the apse and eases up from the S bend to the Lodge’s', () => {
    for (const {point: [x, z], y} of stations) {
      expect(bastionCurve.floorAt(x, z)).toBeCloseTo(y, 6)
      const position: Vec3 = [x, y + 1.6, z]
      expect(insideGallery(position)).toBe(true)
      expect(floorHeight(position)).toBeCloseTo(y, 6)
      expect(roomAt(position)).toBe('bastion')
    }
    const [run, eastTurn, ...rest] = route.pieces
    const [bend, landing, climb] = rest.slice(-3)
    // The ramp down takes the whole run north and the start of the turn round the east shoulder, and the ramp up the run west, after the S bend and the landing, where the link opens.
    expect([run.kind, eastTurn.kind, bend.kind, landing.kind, climb.kind]).toEqual(['line', 'arc', 'arc', 'line', 'line'])
    expect(run.ramp).toBe(eastTurn.ramp)
    for (const piece of rest.slice(0, -1)) {
      expect(piece.ramp).toBeUndefined()
      expect([piece.startY, piece.endY]).toEqual([platformY, platformY])
      expect([piece.startHeight, piece.endHeight]).toEqual([5.2, 5.2])
    }
    for (const [ramp, from, to] of [[run.ramp!, bastionMouth.floorY, platformY], [climb.ramp!, platformY, lodge.floorY]] as const) {
      expect([ramp.startY, ramp.endY]).toEqual([from, to])
      // Longer than the straight ramps were, of 8.2 m and 3.9 m
      expect(ramp.length).toBeGreaterThan(Math.abs(to - from) / Math.tan(14.3 * Math.PI / 180))
      // All but level where it starts and where it ends, and halfway no steeper than 1 in 4, like the straight ramps were all along
      expect(Math.abs(slope(ramp.from + 0.02))).toBeLessThan(0.25 / 10)
      expect(Math.abs(slope(ramp.from + ramp.length - 0.02))).toBeLessThan(0.25 / 10)
      expect(Math.abs(to - from) * easedRampGradient(ramp.length / 2, ramp.length)).toBeCloseTo(0.25, 9)
      let previous = from
      for (let along = ramp.from; along <= ramp.from + ramp.length; along += 0.05) {
        const {y} = route.at(along)
        expect(Math.abs(y - previous)).toBeLessThanOrEqual(0.25 * 0.05 + 1e-9)
        expect((y - previous) * Math.sign(to - from)).toBeGreaterThanOrEqual(0)
        previous = y
      }
    }
    // What’s left of the approach past the climb is all timber transition.
    expect(bastionApproach.path[0][0] - bastionApproach.path[1][0]).toBeCloseTo(bastionTransition.length, 9)
    expect(bastionTransition.length).toBeGreaterThan(1)
  })
  test('beside the passage, behind its walls, lies neither the passage nor anything else', () => {
    for (const station of stations) {
      const {point: [x, z], heading, y} = station
      for (const side of [-1, 1]) {
        const out = bastionCurve.reach(station, side) + 0.2
        const beside: Vec3 = [x - Math.sin(heading) * side * out, y + 1.6, z + Math.cos(heading) * side * out]
        expect(bastionCurve.floorAt(beside[0], beside[2])).toBeUndefined()
        // but for the connecting tunnel opening off it and the blind branch beside the Lodge ending against it, back to back
        if (!bastionLink.contains(beside) && !lodgeSpur.contains(beside)) {
          expect(insideGallery(beside)).toBe(false)
        }
      }
    }
  })
  test('the apse belongs to the Oculus and the passage round it to the Bastion, also in the corners of the apse’s box', () => {
    const over = platformY + 1.6
    for (const [x, z] of [[0, -39.7], [-6.5, -38.5], [6.5, -38.5], [-7.8, -36.2], [7.8, -36.2], [8.6, -35.2], [-8.6, -35.2]] as const) {
      expect(insideApse(x, z, -0.105)).toBe(true)
      expect(roomAt([x, over, z])).toBe('oculus')
    }
    // Inside the passage, close to its inner wall, where the boxes of both rooms overlap
    const shoulder = oculusApse.arcs[2]
    for (const angle of [-0.2, -0.6, -1]) {
      const radius = shoulder.radius + 0.3 + 0.15
      const position: Vec3 = [shoulder.center[0] + Math.cos(angle) * radius, platformY + 1.6, shoulder.center[1] + Math.sin(angle) * radius]
      expect(roomAt(position)).toBe('bastion')
    }
  })
  test('its walls follow the route on its inside and along the run west: straight along the runs, curved round the turns, as long as the pieces at their sides, standing level with their baseboards on the floor along the ramps', () => {
    // Every piece’s left wall in turn, but the outlines’ walls in place of the right ones of all but the landing and the run west, after the first left one, and of the left ones of the S bend and the landing
    const sides = [[0, -1, 0], [1, -1, 4], [2, -1, 5], [3, -1, 6], [4, -1, 7], [6, 1, 13], [7, -1, 14], [7, 1, 15]] as const
    expect(bastionCurve.walls).toHaveLength(16)
    for (const [pieceIndex, side, wallIndex] of sides) {
      const wall = bastionCurve.walls[wallIndex]
      const piece = route.pieces[pieceIndex]
      expect(wall.id).toBe(`bastion-curve_wall_${wallIndex}`)
      expect(wall.sticky).toBe(false)
      expect(wall.slope).toBeUndefined()
      // From the lower floor up to 30 cm under the higher crown
      expect(wall.center[1]).toBe(Math.min(piece.startY, piece.endY))
      expect(wall.center[1] + wall.height + 0.3).toBeCloseTo(Math.max(piece.startY + piece.startHeight, piece.endY + piece.endHeight), 9)
      if (piece.kind === 'line') {
        expect(wall.width).toBeCloseTo(piece.length, 9)
        expect(wall.curveRadius).toBeUndefined()
      } else {
        expect(Math.abs(wall.curveRadius!)).toBeCloseTo(piece.radius - side * Math.sign(piece.sweep) * bastionCurve.width / 2, 9)
        expect(wall.width).toBeCloseTo(Math.abs(wall.curveRadius! * piece.sweep), 9)
      }
      if (piece.startY === piece.endY) {
        expect(wall.baseboardProfile).toBeUndefined()
        continue
      }
      // Its baseboard runs from end to end through the ramp’s knots, on the floor wherever it bends.
      const profile = wall.baseboardProfile!
      expect(profile).toHaveLength(PassageRoute.knots(piece).length + 2)
      expect(profile[0][0]).toBeCloseTo(-wall.width / 2, 9)
      expect(profile.at(-1)![0]).toBeCloseTo(wall.width / 2, 9)
      for (const [u, y] of profile) {
        const [x, , z] = wallPosition(wall, u, 0, 0)
        expect(bastionCurve.floorAt(x, z)).toBeCloseTo(wall.center[1] + y, 6)
      }
    }
  })
  test('the vault closes the passage above a person, its crown midway between its walls, and springs from behind them', () => {
    const material = new MeshBasicMaterial
    const shell = new Mesh(curve.shell, material)
    try {
      for (const [index, station] of stations.entries()) {
        if (index % 3 !== 1) {
          continue
        }
        const {point: [x, z], heading, y, height} = station
        const [left, right] = [-1, 1].map(side => bastionCurve.reach(station, side))
        const middle = (right - left) / 2
        const up = new Raycaster(new Vector3(x - Math.sin(heading) * middle, y + 1.6, z + Math.cos(heading) * middle), new Vector3(0, 1, 0))
        expect(up.intersectObject(shell)[0].point.y - y).toBeCloseTo(height, 1)
        for (const side of [-1, 1]) {
          const direction = new Vector3(-Math.sin(heading) * side, 0, Math.cos(heading) * side)
          // Below the springing, nothing of the vault stands inside the walls’ faces.
          const low = new Raycaster(new Vector3(x, y + 0.6, z), direction, 0, bastionCurve.reach(station, side) - 0.105)
          expect(low.intersectObject(shell)).toHaveLength(0)
        }
      }
    } finally {
      material.dispose()
    }
  })
  test('outside the curve, from the run north to the run west, straight walls stand: on along the run north, past the apse’s crown, touching the curve where the gate opens, and back at 45° to the run west', () => {
    const outline = bastionCurve.outlines.find(({side}) => side === 1)
    const [bend, landing, climb] = route.pieces.slice(-3)
    expect(outline).toMatchObject({
      side: 1,
      from: 0,
      to: landing.from,
    })
    expect(bend.kind).toBe('arc')
    const outer = bastionCurve.walls.slice(1, 4)
    const [east, north, chamfer] = outer
    for (const [index, wall] of outer.entries()) {
      expect(wall.curveRadius).toBeUndefined()
      expect(wall.sticky).toBe(false)
      // From one corner to the next
      const ends = [-1, 1].map(side => wallPosition(wall, side * wall.width / 2, 0, 0)).map(([x, , z]) => [x, z])
      const corners = outline!.corners.slice(index, index + 2)
      for (const corner of corners) {
        expect(ends.some(([x, z]) => Math.hypot(x - corner[0], z - corner[1]) < 1e-9)).toBe(true)
      }
      // Facing into the passage: half a meter in front of it lies its floor, half a meter behind it nothing.
      for (const share of [0.2, 0.5, 0.8]) {
        const u = wall.width * (share - 0.5)
        const [frontX, , frontZ] = wallPosition(wall, u, 0, 0.5)
        const [backX, , backZ] = wallPosition(wall, u, 0, -0.5)
        expect(bastionCurve.floorAt(frontX, frontZ)).toBeDefined()
        expect(bastionCurve.floorAt(backX, backZ)).toBeUndefined()
      }
      // From the lowest floor along it up to 30 cm under the highest crown, its baseboard on the floor wherever that changes
      const floors = Array.from({length: 41}, (_, step) => {
        const [x, , z] = wallPosition(wall, wall.width * (step / 40 - 0.5), 0, 0)
        return bastionCurve.stationAt(x, z)!
      })
      expect(wall.center[1]).toBeCloseTo(Math.min(...floors.map(({y}) => y)), 9)
      expect(wall.center[1] + wall.height + 0.3).toBeCloseTo(platformY + 5.2, 9)
      for (const [u, y] of wall.baseboardProfile ?? []) {
        const [x, , z] = wallPosition(wall, u, 0, 0)
        expect(bastionCurve.floorAt(x, z)).toBeCloseTo(wall.center[1] + y, 6)
      }
    }
    // On along the run north, from the mouth’s east wall, to the line the curve’s outer wall touched over the middle of the crown, where the gate opens
    const mouthEast = bastionMouth.walls.find(wall => wall.rotation === east.rotation && Math.abs(wall.center[0] - east.center[0]) < 1e-9)
    expect(mouthEast).toBeDefined()
    expect(north.center[2]).toBeCloseTo(bastionOrigin[2] - bastionCurve.width / 2, 9)
    expect(Math.abs(Math.abs(chamfer.rotation) - Math.PI / 4)).toBeLessThan(1e-9)
    // The ramp down runs along the run north’s, the ramp up along the chamfer; the north wall stands level.
    expect(east.baseboardProfile).toBeDefined()
    expect(north.baseboardProfile).toBeUndefined()
    expect(chamfer.baseboardProfile).toBeUndefined()
    // Never narrower than before, and widest in the corner behind the apse’s east shoulder
    const reaches = stations.map(station => bastionCurve.reach(station, 1))
    expect(Math.min(...reaches)).toBeGreaterThanOrEqual(bastionCurve.width / 2 - 1e-9)
    expect(Math.max(...reaches)).toBeGreaterThan(5.5)
    expect(bastionCurve.reach(route.at(climb.from + 0.5), 1)).toBe(bastionCurve.width / 2)
  })
  test('rejects routes and passages that cannot be built', () => {
    expect(() => new PassageRoute([0, 0], 0, 0, 3, [])).toThrow(RangeError)
    expect(() => new PassageRoute([0, 0], 0, 0, 3, [{length: 0}])).toThrow(RangeError)
    expect(() => new PassageRoute([0, 0], 0, 0, 3, [{
      radius: 2,
      angle: 0,
    }])).toThrow(RangeError)
    expect(() => new PassageRoute([0, Number.NaN], 0, 0, 3, [{length: 1}])).toThrow(RangeError)
    expect(() => new PassageRoute([0, 0], 0, 0, 0, [{length: 1}])).toThrow(RangeError)
    expect(() => new PassageRoute([0, 0], 0, 0, 3, [{
      height: 0,
      steps: [{length: 1}],
    }])).toThrow(RangeError)
    expect(() => new PassageRoute([0, 0], 0, 0, 3, [{
      y: 1,
      steps: [],
    }])).toThrow(RangeError)
    // Heading east, a passage 2 m wide has its right walls 1 m to the south.
    const run = new PassageRoute([0, 0], 0, 0, 3, [{length: 4}, {length: 2}])
    const outlined = (...corners: ReadonlyArray<readonly [number, number]>) => new RoutedPassage('test', 'bastion', run, 2, {
      outlines: [
        {
          side: 1,
          corners,
        },
      ],
    })
    const widened = outlined([0, 1], [2, 3], [4, 1])
    expect(widened.reach(run.at(2), 1)).toBeCloseTo(3, 9)
    expect(widened.reach(run.at(2), -1)).toBe(1)
    expect(widened.reach(run.at(5), 1)).toBe(1)
    expect(widened.floorAt(2, 2.5)).toBe(0)
    expect(widened.walls.map(wall => wall.curveRadius === undefined && wall.width)).toEqual([4, Math.hypot(2, 2), Math.hypot(2, 2), 2, 2])
    // Ending off a joint, cutting into the passage or doubling back
    expect(() => outlined([0, 1], [3, 1])).toThrow(RangeError)
    expect(() => outlined([0, 1], [2, 0.5], [4, 1])).toThrow(RangeError)
    expect(() => outlined([0, 1], [3, 3], [1, 4], [4, 1])).toThrow(RangeError)
    const quarter = new PassageRoute([0, 0], 0, 0, 3, [{length: 2}, {
      radius: 1,
      angle: Math.PI / 2,
    }])
    // A clockwise quarter turn from heading east ends heading south.
    expect(quarter.end.point[0]).toBeCloseTo(3, 9)
    expect(quarter.end.point[1]).toBeCloseTo(1, 9)
    expect(quarter.end.heading).toBeCloseTo(Math.PI / 2, 9)
  })
  test('a ramp eases its floor and its height over all of its runs and turns, straight from knot to knot, which its stations pass through', () => {
    const ramped = new PassageRoute([0, 0], 0, 0, 3, [{length: 1}, {
      y: 2,
      height: 4,
      steps: [{length: 3}, {
        radius: 2,
        angle: Math.PI / 2,
      }],
    }, {length: 1}])
    const [before, run, turn, after] = ramped.pieces
    const length = 3 + Math.PI
    expect(run.ramp).toEqual({
      from: 1,
      length,
      startY: 0,
      endY: 2,
      startHeight: 3,
      endHeight: 4,
    })
    expect(turn.ramp).toBe(run.ramp)
    expect([before.ramp, after.ramp]).toEqual([undefined, undefined])
    expect([ramped.at(1).y, ramped.at(1 + length).y, ramped.end.y]).toEqual([0, 2, 2])
    expect(ramped.at(1 + length / 2).y).toBeCloseTo(1, 9)
    expect(ramped.at(1 + length / 2).height).toBeCloseTo(3.5, 9)
    // Eased, half a meter into it, it has climbed less than half as far as a straight ramp would have.
    expect(ramped.at(1.5).y).toBeLessThan(2 * 0.5 / length / 2)
    expect([run.endY, turn.startY]).toEqual([ramped.at(4).y, ramped.at(4).y])
    // Its knots lie at most 25 cm apart, and every station along it follows the straight floor between them.
    const knots = [...PassageRoute.knots(run).map(knot => run.from + knot), ...PassageRoute.knots(turn).map(knot => turn.from + knot)]
    expect(knots.length).toBe(Math.ceil(length / 0.25) - 1)
    const rampStations = ramped.stations(0, ramped.length, 1 / 32)
    for (const [i, knot] of knots.entries()) {
      expect(rampStations.some(({point: [x, z]}) => Math.abs(ramped.project(x, z)!.along - knot) < 1e-6)).toBe(true)
      if (i) {
        expect(ramped.at((knots[i - 1] + knot) / 2).y).toBeCloseTo((ramped.at(knots[i - 1]).y + ramped.at(knot).y) / 2, 12)
      }
    }
  })
  for (const sprint of [false, true]) {
    for (const returning of [false, true]) {
      test(`a player walks from the east bridge through the doorway round the apse into the Lodge, sprint ${sprint}, returning ${returning}`, () => {
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
            world.createCollider(RAPIER.ColliderDesc.trimesh(...args).setTranslation(...wall.center).setRotation(rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)))
          }
        }
        for (const geometry of [ground, curve.paving, ...vaults.flatMap(vault => [vault.shell, vault.ribs])]) {
          // The approach, all timber transition, has no stone ribs.
          if (geometry.hasAttribute('position')) {
            world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry)))
          }
        }
        for (const passage of [bastionMouth, bastionApproach]) {
          for (const floor of passage.floors) {
            for (const corners of slabHulls(floor, passage.floorY - 0.24, passage.floorY)) {
              world.createCollider(RAPIER.ColliderDesc.convexHull(corners)!)
            }
          }
        }
        addOculusRailings(world)
        addBastionCrater(world)
        const bridgeX = tower.x + 5
        const bridge = towerFloorHeight(bridgeX, tower.z)!
        // Through the doorway and round the mouth’s elbow, like a player, at a walk; it ends before the timber transition’s saddle.
        const [elbowX] = bastionMouth.path[1]
        const path: Array<readonly [x: number, z: number, careful?: boolean]> = [[bridgeX, tower.z], [bastionDoorway.x + 0.6, tower.z, true], [elbowX, tower.z, true], [elbowX, route.start[1], true], ...stations.filter((_, i) => i % 2 === 0).map(({point}) => point), [bastionApproach.path[0][0] - 0.5, lodge.tunnelZ, true]]
        if (returning) {
          path.reverse()
        }
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], (returning ? lodge.floorY : bridge) + 0.04, path[0][1]))
        const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
        const motor = new EgoMotor(RAPIER, world, body, collider)
        const facing = new Quaternion
        try {
          let target = 1
          for (let i = 0; i < fps * 60 && target < path.length; i++) {
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
          // Back on the bridge, the floor under the player still climbs.
          const {x, z} = body.translation()
          expect(body.translation().y).toBeCloseTo((returning ? towerFloorHeight(x, z)! : lodge.floorY) + 0.02, 2)
          expect(motor.grounded).toBe(true)
        } finally {
          motor.dispose()
          world.free()
        }
      })
    }
  }
  test('its origin lies on its floor in the middle of the crown', () => {
    expect(bastionOrigin[0]).toBeCloseTo(tower.x, 9)
    expect(bastionOrigin[1]).toBe(platformY)
    expect(bastionOrigin[2]).toBeCloseTo(oculusApse.northZ - oculusApse.depth - 0.3 - bastionCurve.width / 2, 9)
  })
})
