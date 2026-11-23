import type {Vec3} from '../../src/lib/gallery/types.ts'

import {afterAll, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Box3, Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {antechamberArch, antechamberLanding, antechamberLandingSlab, antechamberSize, antechamberStairBlocks, antechamberStairs, antechamberStairWallDepth, antechamberZ, stairHallHeight, stairHalls} from '../../src/lib/gallery/antechamber.ts'
import {createArchitectureGeometry} from '../../src/lib/gallery/architecture.ts'
import {floorThickness} from '../../src/lib/gallery/floors.ts'
import lobby from '../../src/lib/gallery/lobby.ts'
import lobbyVault from '../../src/lib/gallery/lobbyVault.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {ceilingMirrorY, ceilingSlab, moonfallHeight} from '../../src/lib/gallery/moonfall/config.ts'
import {siennaVestibule} from '../../src/lib/gallery/sienna.ts'
import {stairBlocks, stairFlights, stairTurn} from '../../src/lib/gallery/staircase.ts'
import {stairHeadroom} from '../../src/lib/gallery/stairs/StairFlight.ts'
import {weldedSurfaceSkin} from '../../src/lib/physics/weldedSurface.ts'
import {enabledRooms, litFences} from '../../src/worlds/gallery/activations.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const {moonfall} = lowerGallery
const moonfallEastX = moonfall.center[0] + moonfall.size[0] / 2
const solarHall = stairHalls.west
const lunarHall = stairHalls.east
const flightWalls = walls.filter(wall => wall.id.startsWith('antechamber-stairs_'))
const material = new MeshBasicMaterial
afterAll(() => {
  material.dispose()
})
/** the unit direction from one point to another */
const toward = (from: Vec3, to: Vec3): Vec3 => {
  const delta = to.map((value, axis) => value - from[axis]) as Vec3
  const length = Math.hypot(...delta)
  return delta.map(value => value / length) as Vec3
}
const distance = (from: Vec3, to: Vec3) => Math.hypot(...to.map((value, axis) => value - from[axis]))
/** Whether nothing but air lies between the points, by the walls the placement rays meet. */
const clear = (from: Vec3, to: Vec3) => slopGallery.wallDistance(from, toward(from, to)) > distance(from, to)
/** The wall’s surface as a mesh in the museum’s frame. */
const wallMesh = (id: string) => {
  const wall = walls.find(value => value.id === id)!
  const geometry = createArchitectureGeometry(wall)
  const mesh = new Mesh(geometry.surface, material)
  mesh.position.set(...wall.center)
  mesh.rotation.y = wall.rotation
  mesh.updateMatrixWorld(true)
  return {
    mesh,
    geometry,
  }
}
describe('the Antechamber’s halls', () => {
  test('a hall off either side wall of the dome, centered on it, neither reaching into the Lobby, the Sienna or its vestibule', () => {
    const [width, depth] = antechamberSize
    for (const [side, hall] of [[-1, solarHall], [1, lunarHall]] as const) {
      expect(hall.center[1]).toBe(antechamberZ)
      expect(hall.center[0] - side * hall.size[0] / 2).toBe(side * width / 2)
      expect(hall.center[1] - hall.size[1] / 2).toBeGreaterThan(lobby.southZ)
      expect(hall.size[1]).toBeLessThan(depth)
    }
    const sienna = slopGallery.room('sienna')
    const flightWest = antechamberStairs.end[0] - antechamberStairs.width / 2
    expect(solarHall.center[0] - solarHall.size[0] / 2).toBeGreaterThan(sienna.center[0] + sienna.size[0] / 2)
    expect(flightWest).toBeGreaterThan(sienna.center[0] + sienna.size[0] / 2)
    expect(flightWest).toBeGreaterThan(siennaVestibule.center[0] + siennaVestibule.size[0] / 2)
    // Its parts hold a player on their own floors, and only there.
    for (const {center: [x, z]} of [solarHall, lunarHall]) {
      const position: Vec3 = [x, 1.6, z]
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('antechamber')
      expect(floorHeight(position)).toBe(0)
      // up to their ceilings
      expect(insideGallery([x, stairHallHeight + 0.1, z])).toBe(true)
      expect(insideGallery([x, stairHallHeight + 0.3, z])).toBe(false)
    }
    for (const block of antechamberStairs.blocks) {
      const position: Vec3 = [block.position[0], block.top + 1.6, block.position[2]]
      expect(insideGallery(position)).toBe(true)
      expect(roomAt(position)).toBe('antechamber')
      expect(floorHeight(position)).toBeCloseTo(block.top, 9)
    }
    const [landingX, landingZ] = antechamberLanding.center
    expect(floorHeight([landingX, antechamberLanding.floorY + 1.6, landingZ])).toBeCloseTo(antechamberLanding.floorY, 9)
    expect(roomAt([landingX, antechamberLanding.floorY + 1.6, landingZ])).toBe('antechamber')
    expect(insideGallery([landingX, antechamberLanding.floorY + 1.6, landingZ + antechamberLanding.size[1]])).toBe(false)
    // beside the flight, south of the solar hall, and south of the dome between the halls, there is nothing
    expect(insideGallery([solarHall.center[0] + 2.5, 1.6, solarHall.center[1] + 4])).toBe(false)
    expect(insideGallery([0, 1.6, antechamberZ + 5])).toBe(false)
  })
  test('the stairs down to Moonfall leave the lunar hall in line with both arches and lie wholly east of Moonfall’s hall, none of them under the lunar hall', () => {
    const [upper, lower] = stairFlights
    expect(upper.start).toEqual([lunarHall.center[0] + lunarHall.size[0] / 2, 0, antechamberZ])
    expect(lower.end).toEqual([moonfallEastX, lowerGallery.floorY, moonfall.center[1]])
    for (const block of stairBlocks) {
      const west = block.position[0] - block.size[0] / 2
      expect(west).toBeGreaterThanOrEqual(moonfallEastX - 1e-9)
      if (west < upper.start[0]) {
        expect(block.position[2] - block.size[2] / 2).toBeGreaterThan(lunarHall.center[1] + lunarHall.size[1] / 2)
      }
    }
    const stairWalls = walls.filter(value => value.id.startsWith('moonfall-stairs_'))
    for (const wall of stairWalls) {
      for (const end of [-1, 1]) {
        expect(wall.center[0] + Math.cos(wall.rotation) * end * wall.width / 2).toBeGreaterThanOrEqual(moonfallEastX - 1e-9)
      }
    }
    // Every tread down is as deep as every other, and the turn lies between both flights without another riser.
    expect(lower.run).toBeCloseTo(upper.run, 9)
    expect(lower.rise).toBeCloseTo(upper.rise, 9)
    expect(stairTurn.top).toBe(upper.end[1])
    expect(lower.start[1]).toBe(upper.end[1])
  })
  test('with nothing of the stairs over it, Moonfall’s ceiling rises right up to the underside of the ground floor’s slabs, 1.89 m higher than before', () => {
    expect(lowerGallery.floorY + ceilingSlab.center + ceilingSlab.thickness / 2).toBeCloseTo(-floorThickness, 9)
    // where the top of the slab used to be
    expect(ceilingSlab.center + ceilingSlab.thickness / 2 - 5.87).toBeCloseTo(1.89, 9)
    expect(ceilingMirrorY).toBeCloseTo(ceilingSlab.center - ceilingSlab.thickness / 2 - 0.01, 9)
    const room = slopGallery.room('moonfall')
    expect(room.height).toBe(moonfallHeight)
    expect(room.air[0].max.y - room.floorY).toBeCloseTo(moonfallHeight, 9)
    const hallWalls = walls.filter(value => ['moonfall-east', 'moonfall-north', 'moonfall-south', 'moonfall-west'].includes(value.id))
    expect(hallWalls).toHaveLength(4)
    for (const wall of hallWalls) {
      // Its walls end inside the slab, which their cornices tuck under.
      const top = wall.center[1] + wall.height + 0.3
      expect(top).toBeGreaterThan(lowerGallery.floorY + ceilingSlab.center - ceilingSlab.thickness / 2)
      expect(top).toBeLessThan(lowerGallery.floorY + ceilingSlab.center + ceilingSlab.thickness / 2)
    }
    // Under the Lobby’s south part, the dome, the solar hall and its flight and the Sienna’s vestibule, Moonfall reaches up to the slab, and over it the room above begins.
    const underMirror = lowerGallery.floorY + ceilingMirrorY - 0.05
    for (const [x, z] of [[-8, 6], [0, antechamberZ], solarHall.center, [antechamberStairs.end[0], antechamberStairs.end[2] + 0.2], [-20, 23]]) {
      expect(roomAt([x, -0.3, z])).toBe('moonfall')
      expect(roomAt([x, 0.5, z])).not.toBe('moonfall')
      // Right under its mirror, high in its air, Moonfall’s own floor lies under a point, not the floor over the slab.
      expect(roomAt([x, underMirror, z])).toBe('moonfall')
      expect(floorHeight([x, underMirror, z])).toBeLessThanOrEqual(lowerGallery.floorY)
      expect(floorHeight([x, -0.1, z])).toBeGreaterThanOrEqual(0)
    }
  })
  test('no line of sight from anywhere in the Lobby, or from the Vesper or the Banquet across it, reaches the stairs down to Moonfall, which the dome and both halls see straight through the arches', () => {
    const [upper] = stairFlights
    const doorway = walls.find(wall => wall.id === 'antechamber-east_east')!.holes![0]
    // Walls, roof and the ground enclose the stairway, so every line of sight onto it passes its doorway: points across the doorway, from the floor to its lintel, just beyond the middle of the wall.
    const targets = Array.from({length: 7}, (_, i) => i / 6 - 0.5).flatMap(across => Array.from({length: 7}, (_, j) => 0.01 + j / 6 * (doorway.height - 0.02)).map((y): Vec3 => [upper.start[0] + 0.01, y, upper.start[2] + across * 0.998 * doorway.width]))
    const lobbyWall = walls.find(wall => wall.id === 'lobby-south')!
    /** how high the Lobby’s south wall reaches for the placement rays: under the band of its cornice, over which the vault’s south lunette closes the wall’s plane up to the crown */
    const wallTop = lobbyWall.center[1] + lobbyWall.height
    // in the Lobby from the floor up to flying high in the vault, right up to the doorway, and on either side of it across the Vesper and the Banquet, whose south walls run in line with the Lobby’s
    const eyes: Array<Vec3> = []
    for (let x = -lobby.width / 2 + 0.5; x <= lobby.width / 2 - 0.5; x += 1.5) {
      for (const z of [...Array.from({length: 20}, (_, i) => lobby.northZ + 0.5 + i * 2), lobby.southZ - 0.12]) {
        eyes.push(...[0.4, 1.6, 4, 8, 12].map((y): Vec3 => [x, y, z]))
      }
    }
    for (const id of ['vesper', 'banquet'] as const) {
      const {min, max} = slopGallery.room(id).air[0]
      expect(max.z).toBe(lobby.southZ)
      for (let x = min.x + 0.5; x <= max.x - 0.5; x += 1.5) {
        for (let z = min.z + 0.5; z <= max.z - 0.1; z += 2) {
          eyes.push(...[0.4, 1.6, 4].map((y): Vec3 => [x, y, z]))
        }
      }
      expect(enabledRooms(slopGallery.fencesIn(id))).not.toContain('moonfall')
    }
    let rays = 0
    let overWall = 0
    for (const eye of eyes) {
      for (const target of targets) {
        rays++
        // Where the ray passes the line of the south walls over the walls the placement rays meet, far over the doorway, a cornice or the lunette above stops it.
        const crossing = eye[1] + (lobby.southZ - eye[2]) / (target[2] - eye[2]) * (target[1] - eye[1])
        if (crossing > wallTop) {
          expect(crossing).toBeLessThan(lobbyVault.crownY)
          overWall++
          continue
        }
        expect(clear(eye, target)).toBe(false)
      }
    }
    expect(rays).toBeGreaterThan(80_000)
    expect(overWall).toBeLessThan(rays / 4)
    // The Lobby keeps Moonfall hidden, while from the dome and both halls the doorway onto the stairs is in sight, all the way across.
    expect(enabledRooms(slopGallery.fencesIn('lobby'))).not.toContain('moonfall')
    expect(enabledRooms(slopGallery.fencesIn('antechamber'))).toContain('moonfall')
    for (const eye of [[solarHall.center[0], 1.6, antechamberZ], [0, 1.6, antechamberZ], [lunarHall.center[0], 1.6, antechamberZ]] satisfies Array<Vec3>) {
      for (const across of [-0.45, 0, 0.45]) {
        expect(clear(eye, [upper.start[0] + 2, 1, upper.start[2] + across * antechamberArch.width * 0.9])).toBe(true)
      }
    }
  })
  test('the lamps of the halls stay on wherever their light shows: from the Lobby and from the Vesper and the Banquet across it, and up the stairs from Moonfall', () => {
    for (const lamp of ['antechamber-west', 'antechamber-east']) {
      expect(litFences('antechamber', lamp).toSorted()).toEqual(['antechamber', 'banquet', 'lobby', 'moonfall', 'vesper'])
    }
  })
})
describe('the flight up out of the solar hall', () => {
  test('climbs as steep as the stairs down to Moonfall, its roof as high over it as theirs, to a landing halfway up to a floor clear of the ground floor’s ceilings', () => {
    const [upper] = stairFlights
    expect(antechamberStairs.rise).toBeCloseTo(upper.rise, 9)
    expect(antechamberStairs.run).toBeCloseTo(upper.run, 9)
    expect(antechamberStairs.end).toEqual([solarHall.center[0], 0, solarHall.center[1] + solarHall.size[1] / 2])
    expect(antechamberStairs.headroom).toBe(stairHeadroom)
    expect(antechamberLanding.floorY).toBe(antechamberStairs.start[1])
    expect(antechamberLanding.height).toBe(stairHeadroom)
    expect(antechamberLanding.center[1] - antechamberLanding.size[1] / 2).toBeCloseTo(antechamberStairs.start[2], 9)
    // Twice as high, a floor’s slab would clear the ground floor’s ceilings, whose slabs reach 5.87 m.
    expect(2 * antechamberLanding.floorY - floorThickness).toBeGreaterThan(5.87)
  })
  test('its blocks and its walls stand on Moonfall’s ceiling without reaching under the ground floor’s slab, the walls closing every tread’s edge', () => {
    for (const block of antechamberStairBlocks) {
      expect(block.position[1] - block.size[1] / 2).toBeGreaterThanOrEqual(-floorThickness - 1e-9)
      expect(block.position[1] + block.size[1] / 2).toBeCloseTo(block.top, 9)
    }
    expect(antechamberStairBlocks.at(-1)!.size[1]).toBeCloseTo(floorThickness, 9)
    // each tread a riser under the grade at its back, and the walls deeper still
    expect(antechamberStairWallDepth).toBeGreaterThan(antechamberStairs.rise)
    expect(flightWalls).toHaveLength(2)
    for (const {id} of flightWalls) {
      const {mesh, geometry} = wallMesh(id)
      try {
        const bounds = new Box3
        expect(bounds.setFromObject(mesh).min.y).toBeGreaterThanOrEqual(-floorThickness - 1e-6)
        const side = Math.sign(mesh.position.x - antechamberStairs.end[0])
        for (const block of antechamberStairs.blocks) {
          for (const edge of [-0.499, 0, 0.499]) {
            const z = block.position[2] + block.size[2] * edge
            const ray = new Raycaster(new Vector3(block.position[0], block.top + 0.001, z), new Vector3(side, 0, 0), 0, antechamberStairs.width / 2 + 0.5)
            expect(ray.intersectObject(mesh).length).toBeGreaterThan(0)
          }
        }
      } finally {
        geometry.dispose()
      }
    }
  })
  for (const fps of [30, 60, 120]) {
    for (const ascending of [true, false]) {
      for (const offset of [-0.6, 0, 0.6]) {
        test(`${ascending ? 'climbs' : 'descends'} it at ${fps} Hz, offset ${offset}`, () => {
          const world = new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0,
          })
          world.timestep = 1 / fps
          const geometries = walls.filter(wall => wall.id.startsWith('antechamber-stairs_') || wall.id.startsWith('antechamber-landing_') || wall.id === 'antechamber-west_south').map(wall => ({
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
            const box = (position: Vec3, size: Vec3, rotation?: Vec3) => {
              const collider = RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position)
              if (rotation) {
                const quaternion = new Quaternion
                collider.setRotation(quaternion.setFromEuler(new Euler(...rotation)))
              }
              world.createCollider(collider)
            }
            for (const block of antechamberStairBlocks) {
              box(block.position, block.size)
            }
            const roof = antechamberStairs.beam(stairHeadroom, 0.18, antechamberStairs.width)
            box(roof.position, roof.size, roof.rotation)
            const [landingX, landingZ] = antechamberLanding.center
            const [landingWidth, landingDepth] = antechamberLanding.size
            box([landingX, antechamberLanding.floorY - antechamberLandingSlab.floor / 2, landingZ], [landingWidth, antechamberLandingSlab.floor, landingDepth])
            box([landingX, antechamberLanding.floorY + antechamberLanding.height, landingZ], [landingWidth, antechamberLandingSlab.ceiling, landingDepth])
            box([solarHall.center[0], -floorThickness / 2, solarHall.center[1]], [solarHall.size[0], floorThickness, solarHall.size[1]])
            const path: Array<readonly [number, number]> = [[solarHall.center[0] + offset, solarHall.center[1]], [antechamberStairs.end[0] + offset, antechamberStairs.end[2] - 0.5], [landingX + offset, landingZ]]
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
