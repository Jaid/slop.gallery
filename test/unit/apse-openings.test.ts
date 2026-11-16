import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {barDepth} from '../../src/lib/gallery/architectureDimensions.ts'
import {apseOpeningPoint, apseOpenings, bastionClearance, bastionCurve, bastionLanterns} from '../../src/lib/gallery/bastion.ts'
import {bastionLinkGate} from '../../src/lib/gallery/bastionNetwork.ts'
import {oculusPlatform} from '../../src/lib/gallery/lowerGallery.ts'
import oculusApse from '../../src/lib/gallery/oculusApse.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import RouteVaultGeometry from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'
import {openingTop, wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import {apseGrille} from '../../src/rooms/oculus/components/ApseGrilles/index.tsx'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls from './fixtures/gallery.ts'

await RAPIER.init()
const platformY = oculusPlatform.position[1] + oculusPlatform.size[1] / 2
const apseWalls = ['oculus-northwest', 'oculus-north', 'oculus-northeast']
/** each opening with its hole in the apse’s wall and in the wall of the Bastion’s curve behind it */
const openings = apseOpenings.map(opening => {
  const find = (candidates: ReadonlyArray<Wall>) => {
    const wall = candidates.find(value => value.holes?.some(hole => hole.name === opening.name))!
    return {
      wall,
      hole: wall.holes!.find(hole => hole.name === opening.name)!,
    }
  }
  return {
    opening,
    apse: find(walls.filter(wall => wall.id === apseWalls[opening.arc])),
    bastion: find(walls.filter(wall => wall.id.startsWith('bastion-curve_'))),
  }
})
const architecture = [...new Set(openings.flatMap(({apse, bastion}) => [apse.wall, bastion.wall]))].map(wall => ({
  wall,
  geometry: createArchitectureGeometry(wall),
}))
const grilles = apseOpenings.map(apseGrille)
const vault = new RouteVaultGeometry(bastionCurve)
const ground = new OculusGroundGeometry
const material = new MeshBasicMaterial({side: DoubleSide})
const placed = (wall: Wall, geometry: ConstructorParameters<typeof Mesh>[0]) => {
  const mesh = new Mesh(geometry, material)
  mesh.position.set(...wall.center)
  mesh.rotation.y = wall.rotation
  mesh.updateMatrixWorld()
  return mesh
}
const stone = [
  ...architecture.flatMap(({wall, geometry}) => [geometry.surface, ...geometry.trim, ...geometry.cornice].map(part => placed(wall, part))),
  ...[vault.shell, vault.ribs, vault.paving, ...grilles.map(grille => grille.reveal)].map(geometry => new Mesh(geometry, material)),
]
const bars = grilles.map(grille => new Mesh(grille.bars, material))
const floor = new Mesh(ground, material)
afterAll(() => {
  for (const {geometry} of architecture) {
    geometry.dispose()
  }
  for (const grille of grilles) {
    grille.dispose()
  }
  vault.dispose()
  ground.dispose()
  material.dispose()
})
/** the polar angle of a point round the center of the apse’s arc an opening pierces */
const angleAround = ({arc}: {arc: number}, [x, , z]: Vec3) => {
  const {center} = oculusApse.arcs[arc]
  return Math.atan2(z - center[1], x - center[0])
}
describe('the apse’s barred gate and windows onto the Bastion', () => {
  test('a gate in the middle of the crown and a window to either side of it, symmetric, all three on the crown', () => {
    expect(openings.map(({opening, apse}) => [opening.name, apse.wall.id])).toEqual([['west_window', 'oculus-north'], ['gate', 'oculus-north'], ['east_window', 'oculus-north']])
    const [west, gate, east] = apseOpenings
    expect(apseOpeningPoint(gate)[0]).toBeCloseTo(0, 9)
    expect(apseOpeningPoint(west)[0]).toBeCloseTo(-apseOpeningPoint(east)[0], 9)
    expect(apseOpeningPoint(west)[1]).toBeCloseTo(apseOpeningPoint(east)[1], 9)
    expect(gate.width).toBeGreaterThan(west.width)
    expect(gate.height).toBeGreaterThan(west.height)
    // Along the crown’s wall, the casings keep apart, and clear of its ends.
    const [westHole, gateHole] = openings.map(({apse}) => apse.hole)
    const wall = openings[1].apse.wall
    const casing = 0.17
    expect(Math.abs(gateHole.u - westHole.u) - gateHole.width / 2 - westHole.width / 2 - casing * 2).toBeGreaterThan(0.5)
    expect(wall.width / 2 - Math.abs(westHole.u) - westHole.width / 2 - casing).toBeCloseTo(0.3, 9)
  })
  test('each pierces the apse’s wall and the curve’s wall behind it, its jambs pointing to its arc’s center, the windows splayed toward the gate and up on the Bastion’s side', () => {
    const {radius} = oculusApse.arcs[1]
    const gateAngle = apseOpenings.find(opening => opening.name === 'gate')!.angle
    for (const {opening, apse, bastion} of openings) {
      const jambs = ({wall, hole}: typeof apse) => [-1, 1].map(side => angleAround(opening, wallPosition(wall, hole.u + side * hole.width / 2, platformY + 1, 0))).toSorted((a, b) => a - b)
      const [apseJambs, bastionJambs] = [jambs(apse), jambs(bastion)]
      for (const [index, side] of [-1, 1].entries()) {
        expect(apseJambs[index] - opening.angle + Math.PI * 2).toBeCloseTo(side * opening.width / 2 / radius, 6)
        expect(bastionJambs[index] - opening.back.angle + Math.PI * 2).toBeCloseTo(side * opening.back.width / 2 / radius, 6)
      }
      // Away from the gate, its jambs line up; toward it, the Bastion’s side reaches further.
      const away = Math.sign(opening.angle - gateAngle)
      if (away) {
        expect(bastionJambs[away < 0 ? 0 : 1]).toBeCloseTo(apseJambs[away < 0 ? 0 : 1], 6)
        expect((bastionJambs[away < 0 ? 1 : 0] - apseJambs[away < 0 ? 1 : 0]) * away).toBeLessThan(-0.02)
        expect(opening.back.height).toBeGreaterThan(opening.height)
      } else {
        for (const [index, angle] of apseJambs.entries()) {
          expect(bastionJambs[index]).toBeCloseTo(angle, 6)
        }
        expect(opening.back.height).toBe(opening.height)
      }
      expect(apse.wall.center[1] + (apse.hole.bottom ?? 0)).toBeCloseTo(bastion.wall.center[1] + (bastion.hole.bottom ?? 0), 9)
      expect(apse.wall.center[1] + (apse.hole.bottom ?? 0)).toBeCloseTo(platformY + opening.bottom, 9)
      expect(apse.wall.center[1] + openingTop(apse.hole, apse.hole.u)).toBeCloseTo(platformY + opening.height, 9)
      expect(bastion.wall.center[1] + openingTop(bastion.hole, bastion.hole.u)).toBeCloseTo(platformY + opening.back.height, 9)
      // Behind each, the curve runs at the platform’s level, under a vault that springs above its casing.
      const [x, z] = apseOpeningPoint(opening, bastionClearance + bastionCurve.width / 2)
      const station = bastionCurve.stationAt(x, z)!
      expect(station.y).toBeCloseTo(platformY, 9)
      expect(station.height - bastionCurve.width / 2).toBeGreaterThan(opening.back.height + 0.17)
    }
    expect(apseOpenings.find(opening => opening.name === 'gate')!.bottom).toBe(0)
  })
  test('a single lantern hangs behind the gate, and its light falls through all three openings between the bars onto the platform', () => {
    const [x, z] = apseOpeningPoint(apseOpenings.find(opening => opening.name === 'gate')!, bastionClearance + bastionCurve.width / 2)
    expect(Math.abs(bastionLanterns.north - bastionCurve.route.project(x, z)!.along)).toBeLessThan(0.3)
    expect(Object.keys(bastionLanterns)).toEqual(['east', 'north'])
    const lamp = slopGallery.lamps().find(value => value.id === 'bastion-lantern_north')!
    expect(lamp.shadow).toBe(true)
    const light = new Vector3(...lamp.position)
    const gateHole = openings.find(({opening}) => opening.name === 'gate')!.apse.hole
    for (const [index, {opening, apse}] of openings.entries()) {
      // through points of the opening a little toward the gate, over what falls onto a window’s sill on the Oculus’ side and under what the head of its back holds back
      const bottom = apse.hole.bottom ?? 0
      const u = apse.hole.u + Math.sign(gateHole.u - apse.hole.u) * 0.2 + 0.075
      for (const fraction of [0.3, 0.45, 0.6]) {
        const y = apse.wall.center[1] + bottom + (openingTop(apse.hole, apse.hole.u) - bottom) * fraction
        const through = new Vector3(...wallPosition(apse.wall, u, y, 0))
        const direction = through.clone().sub(light).normalize()
        const ray = new Raycaster(light, direction, 0, 30)
        const hits = ray.intersectObjects([...stone, floor])
        expect(`${opening.name} at ${fraction}: ${hits[0].object === floor ? 'platform' : `stone ${stone.indexOf(hits[0].object as typeof stone[number])}`}`).toBe(`${opening.name} at ${fraction}: platform`)
        expect(hits[0].point.y).toBeCloseTo(platformY, 4)
        expect(lamp.range! > hits[0].distance).toBe(true)
      }
      // A bar stands in the light’s way in the middle, and throws its shadow: they stand evenly spread, at most 15 cm apart.
      const count = Math.ceil(opening.width / 0.15) - 1
      const middle = apse.hole.u - opening.width / 2 + opening.width * (Math.floor(count / 2) + 1) / (count + 1)
      const bar = new Vector3(...wallPosition(apse.wall, middle, apse.wall.center[1] + bottom + 0.6, barDepth))
      const barRay = new Raycaster(light, bar.clone().sub(light).normalize(), 0, 30)
      const toBar = barRay.intersectObjects(bars)
      expect(toBar[0]?.object).toBe(bars[index])
    }
  })
  test('the gate shares the Bastion gate’s mouse hole, while the windows are barred down to their sills', () => {
    const {hatch} = bastionLinkGate
    expect(hatch.width).toBe(0.6)
    expect(hatch.height - (hatch.bottom ?? 0)).toBeCloseTo(0.5, 9)
    const rayHitsBars = (index: number, u: number, height: number) => {
      const {wall} = openings[index].apse
      const y = wall.center[1] + height
      const front = new Vector3(...wallPosition(wall, u, y, barDepth + 0.25))
      const back = new Vector3(...wallPosition(wall, u, y, barDepth - 0.25))
      const toward = back.sub(front)
      const ray = new Raycaster(front, toward.clone().normalize(), 0, toward.length())
      return ray.intersectObject(bars[index]).length > 0
    }
    const gate = openings[1].apse.hole
    expect(gate.bottom ?? 0).toBe(0)
    expect(rayHitsBars(1, gate.u, 0.25)).toBe(false)
    expect(rayHitsBars(1, gate.u, 0.7)).toBe(true)
    expect(rayHitsBars(1, gate.u + 0.45, 0.25)).toBe(true)
    for (const index of [0, 2]) {
      const window = openings[index].apse.hole
      expect(rayHitsBars(index, window.u, (window.bottom ?? 0) + 0.25)).toBe(true)
    }
  })
  test('the bars stand closer than anyone can squeeze through, and the reveal closes the gap between both walls', () => {
    for (const [index, {opening, apse}] of openings.entries()) {
      const positions = grilles[index].bars.getAttribute('position')
      expect(positions.count).toBeGreaterThan(0)
      const bottom = apse.hole.bottom ?? 0
      const y = apse.wall.center[1] + bottom + 0.9
      // Sideways along the gap between both walls, from the opening’s middle, the reveal closes it beyond the jamb, or where a window splays toward the gate, beyond its back’s.
      for (const side of [-1, 1]) {
        const start = new Vector3(...wallPosition(apse.wall, apse.hole.u, y, -bastionClearance / 2))
        const beyond = new Vector3(...wallPosition(apse.wall, apse.hole.u + side * (opening.back.width - opening.width / 2 + 0.2), y, -bastionClearance / 2))
        const ray = new Raycaster(start, beyond.clone().sub(start).normalize(), 0, start.distanceTo(beyond))
        const hits = ray.intersectObject(new Mesh(grilles[index].reveal, material))
        expect(hits.length).toBeGreaterThan(0)
      }
    }
  })
  test('a player walking up to the gate from the platform stops at its bars', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    world.timestep = 1 / 60
    try {
      for (const {wall, geometry} of architecture) {
        for (const args of geometry.collision) {
          const rotation = new Quaternion
          world.createCollider(RAPIER.ColliderDesc.trimesh(...args).setTranslation(...wall.center).setRotation(rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)))
        }
      }
      for (const geometry of [ground, vault.paving, ...grilles.flatMap(grille => [grille.bars, grille.reveal])]) {
        world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry)))
      }
      const gate = apseOpenings.find(opening => opening.name === 'gate')!
      const [, gateZ] = apseOpeningPoint(gate)
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0.05, platformY + 0.04, gateZ + 3))
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
      const motor = new EgoMotor(RAPIER, world, body, collider)
      try {
        const facing = new Quaternion
        for (let i = 0; i < 240; i++) {
          motor.step(world.timestep, {
            forward: true,
            sprint: true,
          }, facing)
          world.step()
        }
        expect(body.translation().z).toBeGreaterThan(gateZ)
        expect(body.translation().z).toBeLessThan(gateZ + 0.6)
        expect(body.translation().y).toBeCloseTo(platformY + 0.02, 2)
      } finally {
        motor.dispose()
      }
    } finally {
      world.free()
    }
  })
})
