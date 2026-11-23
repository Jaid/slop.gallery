import type {Vec3} from '../../src/lib/gallery/types.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Euler, Quaternion, Vector3} from 'three/webgpu'

import antechamber, {antechamberGallery, antechamberLanding, antechamberOculi, antechamberPlans, antechamberStairs, antechamberWings} from '../../src/lib/gallery/antechamber.ts'
import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorThickness} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import lobbyVault from '../../src/lib/gallery/lobbyVault.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {ceilingSlab, moonfallHeight} from '../../src/lib/gallery/moonfall/config.ts'
import {stairBlocks, stairFlights, stairTurn} from '../../src/lib/gallery/staircase.ts'
import {stairHeadroom} from '../../src/lib/gallery/stairs/StairFlight.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {enabledRooms} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const {moonfall} = lowerGallery
const moonfallSouthZ = moonfall.center[1] + moonfall.size[1] / 2
const inside = ({center, size}: {
  center: readonly [number, number]
  size: readonly [number, number]
}, x: number, z: number) => Math.abs(x - center[0]) <= size[0] / 2 && Math.abs(z - center[1]) <= size[1] / 2
/** the unit direction from one point to another */
const toward = (from: Vec3, to: Vec3): Vec3 => {
  const delta = to.map((value, axis) => value - from[axis]) as Vec3
  const length = Math.hypot(...delta)
  return delta.map(value => value / length) as Vec3
}
describe('the Antechamber’s wings and gallery', () => {
  test('a wing off either side of the domed middle, as deep as it and flush with it, the gallery flush with the west wing’s west wall, all on the floor’s 2 m tiles', () => {
    const [middleX, middleZ] = antechamber.center
    for (const [side, wing] of [[-1, antechamberWings.west], [1, antechamberWings.east]] as const) {
      expect(wing.center[1]).toBe(middleZ)
      expect(wing.size[1]).toBe(antechamber.size[1])
      expect(wing.center[0] - side * wing.size[0] / 2).toBe(middleX + side * antechamber.size[0] / 2)
    }
    const westWing = antechamberWings.west
    expect(antechamberGallery.center[0] - antechamberGallery.size[0] / 2).toBe(westWing.center[0] - westWing.size[0] / 2)
    expect(antechamberGallery.center[1] - antechamberGallery.size[1] / 2).toBe(westWing.center[1] + westWing.size[1] / 2)
    for (const {center, size} of [westWing, antechamberWings.east, antechamberGallery]) {
      for (const edge of [center[0] - size[0] / 2, center[0] + size[0] / 2, center[1] - size[1] / 2]) {
        expect(edge % 2).toBeCloseTo(0, 9)
      }
    }
    // Neither reaches into the Lobby or the Sienna beside them.
    expect(westWing.center[1] - westWing.size[1] / 2).toBe(lobby.southZ)
    const sienna = slopGallery.room('sienna')
    expect(antechamberGallery.center[0] - antechamberGallery.size[0] / 2).toBeGreaterThan(sienna.center[0] + sienna.size[0] / 2)
  })
  test('the gallery runs level to the line of Moonfall’s south wall, where the stairs down set out, all of them south of the hall', () => {
    expect(antechamberGallery.center[1] + antechamberGallery.size[1] / 2).toBe(moonfallSouthZ)
    const [upper, lower] = stairFlights
    expect(upper.start).toEqual([antechamberGallery.center[0], 0, moonfallSouthZ])
    expect(lower.end[2]).toBe(moonfallSouthZ)
    for (const block of stairBlocks) {
      expect(block.position[2] - block.size[2] / 2).toBeGreaterThanOrEqual(moonfallSouthZ - 1e-9)
    }
    const stairWalls = walls.filter(value => value.id.startsWith('moonfall-stairs_'))
    for (const wall of stairWalls) {
      for (const end of [-1, 1]) {
        expect(wall.center[2] - Math.sin(wall.rotation) * end * wall.width / 2).toBeGreaterThanOrEqual(moonfallSouthZ - 1e-9)
      }
    }
    expect(stairTurn.contains(...stairTurn.place(0.1, 0))).toBe(false)
  })
  test('with nothing of the stairs over it, Moonfall’s ceiling rises right up to the underside of the ground floor’s slabs, 1.9 m higher than before', () => {
    expect(lowerGallery.floorY + ceilingSlab.center + ceilingSlab.thickness / 2).toBeCloseTo(-floorThickness, 9)
    expect(moonfallHeight - 5.8).toBeCloseTo(1.89, 9)
    const room = slopGallery.room('moonfall')
    expect(room.height).toBe(moonfallHeight)
    // Its air reaches up to its ceiling.
    expect(room.air[0].max.y - room.floorY).toBeCloseTo(moonfallHeight, 9)
    const hallWalls = walls.filter(value => ['moonfall-east', 'moonfall-north', 'moonfall-south', 'moonfall-west'].includes(value.id))
    expect(hallWalls).toHaveLength(4)
    for (const wall of hallWalls) {
      // Its walls end inside the slab, which their cornices tuck under.
      const top = wall.center[1] + wall.height + 0.3
      expect(top).toBeGreaterThan(lowerGallery.floorY + ceilingSlab.center - ceilingSlab.thickness / 2)
      expect(top).toBeLessThan(lowerGallery.floorY + ceilingSlab.center + ceilingSlab.thickness / 2)
    }
    // Under the Lobby’s south part, the Antechamber and its gallery, Moonfall reaches up to the slab, and over it the room above begins.
    for (const [x, z] of [[-8, 6], [0, 12], [antechamberGallery.center[0], antechamberGallery.center[1]]]) {
      expect(roomAt([x, -0.3, z])).toBe('moonfall')
      expect(roomAt([x, 0.5, z])).not.toBe('moonfall')
    }
  })
  test('the wings, the gallery, the east wing’s flight and its landing hold a player on their own floors, and only there', () => {
    for (const part of [antechamberWings.west, antechamberWings.east, antechamberGallery]) {
      const [x, z] = part.center
      const position: Vec3 = [x, 1.6, z]
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('antechamber')
      expect(floorHeight(position)).toBe(0)
      // Up to their ceilings, under Moonfall’s hall below.
      expect(insideGallery([x, part.height + 0.1, z])).toBe(true)
      expect(insideGallery([x, part.height + 0.3, z])).toBe(false)
    }
    // Beyond the crater, Moonfall’s floor lies under them.
    expect(floorHeight([antechamberGallery.center[0], -2, moonfallSouthZ - 2])).toBe(lowerGallery.floorY)
    for (const block of antechamberStairs.blocks) {
      const position: Vec3 = [block.position[0], block.top + 1.6, block.position[2]]
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('antechamber')
      expect(floorHeight(position)).toBeCloseTo(block.top, 9)
    }
    const [landingX, landingZ] = antechamberLanding.center
    expect(floorHeight([landingX, antechamberLanding.floorY + 1.6, landingZ])).toBeCloseTo(antechamberLanding.floorY, 9)
    expect(roomAt([landingX, antechamberLanding.floorY + 1.6, landingZ])).toBe('antechamber')
    expect(insideGallery([landingX + antechamberLanding.size[0], antechamberLanding.floorY + 1.6, landingZ])).toBe(false)
    // Between the gallery and the east wing, south of the middle, there is nothing.
    expect(insideGallery([0, 1.6, 20])).toBe(false)
  })
  test('no line of sight from anywhere in the Lobby reaches the stairs down to Moonfall', () => {
    // Points along the stairs’ head, its doorway and down the upper flight, and on the turn.
    const [upper] = stairFlights
    const targets: Array<Vec3> = [
      ...[-1.2, 0, 1.2].flatMap(across => [0.2, 2, 5, 9].map((along): Vec3 => {
        const top = upper.floorAt(upper.start[0] + across, upper.start[2] + along) ?? 0
        return [upper.start[0] + across, top + 1, upper.start[2] + along]
      })),
      [stairTurn.position[0], stairTurn.top + 1.5, stairTurn.position[2]],
    ]
    const lobbyWall = walls.find(wall => wall.id === 'lobby-south')!
    /** the top of the Lobby’s south wall, over which its vault’s south lunette closes the wall’s plane up to the crown */
    const wallTop = lobbyWall.center[1] + lobbyWall.height + 0.3
    let rays = 0
    let overWall = 0
    for (let x = -lobby.width / 2 + 0.5; x <= lobby.width / 2 - 0.5; x += 1.5) {
      for (let z = lobby.northZ + 0.5; z <= lobby.southZ - 0.3; z += 2) {
        // from the floor up to flying high in the vault
        for (const y of [0.4, 1.6, 4, 8, 12]) {
          const eye: Vec3 = [x, y, z]
          for (const target of targets) {
            rays++
            // Where the ray passes the Lobby’s south wall, the walls the placement rays meet only reach up to its top: the lunette above stops it there.
            const crossing = eye[1] + (lobby.southZ - eye[2]) / (target[2] - eye[2]) * (target[1] - eye[1])
            if (crossing > wallTop) {
              expect(crossing).toBeLessThan(lobbyVault.crownY)
              overWall++
              continue
            }
            const distance = Math.hypot(...target.map((value, axis) => value - eye[axis]))
            expect(slopGallery.wallDistance(eye, toward(eye, target))).toBeLessThan(distance)
          }
        }
      }
    }
    expect(rays).toBeGreaterThan(10_000)
    expect(overWall).toBeLessThan(rays / 4)
    // The Lobby keeps Moonfall hidden, while from the north end of the gallery the same stairs are in sight.
    expect(enabledRooms(slopGallery.fencesIn('lobby'))).not.toContain('moonfall')
    const galleryNorth: Vec3 = [antechamberGallery.center[0], 1.6, antechamberGallery.center[1] - antechamberGallery.size[1] / 2 + 0.5]
    const head: Vec3 = [upper.start[0], 1, upper.start[2] + 2]
    expect(slopGallery.wallDistance(galleryNorth, toward(galleryNorth, head))).toBeGreaterThan(Math.hypot(...head.map((value, axis) => value - galleryNorth[axis])))
  })
  test('the oculi pierce the middle of the flat ceilings, clear of their walls, and the stained glass tints the sun over every part', () => {
    for (const {center: [x, z], radius, underside} of antechamberOculi) {
      const part = [antechamberWings.west, antechamberWings.east, antechamberGallery, antechamberLanding].find(value => inside(value, x, z))!
      expect(part).toBeDefined()
      expect(Math.abs(x - part.center[0]) + radius).toBeLessThan(part.size[0] / 2 - 0.35)
      expect(Math.abs(z - part.center[1]) + radius).toBeLessThan(part.size[1] / 2 - 0.35)
      expect(underside).toBeLessThan(('floorY' in part ? part.floorY : 0) + part.height)
    }
    for (const part of [antechamber, antechamberWings.west, antechamberWings.east, antechamberGallery]) {
      expect(antechamberPlans.some(plan => inside(plan, part.center[0], part.center[1]))).toBe(true)
    }
    for (const block of antechamberStairs.blocks) {
      expect(antechamberPlans.some(plan => inside(plan, block.position[0], block.position[2]))).toBe(true)
    }
  })
  test('the east wing’s flight climbs as steep as the stairs down to Moonfall, its ceiling as high over it as theirs', () => {
    const [upper] = stairFlights
    expect(antechamberStairs.rise).toBeCloseTo(upper.rise, 9)
    expect(antechamberStairs.run).toBeCloseTo(upper.run, 9)
    expect(antechamberStairs.end).toEqual([antechamberWings.east.center[0] + antechamberWings.east.size[0] / 2, 0, antechamberWings.east.center[1]])
    expect(antechamberStairs.headroom).toBe(stairHeadroom)
    expect(antechamberLanding.floorY).toBe(antechamberStairs.start[1])
  })
  for (const fps of [30, 60, 120]) {
    for (const ascending of [true, false]) {
      for (const offset of [-0.5, 0, 0.5]) {
        test(`${ascending ? 'climbs' : 'descends'} the east wing’s flight at ${fps} Hz, offset ${offset}`, () => {
          const world = new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0,
          })
          world.timestep = 1 / fps
          const geometries = walls.filter(wall => wall.id.startsWith('antechamber-stairs_') || wall.id.startsWith('antechamber-landing_') || wall.id.startsWith('antechamber-east_wing_')).map(wall => ({
            wall,
            geometry: createArchitectureGeometry(wall),
          }))
          try {
            for (const {wall, geometry} of geometries) {
              const rotation = new Quaternion
              rotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
              for (const [vertices, indices] of geometry.collision) {
                world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setContactSkin(weldedSurfaceSkin).setTranslation(...wall.center).setRotation(rotation))
              }
            }
            for (const block of antechamberStairs.blocks) {
              world.createCollider(RAPIER.ColliderDesc.cuboid(block.size[0] / 2, block.size[1] / 2, block.size[2] / 2).setTranslation(...block.position))
            }
            const [landingX, landingZ] = antechamberLanding.center
            const [landingWidth, landingDepth] = antechamberLanding.size
            world.createCollider(RAPIER.ColliderDesc.cuboid(landingWidth / 2, 0.3, landingDepth / 2).setTranslation(landingX, antechamberLanding.floorY - 0.3, landingZ))
            const roof = antechamberStairs.beam(stairHeadroom, 0.18, antechamberStairs.width)
            const roofRotation = new Quaternion
            roofRotation.setFromEuler(new Euler(...roof.rotation))
            world.createCollider(RAPIER.ColliderDesc.cuboid(roof.size[0] / 2, roof.size[1] / 2, roof.size[2] / 2).setTranslation(...roof.position).setRotation(roofRotation))
            const wing = antechamberWings.east
            world.createCollider(RAPIER.ColliderDesc.cuboid(wing.size[0] / 2, 0.12, wing.size[1] / 2).setTranslation(wing.center[0], -0.12, wing.center[1]))
            const path: Array<readonly [number, number]> = [[wing.center[0], wing.center[1] + offset], [antechamberStairs.end[0] + 0.5, wing.center[1] + offset], [landingX, landingZ + offset]]
            if (!ascending) {
              path.reverse()
            }
            const startY = ascending ? 0 : antechamberLanding.floorY
            const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(path[0][0], startY + 0.04, path[0][1]))
            const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
            const motor = new EgoMotor(RAPIER, world, body, collider)
            const facing = new Quaternion
            try {
              for (let i = 0; i < 30; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              let target = 1
              for (let i = 0; i < fps * 16 && target < path.length; i++) {
                const position = body.translation()
                const dx = path[target][0] - position.x
                const dz = path[target][1] - position.z
                if (Math.hypot(dx, dz) < Math.max(0.14, 3 / fps)) {
                  target++
                  continue
                }
                facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-dx, -dz))
                motor.step(world.timestep, {forward: true}, facing)
                world.step()
              }
              expect(target).toBe(path.length)
              for (let i = 0; i < 60; i++) {
                motor.step(world.timestep, {}, facing)
                world.step()
              }
              expect(body.translation().y).toBeCloseTo((ascending ? antechamberLanding.floorY : 0) + 0.02, 2)
              expect(motor.grounded).toBe(true)
            } finally {
              motor.dispose()
            }
          } finally {
            world.free()
            for (const {geometry} of geometries) {
              geometry.dispose()
            }
          }
        })
      }
    }
  }
})
