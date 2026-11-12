import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {Wall} from '../../src/lib/placement/wallGeometry.ts'

import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import EgoMotor from 'ego-player/motor'
import {Euler, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry, createArchitectureGeometry, wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import DisplayPedestalGeometry from '../../src/lib/gallery/DisplayPedestalGeometry.ts'
import lowerGallery, {tunnelFloorHeight, tunnelSkew, tunnelSlope, tunnelX} from '../../src/lib/gallery/lowerGallery.ts'
import oculusBalcony from '../../src/lib/gallery/oculusBalcony.ts'
import oculusTower from '../../src/lib/gallery/oculusTower.ts'
import SlopedBoxGeometry from '../../src/lib/gallery/SlopedBoxGeometry.ts'
import tunnelDisplays, {displayStairway, tunnelDisplayWindow} from '../../src/lib/gallery/tunnelDisplays.ts'
import {exhibitionPedestal, exhibitionPedestalLobes, exhibitionSlots} from '../../src/rooms/exhibition/exhibits.ts'
import walls, {floorHeight, galleryPlacement, insideGallery, roomAt} from './fixtures/gallery.ts'

await RAPIER.init()
const {oculus, tunnel} = lowerGallery
const floorY = tunnelFloorHeight((tunnel.northZ + tunnel.southZ) / 2)
const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
type Display = (typeof tunnelDisplays)[number]
/** the colliders between the Oculus balcony and the display: the balcony, the Oculus’ side wall with its door, the stairway and the display’s shell */
function stairwayWorld(display: Display) {
  const world = new RAPIER.World({
    x: 0,
    y: -9.81,
    z: 0,
  })
  world.timestep = 1 / 60
  for (const wall of [walls.find(value => value.id === `oculus-${display.side}`)!, walls.find(value => value.id === `exhibition-${display.side}`)!, ...display.stairway.walls]) {
    const geometry = createArchitectureGeometry(wall)
    const wallRotation = new Quaternion
    wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
    for (const collision of geometry.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...wall.center).setRotation(wallRotation))
    }
    geometry.dispose()
  }
  const box = (position: Vec3, size: Vec3) => world.createCollider(RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2).setTranslation(...position))
  for (const {position, size} of [oculusBalcony, ...display.stairway.treads]) {
    box(position, size)
  }
  for (const {position, rotation, size} of [...display.stairway.slabs, ...display.stairway.roofs]) {
    const boxRotation = new Quaternion
    box(position, size).setRotation(boxRotation.setFromEuler(new Euler(...rotation)))
  }
  for (const {position, size} of display.shell) {
    const slab = new SlopedBoxGeometry(...size, tunnelSlope, tunnelSlope, tunnelSkew)
    slab.translate(...position)
    world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(slab)))
    slab.dispose()
  }
  const pedestal = new DisplayPedestalGeometry({
    direction: display.side === 'west' ? 1 : -1,
    lobes: exhibitionPedestalLobes,
    plinth: exhibitionPedestal.plinth,
    slope: tunnelSlope,
    skew: tunnelSkew,
  })
  for (const slot of exhibitionSlots) {
    if (!display.exhibits.some(exhibit => exhibit.id === slot.id)) {
      continue
    }
    for (const collision of pedestal.collision) {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...slot.pedestal))
    }
  }
  pedestal.dispose()
  return world
}
/** the meshes of the walls, as placed in the world */
function wallMeshes(list: Array<Wall>, material: MeshBasicMaterial) {
  const geometries = list.map(wall => createArchitectureGeometry(wall))
  const meshes = list.flatMap((wall, i) => [geometries[i].surface, ...geometries[i].trim].map(part => {
    const mesh = new Mesh(part, material)
    mesh.position.set(...wall.center)
    mesh.rotation.y = wall.rotation
    mesh.updateMatrixWorld(true)
    return mesh
  }))
  return {
    meshes,
    dispose: () => {
      for (const geometry of geometries) {
        geometry.dispose()
      }
    },
  }
}
describe('tower-wide tunnel with display rooms reached from the Oculus balcony', () => {
  test('both portals and floor bounds follow the tower-wide tunnel, and the displays are the Exhibition’s', () => {
    expect(tunnel.width).toBe(oculusTower.radius * 2)
    for (const id of ['oculus-south', 'moonfall-north']) {
      expect(walls.find(wall => wall.id === id)!.holes![0].width).toBe(tunnel.width)
    }
    // The doors to the stairways open in the side walls instead.
    expect(walls.find(wall => wall.id === 'oculus-south')!.holes).toHaveLength(1)
    expect(tunnelDisplays).toHaveLength(2)
    expect((tunnelDisplays[0].center[0] + tunnelDisplays[1].center[0]) / 2).toBeCloseTo(tunnelX(tunnelDisplays[0].center[1]))
    for (const display of tunnelDisplays) {
      expect(display.exhibits).toHaveLength(3)
      expect(insideGallery([display.center[0], floorY + 1.6, display.center[1]])).toBe(true)
      expect(roomAt([display.center[0], floorY + 1.6, display.center[1]])).toBe('exhibition')
      expect(insideGallery([tunnelX(display.center[1]) + (display.side === 'west' ? -1 : 1) * 1.8, floorY + 1.6, display.center[1]])).toBe(true)
      // beyond the stairway’s outer wall, between the display’s back wall and the middle flight, and between the upper and the lower flight
      const {corners, door, landing} = display.stairway
      const sign = display.side === 'west' ? -1 : 1
      const outerX = corners[0].center[0] + sign * (displayStairway.width / 2 + 0.3)
      const betweenX = (display.backAt(-10) + corners[0].center[0] - sign * displayStairway.width / 2) / 2
      for (const z of [-10, landing.center[1]]) {
        expect(insideGallery([outerX, tunnelFloorHeight(z) + 1.6, z])).toBe(false)
      }
      expect(insideGallery([betweenX, tunnelFloorHeight(-10) + 1.6, -10])).toBe(false)
      expect(insideGallery([(door[0] + corners[0].center[0]) / 2, door[1] + 1.6, door[2] + displayStairway.width])).toBe(false)
      for (const exhibit of display.exhibits) {
        expect(Math.abs(exhibit.position[0] - (display.frontAt(exhibit.position[2]) + display.backAt(exhibit.position[2])) / 2) + 0.7).toBeLessThan(display.size[0] / 2)
        expect(Math.abs(exhibit.position[2] - display.center[1]) + 0.7).toBeLessThan(display.size[1] / 2)
      }
    }
    const exhibitIds = new Set(tunnelDisplays.flatMap(display => display.exhibits.map(exhibit => exhibit.id)))
    expect(exhibitIds.size).toBe(6)
  })
  test('the diagonal joins both room midpoints and gives the staff routes different returns', () => {
    expect(tunnel.southX).toBe(lowerGallery.moonfall.center[0])
    expect(tunnel.northX).toBe(oculus.center[0])
    expect(walls.find(wall => wall.id === 'moonfall-north')!.holes![0].u).toBe(0)
    expect(walls.find(wall => wall.id === 'oculus-south')!.holes![0].u).toBe(0)
    const [west, east] = tunnelDisplays.map(display => display.stairway.flights[2])
    expect(east.length).toBeGreaterThan(west.length * 5)
    expect(east.run).toBeGreaterThan(west.run * 2)
    expect(east.rise).toBeCloseTo(west.rise)
  })
  for (const display of tunnelDisplays) {
    const {corners, cutout, door, flights, landing, ramp} = display.stairway
    const sign = display.side === 'west' ? -1 : 1
    const southZ = display.center[1] + display.size[1] / 2
    const cutoutX = (cutout.from + cutout.to) / 2
    test(`${display.side}: a door in the Oculus’ side wall at the balcony’s end opens onto the stairway, whose even steps and floors are the Exhibition’s`, () => {
      const balconyNorthZ = oculusBalcony.position[2] - oculusBalcony.size[2] / 2
      expect(door[1]).toBe(balconyY)
      expect(door[2] - displayStairway.doorWidth / 2 - wallOpeningTrim).toBeGreaterThan(balconyNorthZ)
      expect(door[2] + displayStairway.doorWidth / 2 + wallOpeningTrim).toBeLessThan(tunnel.northZ - wallFace)
      // Each flight sets off from the floor above and ends a step over the one below, and every step rises alike, as the ramp from the upper corner down to the middle flight takes up less than a step of the drop.
      const rampFall = -ramp.slope! * ramp.size[1]
      expect(ramp.floor).toBe(corners[0].floor)
      expect(rampFall).toBeGreaterThanOrEqual(0)
      expect(rampFall).toBeLessThan(displayStairway.rise)
      const floors: Array<[number, number]> = [[balconyY, corners[0].floor], [ramp.floor - rampFall, corners[1].floor], [corners[1].floor, landing.floor]]
      expect(landing.floor).toBeCloseTo(tunnelFloorHeight(southZ))
      expect(flights[0].start).toEqual([door[0], balconyY, door[2]])
      expect(flights[0].count).toBe(displayStairway.upperSteps)
      expect(flights[0].entryLanding).toBeGreaterThanOrEqual(wallFace + displayStairway.threshold)
      for (const [i, flight] of flights.entries()) {
        expect(flight.start[1]).toBeCloseTo(floors[i][0])
        expect(flight.end[1]).toBeCloseTo(floors[i][1] + flight.rise)
        expect(flight.rise).toBeCloseTo(displayStairway.rise, 9)
        expect(flight.run).toBeGreaterThanOrEqual(displayStairway.going - 1e-9)
      }
      // The middle flight leaves the ramp south of the upper corner and runs unbroken into the lower corner.
      expect(ramp.center[1] - ramp.size[1] / 2).toBeCloseTo(corners[0].center[1] + corners[0].size[1] / 2)
      expect(flights[1].start[2]).toBeCloseTo(ramp.center[1] + ramp.size[1] / 2)
      expect(flights[1].end[2]).toBeCloseTo(corners[1].center[1] - corners[1].size[1] / 2)
      // the Oculus’ side wall and the stairway’s wall behind it, back to back
      const material = new MeshBasicMaterial
      const doorWalls = wallMeshes([walls.find(value => value.id === `oculus-${display.side}`)!, display.stairway.walls.find(wall => wall.holes?.length)!], material)
      try {
        for (const offset of [-0.6, 0, 0.6]) {
          for (const height of [0.1, 1.6, displayStairway.doorHeight - 0.1]) {
            const ray = new Raycaster(new Vector3(door[0] - sign * 0.5, balconyY + height, door[2] + offset), new Vector3(sign, 0, 0), 0, 1)
            expect(ray.intersectObjects(doorWalls.meshes)).toHaveLength(0)
          }
        }
        for (const [offset, height] of [[0, displayStairway.doorHeight + 0.15], [-1.2, 1.6], [1.2, 1.6]]) {
          const ray = new Raycaster(new Vector3(door[0] - sign * 0.5, balconyY + height, door[2] + offset), new Vector3(sign, 0, 0), 0, 1)
          expect(ray.intersectObjects(doorWalls.meshes).length).toBeGreaterThan(0)
        }
      } finally {
        doorWalls.dispose()
        material.dispose()
      }
      const positions: Array<[Vec3, number]> = [
        ...display.stairway.treads.map((block): [Vec3, number] => [[block.position[0], block.top + 1.6, block.position[2]], block.top]),
        ...[...corners, ramp, landing].flatMap(({center, size, floor, slope = 0}) => [-0.45, 0, 0.45].map((offset): [Vec3, number] => {
          const z = center[1] + offset * size[1]
          const y = floor + (z - center[1] + size[1] / 2) * slope
          return [[center[0], y + 1.6, z], y]
        })),
      ]
      for (const [position, floor] of positions) {
        expect(insideGallery(position)).toBe(true)
        expect(roomAt(position)).toBe('exhibition')
        expect(floorHeight(position)).toBeCloseTo(floor)
      }
    })
    test(`${display.side}: the cutout in the display’s south end wall opens onto the landing up to the display’s ceiling`, () => {
      const material = new MeshBasicMaterial
      const shell = display.shell.map(({position, size}) => {
        const slab = new SlopedBoxGeometry(...size, tunnelSlope, tunnelSlope, tunnelSkew)
        slab.translate(...position)
        return new Mesh(slab, material)
      })
      const landingWalls = wallMeshes(display.stairway.walls.filter(wall => wall.id.includes('landing')), material)
      const meshes = [...shell, ...landingWalls.meshes]
      const southward = new Vector3(tunnelSkew, 0, 1)
      southward.normalize()
      const cast = (x: number, height: number) => {
        const ray = new Raycaster(new Vector3(x - tunnelSkew * 0.3, tunnelFloorHeight(southZ) + height, southZ - 0.3), southward, 0, 0.53)
        return ray.intersectObjects(meshes)
      }
      try {
        // The landing’s ceiling meets the display’s, which reaches over the south end wall.
        expect(cutout.top).toBeCloseTo(landing.floor + landing.headroom - 0.09)
        expect(cutout.top).toBeGreaterThan(tunnelFloorHeight(southZ) + tunnel.height)
        for (const x of [cutout.from + sign * 0.1, cutoutX, cutout.to - sign * 0.1]) {
          for (const height of [0.1, 1.6, tunnel.height - 0.15]) {
            expect(cast(x, height)).toHaveLength(0)
          }
          const up = new Raycaster(new Vector3(x, landing.floor + 1.6, southZ + 0.09), new Vector3(0, 1, 0), 0, tunnel.height)
          expect(up.intersectObjects(meshes)[0]?.point.y).toBeCloseTo(tunnelFloorHeight(southZ + 0.09) + tunnel.height, 3)
        }
        expect(cast(cutout.from - sign * 0.05, 1.6).length).toBeGreaterThan(0)
        // The display’s back wall reaches on past the south end wall as the cutout’s other jamb.
        const jamb = new Raycaster(new Vector3(cutoutX, landing.floor + 1.6, southZ + 0.05), new Vector3(sign, 0, 0), 0, displayStairway.cutoutWidth)
        expect(jamb.intersectObjects(meshes)[0]?.distance).toBeCloseTo(displayStairway.cutoutWidth / 2 + sign * tunnelSkew * 0.05)
      } finally {
        for (const mesh of shell) {
          mesh.geometry.dispose()
        }
        landingWalls.dispose()
        material.dispose()
      }
    })
    for (const returning of [false, true]) {
      test(`${display.side}: the player walks ${returning ? 'up from the display to the balcony' : 'down from the balcony into the display'}`, () => {
        const world = stairwayWorld(display)
        const bayEntryZ = southZ - 0.4
        const bayEndZ = display.center[1] - display.size[1] / 2 + 0.4
        const path: Array<[number, number]> = [[door[0] - sign * 1.5, door[2]], [corners[0].center[0], door[2]], [corners[0].center[0], corners[1].center[1]], [cutoutX, corners[1].center[1]], [cutoutX - tunnelSkew * 0.4, bayEntryZ], [display.frontAt(bayEntryZ) + sign * 0.52, bayEntryZ], [display.frontAt(bayEndZ) + sign * 0.52, bayEndZ]]
        if (returning) {
          path.reverse()
        }
        const [start] = path
        const startY = returning ? tunnelFloorHeight(start[1]) : balconyY
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start[0], startY + 0.04, start[1]))
        const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
        const motor = new EgoMotor(RAPIER, world, body, collider)
        const facing = new Quaternion
        try {
          for (const target of path.slice(1)) {
            const distance = () => Math.hypot(body.translation().x - target[0], body.translation().z - target[1])
            for (let i = 0; i < 60 * 12 && distance() > 0.15; i++) {
              const {x, y, z} = body.translation()
              facing.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(x - target[0], z - target[1]))
              motor.step(world.timestep, {forward: true}, facing)
              world.step()
              expect(insideGallery([x, y + 1.6, z])).toBe(true)
              // The balcony is the Oculus’, the stairway behind its door and the display the Exhibition’s.
              expect(roomAt([x, y + 1.6, z])).toBe(Math.abs(x - oculus.center[0]) <= oculus.size[0] / 2 && z <= tunnel.northZ ? 'oculus' : 'exhibition')
            }
            expect(distance()).toBeLessThan(0.15)
          }
          const end = path.at(-1)!
          expect(body.translation().y).toBeCloseTo((returning ? balconyY : tunnelFloorHeight(end[1])) + 0.02, 1)
          expect(motor.grounded).toBe(true)
          expect(motor.crouching).toBe(false)
        } finally {
          motor.dispose()
          world.free()
        }
      })
    }
    test(`${display.side}: ceilings close every staff-route joint, including the diagonal bay’s cutout`, () => {
      const world = stairwayWorld(display)
      const bayZ = southZ - 0.4
      const path: Array<[number, number]> = [[door[0], door[2]], [corners[0].center[0], door[2]], [corners[1].center[0], corners[1].center[1]], [cutoutX, corners[1].center[1]], [cutoutX - tunnelSkew * 0.4, bayZ]]
      try {
        world.step()
        for (let segment = 1; segment < path.length; segment++) {
          const [ax, az] = path[segment - 1]
          const [bx, bz] = path[segment]
          const length = Math.hypot(bx - ax, bz - az)
          for (let step = 0; step <= Math.ceil(length / 0.05); step++) {
            const t = step / Math.ceil(length / 0.05)
            for (const offset of [-0.3, 0, 0.3]) {
              const x = ax + (bx - ax) * t - (bz - az) / length * offset
              const z = az + (bz - az) * t + (bx - ax) / length * offset
              const floor = floorHeight([x, -3, z])
              const ray = new RAPIER.Ray({
                x,
                y: floor + 1.6,
                z,
              }, {
                x: 0,
                y: 1,
                z: 0,
              })
              const roof = world.castRay(ray, 3, true)
              expect(roof).not.toBeNull()
              expect(roof!.timeOfImpact).toBeGreaterThan(0.3)
            }
          }
        }
      } finally {
        world.free()
      }
    })
    test(`${display.side}: windows are real openings with glass collision, solid sills and a closed room shell`, () => {
      const wall = walls.find(value => value.id === `exhibition-${display.side}`)!
      const geometry = createArchitectureGeometry(wall)
      const material = new MeshBasicMaterial
      const opaque = [geometry.surface, ...geometry.trim].map(part => new Mesh(part, material))
      const glass = geometry.glazing.map(part => new Mesh(part, material))
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        expect(glass).toHaveLength(1)
        for (const collision of geometry.collision) {
          world.createCollider(RAPIER.ColliderDesc.trimesh(...collision))
        }
        world.step()
        for (const u of [-4.8, -2.5, 0, 2.5, 4.8]) {
          for (const y of [0.6, 1.62, 2.8]) {
            for (const side of [-1, 1]) {
              const origin = new Vector3(u, y + u * wall.slope!, side)
              const direction = new Vector3(0, 0, -side)
              const ray = new Raycaster(origin, direction, 0, 2)
              expect(ray.intersectObjects(opaque)).toHaveLength(0)
              const hit = ray.intersectObjects(glass)[0]
              expect(hit.point.z).toBeCloseTo((wallFace + side * tunnelDisplayWindow.glassThickness) / 2, 6)
              expect(world.castRay(new RAPIER.Ray(origin, direction), 2, true)!.timeOfImpact).toBeCloseTo(hit.distance, 6)
            }
          }
        }
        for (const [u, y] of [[0, 0.3], [0, 3], [-wall.holes![0].width / 2 - 0.2, 1.6], [wall.holes![0].width / 2 + 0.2, 1.6]]) {
          const surroundRay = new Raycaster(new Vector3(u, y + u * wall.slope!, 1), new Vector3(0, 0, -1), 0, 2)
          expect(surroundRay.intersectObjects(opaque).length).toBeGreaterThan(0)
        }
      } finally {
        world.free()
        geometry.dispose()
        material.dispose()
      }
      const shell = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      try {
        for (const box of display.shell) {
          const slab = new SlopedBoxGeometry(...box.size, tunnelSlope, tunnelSlope, tunnelSkew)
          slab.translate(...box.position)
          shell.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(slab)))
          slab.dispose()
        }
        shell.step()
        // beside the cutout in the south end wall
        const origin = new Vector3(display.frontX + (display.side === 'west' ? -1 : 1) * 0.45, floorY + 1.6, display.center[1])
        for (const direction of [new Vector3(display.side === 'west' ? -1 : 1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(tunnelSkew, 0, 1), new Vector3(-tunnelSkew, 0, -1)]) {
          direction.normalize()
          expect(shell.castRay(new RAPIER.Ray(origin, direction), 10, true)).not.toBeNull()
        }
      } finally {
        shell.free()
      }
    })
    test(`${display.side}: glass blocks artwork placement through the display window`, () => {
      const hit = galleryPlacement.findPlacement([tunnelX(display.center[1]), floorY + 1.6, display.center[1]], [display.side === 'west' ? -1 : 1, 0, 0], 1, 1, [])
      expect(hit?.wallId).toBe(`exhibition-${display.side}`)
      expect(hit?.valid).toBe(false)
    })
    for (const fps of [30, 60, 120]) {
      for (const jump of [false, true]) {
        test(`${display.side}: the player cannot enter through the glass at ${fps} Hz, jump ${jump}`, () => {
          const world = new RAPIER.World({
            x: 0,
            y: -9.81,
            z: 0,
          })
          world.timestep = 1 / fps
          const wall = walls.find(value => value.id === `exhibition-${display.side}`)!
          const geometry = createArchitectureGeometry(wall)
          for (const collision of geometry.collision) {
            const wallRotation = new Quaternion
            wallRotation.setFromAxisAngle(new Vector3(0, 1, 0), wall.rotation)
            world.createCollider(RAPIER.ColliderDesc.trimesh(...collision).setTranslation(...wall.center).setRotation(wallRotation))
          }
          const floor = new SlopedBoxGeometry(tunnel.width, 0.24, tunnel.southZ - tunnel.northZ, tunnelSlope, tunnelSlope, tunnelSkew)
          floor.translate(tunnelX(display.center[1]), floorY - 0.12, display.center[1])
          world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(floor)))
          floor.dispose()
          const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(tunnelX(display.center[1]), floorY + 0.04, display.center[1]))
          const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.5, 0.3).setTranslation(0, 0.8, 0), body)
          const motor = new EgoMotor(RAPIER, world, body, collider)
          const facing = new Quaternion
          facing.setFromAxisAngle(new Vector3(0, 1, 0), -(display.side === 'west' ? -1 : 1) * Math.PI / 2)
          try {
            for (let i = 0; i < fps * 3; i++) {
              motor.step(world.timestep, {
                forward: true,
                sprint: true,
                jump: jump && i === fps,
              }, facing)
              world.step()
            }
            expect(Math.abs(body.translation().x - tunnelX(body.translation().z))).toBeLessThan(tunnel.width / 2 - 0.25)
            expect(Math.abs(body.translation().x - tunnelX(body.translation().z))).toBeGreaterThan(1)
            expect(insideGallery([body.translation().x, body.translation().y, body.translation().z])).toBe(true)
          } finally {
            motor.dispose()
            world.free()
            geometry.dispose()
          }
        })
      }
    }
  }
})
