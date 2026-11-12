import type {RouteLine, RoutePiece} from '../../src/lib/gallery/passages/PassageRoute.ts'
import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {vaultShellThickness, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import {bastionCrater, bastionCurve, bastionLinkStart} from '../../src/lib/gallery/bastion.ts'
import {bastionLink, bastionLinkCrossfall, bastionLinkGate, climbMouthHollow} from '../../src/lib/gallery/bastionNetwork.ts'
import {climbMouth} from '../../src/lib/gallery/climb.ts'
import lodge from '../../src/lib/gallery/lodge.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import oculusApse from '../../src/lib/gallery/oculusApse.ts'
import {openingArc} from '../../src/lib/placement/wallGeometry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'
import {bastionColliders, physicsWorld} from './helpers/bastionWorld.ts'

await RAPIER.init()
const {route} = bastionLink
const architecture = walls.filter(wall => ['bastion', 'lodge', 'oculus'].includes(wall.room)).map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
const colliders = bastionColliders()
/** where the gate across the tunnel’s end stands, on the mouth’s north wall */
const gateZ = bastionLinkGate.wall.center[2]
afterAll(() => {
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
})
const wallById = (id: string) => walls.find(wall => wall.id === id)!
const lodgeSouthZ = lodge.center[1] + lodge.size[1] / 2
const mouthNorthZ = climbMouth.path[0][1] - climbMouth.width / 2
const mouthWestX = climbMouth.path[1][0] - climbMouth.width / 2
const oculusWestX = lowerGallery.oculus.center[0] - lowerGallery.oculus.size[0] / 2
const [westShoulder] = oculusApse.arcs
const straight = (piece: RoutePiece | undefined): piece is RouteLine => piece?.kind === 'line'
/** Where the line straight across from the station toward a side lies `out` meters from the centerline. */
const across = (station: ReturnType<typeof route.at>, side: number, out: number) => [station.point[0] - Math.sin(station.heading) * side * out, station.point[1] + Math.cos(station.heading) * side * out] as const
const climb = bastionCurve.route.pieces.at(-1)
const landing = bastionCurve.route.pieces.at(-2)
if (!straight(climb) || !straight(landing)) {
  throw new Error('The curve ends in a level landing and its straight climb toward the Lodge.')
}
test('both wings and the link belong to one Bastion', () => {
  expect(slopGallery.rooms.filter(room => room.id === 'bastion')).toHaveLength(1)
  for (let along = 0; along <= route.length; along += 0.1) {
    const {point: [x, z], y} = route.at(along)
    const position: Vec3 = [x, y + 1.6, z]
    expect(roomAt(position)).toBe('bastion')
    expect(insideGallery(position)).toBe(true)
    // its paving falling toward its middle; where it meets the landing, the landing’s floor over its sill counts
    expect(floorHeight(position)).toBeCloseTo(along < 0.05 ? y : y - bastionLink.sag(route.at(along), 0), 5)
    if (along > 0.3 && along < route.length - 0.1) {
      expect(Math.abs(route.at(along + 0.01).y - route.at(along - 0.01).y) / 0.02).toBeLessThan(0.25)
    }
  }
  // It leaves the curve’s landing heading south, level with it, and ends in the mouth’s north wall at its elbow, a step under the hollow in front of its gate, its west wall in line with the mouth’s.
  expect(route.start).toEqual(bastionLinkStart.point)
  expect(route.start[1]).toBeCloseTo(landing.start[1] + bastionCurve.width / 2, 9)
  expect([route.y, route.heading]).toEqual([bastionLinkStart.y, Math.PI / 2])
  expect(route.end.point[0] - bastionLink.width / 2).toBeCloseTo(mouthWestX, 9)
  expect(route.end.point[1]).toBeCloseTo(mouthNorthZ, 9)
  expect(route.end.heading).toBeCloseTo(Math.PI / 2, 9)
  expect(route.end.y).toBe(climbMouthHollow.outletY)
  // under the elbow’s fall toward its middle and the hollow sunk into it
  expect(climbMouth.floorY - route.end.y).toBeLessThan(0.35)
  expect(route.end.height).toBe(climbMouth.height)
})
test('its paving falls 1 in 20 from both walls toward its middle, but levels out toward the gate, which stands on a level floor', () => {
  expect(bastionLink.crossfall?.slope).toBe(bastionLinkCrossfall)
  expect(bastionLinkCrossfall).toBe(1 / 20)
  for (const along of [0, 5, 12, 20]) {
    const station = route.at(along)
    // falling from the faces of its walls
    const half = bastionLink.width / 2 - wallFace
    expect(bastionLink.sag(station, 0)).toBeCloseTo(bastionLinkCrossfall * half, 9)
    expect(bastionLink.sag(station, -half / 2)).toBeCloseTo(bastionLinkCrossfall * half / 2, 9)
    expect(bastionLink.sag(station, half)).toBe(0)
    expect(bastionLink.sag(station, bastionLink.width / 2)).toBe(0)
  }
  // Under the gate, level across
  expect(bastionLink.sag(route.end, 0)).toBe(0)
  expect(bastionLinkGate.hole.bottom).toBeCloseTo(route.end.y - climbMouth.floorY, 9)
  // At the landing, it lies a hand’s breadth under the landing’s floor in its middle and meets it at the walls, a low sill along the doorway.
  expect(bastionLink.floorAt(...route.start)).toBeCloseTo(bastionLinkStart.y - bastionLinkCrossfall * (bastionLink.width / 2 - wallFace), 9)
  expect(bastionCurve.floorAt(route.start[0], route.start[1] - 0.05)).toBe(bastionLinkStart.y)
})
test('beside the Lodge, the tunnel takes up all the room between the Lodge and the mouth of the western climb', () => {
  const strip = route.pieces.filter(straight).find(piece => Math.abs(piece.heading - Math.PI) < 1e-9)!
  const station = route.at(strip.from + strip.length / 2)
  // The back of its vault 1 cm short of the face of the Lodge’s south wall
  expect(across(station, 1, bastionLink.width / 2 + vaultShellThickness)[1]).toBeCloseTo(lodgeSouthZ - wallFace + 0.01, 9)
  // The faces of its walls 1 cm in front of the back of the mouth’s vault, and the back of its own 1 cm short of the face of the mouth’s wall
  expect(across(station, -1, bastionLink.width / 2 - wallFace)[1]).toBeCloseTo(mouthNorthZ - vaultShellThickness - 0.01, 9)
  expect(across(station, -1, bastionLink.width / 2 + vaultShellThickness)[1]).toBeCloseTo(mouthNorthZ + wallFace - 0.01, 9)
  // It runs that wide from past the Lodge’s east wall into the turn toward the mouth.
  expect(strip.start[0]).toBeGreaterThan(lodge.center[0] + lodge.size[0] / 2)
  expect(route.pieces.at(-1)!.from).toBeCloseTo(strip.from + strip.length, 9)
})
test('the link’s walls and vault keep out of the Lodge, the Oculus and its apse, the curve’s climb and the mouth', () => {
  for (const station of route.stations(0, route.length, 1 / 64)) {
    for (const side of [-1, 1]) {
      const [x, z] = across(station, side, bastionLink.width / 2 + vaultShellThickness)
      if (x < lodge.center[0] + lodge.size[0] / 2 + wallFace) {
        expect(z).toBeGreaterThan(lodgeSouthZ - wallFace)
      }
      expect(x).toBeLessThan(oculusWestX + wallFace)
      // short of the face of the apse’s west shoulder, where it reaches past the Oculus’ west wall
      if (z < oculusApse.northZ) {
        expect(Math.hypot(x - westShoulder.center[0], z - westShoulder.center[1])).toBeGreaterThan(westShoulder.radius - wallFace)
      }
      // behind the back of the vault of the curve’s climb toward the Lodge, wherever they stand as high
      if (x < climb.start[0]) {
        const beside = bastionCurve.route.at(climb.from + Math.min(climb.start[0] - x, climb.length))
        if (station.y + station.height + vaultShellThickness > beside.y + beside.height - bastionCurve.width / 2) {
          expect(z).toBeGreaterThan(climb.start[1] + bastionCurve.width / 2 + vaultShellThickness)
        }
      }
      // in front of the back of the mouth’s vault along its run east, short of its elbow, where the tunnel ends
      const [faceX, faceZ] = across(station, side, bastionLink.width / 2 - wallFace)
      if (faceX > climbMouth.path[1][0] + climbMouth.width / 2) {
        expect(faceZ).toBeLessThan(mouthNorthZ - vaultShellThickness + 1e-9)
      }
    }
  }
})
const casted = (geometries: ReadonlyArray<ReturnType<typeof createArchitectureGeometry>['surface']>, u: number, y: number) => {
  const material = new MeshBasicMaterial({side: DoubleSide})
  try {
    const raycaster = new Raycaster(new Vector3(u, y, 1), new Vector3(0, 0, -1))
    return geometries.flatMap(geometry => raycaster.intersectObject(new Mesh(geometry, material)))
  } finally {
    material.dispose()
  }
}
/** Expects the opening to be bare and as wide and as high as the link’s vault, ending at the faces of its walls. */
const expectVaultSection = (hole: NonNullable<ReturnType<typeof wallById>['holes']>[number], crown: number) => {
  expect(hole.casing).toBe(false)
  expect(hole.width).toBeCloseTo(bastionLink.width - wallFace * 2, 9)
  expect(hole.height).toBe(crown)
  const {radius, center} = openingArc(hole)
  expect(radius).toBeCloseTo(bastionLink.width / 2, 9)
  expect(center).toBeCloseTo(crown - bastionLink.width / 2, 9)
}
test('it opens out of the curve’s level landing through a bare arch the size of its vault, which takes up all of the landing’s straight wall', () => {
  const wall = walls.find(value => value.id.startsWith('bastion-curve_') && value.holes?.some(hole => hole.name === 'link'))!
  const hole = wall.holes!.find(({name}) => name === 'link')!
  expectVaultSection(hole, bastionLinkStart.height)
  expect(wall.curveRadius).toBeUndefined()
  expect(Math.cos(wall.rotation)).toBeCloseTo(-1, 9)
  expect(wall.center[1]).toBe(bastionLinkStart.y)
  // facing north into the curve, so its u runs west
  const [eastJamb, westJamb] = [wall.center[0] - hole.u + hole.width / 2, wall.center[0] - hole.u - hole.width / 2]
  expect(eastJamb).toBeCloseTo(route.start[0] + bastionLink.width / 2 - wallFace, 9)
  expect(westJamb).toBeCloseTo(route.start[0] - bastionLink.width / 2 + wallFace, 9)
  // The wall reaches from the corner where the tunnel’s east wall runs on to where its west wall runs on and the climb’s wall begins.
  expect(wall.center[0] + wall.width / 2).toBeCloseTo(route.start[0] + bastionLink.width / 2, 9)
  expect(wall.center[0] - wall.width / 2).toBeCloseTo(route.start[0] - bastionLink.width / 2, 9)
  expect(climb.start[0]).toBeCloseTo(route.start[0] - bastionLink.width / 2, 9)
  // The floor stays level across the doorway, up to the climb.
  for (let x = westJamb; x <= eastJamb; x += 0.05) {
    expect(bastionCurve.floorAt(x, route.start[1] - 0.3)).toBe(bastionLinkStart.y)
  }
  expect(climb.ramp!.from).toBeCloseTo(climb.from, 9)
  // The straight walls of the landing’s corner keep nearly as far from the apse’s west shoulder as the curve does all round it.
  const left = bastionCurve.outlines.find(outline => outline.side === -1)!
  for (const [index, corner] of left.corners.slice(0, -1).entries()) {
    const next = left.corners[index + 1]
    for (let share = 0; share <= 1; share += 0.05) {
      const [x, z] = [corner[0] + (next[0] - corner[0]) * share, corner[1] + (next[1] - corner[1]) * share]
      expect(Math.hypot(x - westShoulder.center[0], z - westShoulder.center[1]) - westShoulder.radius).toBeGreaterThan(0.29)
    }
  }
})
test('it opens into the mouth’s elbow through a bare arch the size of its vault, which stops at the tunnel’s crown', () => {
  const wall = wallById('bastion-climb_mouth_wall_2')
  const hole = wall.holes!.find(({name}) => name === 'link')!
  // The tunnel climbs all the way to the gate and ends a step under the hollow, so its crown stands lower than the mouth’s ceiling. The arch follows it; cut to the ceiling, it would open over the tunnel’s barrel onto the sky.
  const crown = route.end.y + route.end.height - climbMouth.floorY
  expect(crown).toBeLessThan(climbMouth.height)
  expectVaultSection(hole, crown)
  // Its west jamb stands in line with the face of the mouth’s west wall.
  expect(wall.center[0] + hole.u - hole.width / 2).toBeCloseTo(mouthWestX + wallFace, 9)
  const {geometry} = architecture.find(entry => entry.wall === wall)!
  // The arch reaches up into where the cornice would run, so the wall goes without one and on up to the ceiling, and the arch ends in stone.
  expect(wall.cornice).toBe(false)
  expect(geometry.cornice).toHaveLength(0)
  expect(wall.center[1] + wall.height).toBeCloseTo(climbMouth.floorY + climbMouth.height, 9)
  expect(wall.center[1] + hole.height).toBeLessThan(wall.center[1] + wall.height)
  // No casing frames it: right beside its east jamb, the wall’s face is all there is.
  expect(casted(geometry.trim, hole.u + hole.width / 2 + 0.05, 1)).toHaveLength(0)
  // Its west jamb opens the corner down to the floor, so both baseboards there run on square, the mouth’s west wall’s straight into the tunnel’s, and only the cornices are mitered.
  const west = wallById('bastion-climb_mouth_wall_3')
  expect(west.miters).toEqual([0, 1])
  expect(west.baseboardMiters).toEqual([0, 0])
  expect(wall.miters).toEqual([1, 0])
  expect(wall.baseboardMiters).toEqual([0, 0])
})
for (const returning of [false, true]) {
  for (const sprint of [false, true]) {
    test(`the player walks the link up to the gate from the landing’s doorway, or down to it from the mouth, but no further, returning ${returning}, sprint ${sprint}`, () => {
      const world = physicsWorld(colliders)
      // from the level landing west of the crater in front of the doorway, round its edge into the doorway, at a walk there and through the first 3 m of the tunnel, so as not to run into the crater, then on toward the mouth’s elbow behind the gate
      const [craterX, entranceY, craterZ] = bastionCrater.center
      const tunnel = Array.from({length: Math.floor((route.length - 0.6) / 0.4) + 1}, (_, i) => [...route.at(i * 0.4).point, i * 0.4 < 3] as const)
      const path: Array<readonly [x: number, z: number, careful?: boolean]> = returning ? [climbMouth.path[1], [route.end.point[0], gateZ + 0.6]] : [[craterX - 1.8, craterZ, true], [craterX - 1.3, route.start[1] - 0.4, true], ...tunnel]
      const beyond = returning ? route.at(-3).point : climbMouth.path[1]
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], (returning ? climbMouth.floorY : entranceY) + 0.04, path[0][1]))
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
      const motor = new EgoMotor(RAPIER, world, body, collider)
      const facing = new Quaternion
      try {
        let target = 1
        for (let frame = 0; frame < 60 * 45 && target < path.length; frame++) {
          const position = body.translation()
          const dx = path[target][0] - position.x
          const dz = path[target][1] - position.z
          if (Math.hypot(dx, dz) < 0.15) {
            target++
            continue
          }
          facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
          motor.step(world.timestep, {
            forward: true,
            sprint: sprint && !path[target][2],
          }, facing)
          world.step()
          // down the sill into the tunnel’s paving falling toward its middle at most
          expect(position.y).toBeGreaterThan(entranceY - bastionLinkCrossfall * (bastionLink.width / 2 - wallFace) - 0.1)
        }
        expect({
          target,
          position: body.translation(),
        }).toMatchObject({target: path.length})
        // Pushing on against the gate for three seconds, the player stays on their side of its bars, crouching too.
        for (let frame = 0; frame < 180; frame++) {
          const {x, z} = body.translation()
          facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-(beyond[0] - x), -(beyond[1] - z)))
          motor.step(world.timestep, {
            forward: true,
            crouch: frame > 60,
          }, facing)
          world.step()
        }
        const {z} = body.translation()
        if (returning) {
          expect(z).toBeGreaterThan(gateZ + 0.2)
        } else {
          expect(z).toBeLessThan(gateZ - 0.2)
        }
        expect(motor.grounded).toBe(true)
      } finally {
        motor.dispose()
        world.free()
      }
    })
  }
}
