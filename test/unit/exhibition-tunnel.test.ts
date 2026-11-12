import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architecture.ts'
import {frameToWorld, insideTunnel, tunnelCenter, tunnelFloorAt, tunnelFloorHeight, tunnelFrame, tunnelSlope, worldToFrame} from '../../src/lib/gallery/exhibitionTunnel.ts'
import lowerGallery from '../../src/lib/gallery/lowerGallery.ts'
import {wallPosition} from '../../src/lib/placement/wallGeometry.ts'
import walls, {floorHeight, insideGallery, roomAt} from './fixtures/gallery.ts'
import {addGeometries, addWalls, directionFromFrame, tunnelSlabGeometries, walk, wallMeshes} from './helpers/exhibitionTunnel.ts'

await RAPIER.init()
type Point = readonly [number, number]
const {moonfall, oculus, tunnel} = lowerGallery
const {elbow, half, length} = tunnelFrame
const tunnelWalls = walls.filter(wall => /^exhibition-(?:east|west)(?:_|$)/u.test(wall.id))
const oculusSouth = walls.find(wall => wall.id === 'oculus-south')!
const moonfallNorth = walls.find(wall => wall.id === 'moonfall-north')!
/** `offset` meters across the tunnel toward its east side, from inside the Oculus, up its straight run, along its diagonal and its straight run into Moonfall */
const route = (offset: number): Array<Point> => {
  /** where the line along the straight run at the end meets the line along the diagonal, both `offset` meters off their center lines */
  const corner = (end: Point) => {
    const x = end[0] + offset
    // the diagonal’s line `offset` across it: frame x = offset
    const [ax, az] = frameToWorld([offset, 0])
    const [bx, bz] = frameToWorld([offset, 1])
    return [x, az + (x - ax) * (bz - az) / (bx - ax)] as const
  }
  return [
    [tunnel.north[0] + offset, tunnel.north[1] - 1.5],
    corner(tunnel.north),
    corner(tunnel.south),
    [tunnel.south[0] + offset, tunnel.south[1] + 1.5],
  ]
}
/** points along the route, `step` meters apart, without its first and last stretch in the rooms */
const along = (offset: number, step = 0.1) => {
  const points = route(offset).slice(1, -1)
  const result: Array<Point> = [[tunnel.north[0] + offset, tunnel.north[1] + 0.02]]
  for (const [i, [x, z]] of points.entries()) {
    const previous = i ? points[i - 1] : result[0]
    const distance = Math.hypot(x - previous[0], z - previous[1])
    const count = Math.max(1, Math.ceil(distance / step))
    for (let j = 1; j <= count; j++) {
      result.push([previous[0] + (x - previous[0]) * j / count, previous[1] + (z - previous[1]) * j / count])
    }
  }
  result.push([tunnel.south[0] + offset, tunnel.south[1] - 0.02])
  return result
}
describe('the Exhibition’s tunnel from the middle of the Oculus up to the middle of Moonfall', () => {
  test('it leaves the middle of the Oculus’ south wall and arrives in the middle of Moonfall’s north wall', () => {
    expect(tunnel.north).toEqual([oculus.center[0], oculus.center[1] + oculus.size[1] / 2])
    expect(tunnel.south).toEqual([moonfall.center[0], moonfall.center[1] - moonfall.size[1] / 2])
    for (const [wall, end, floor] of [[oculusSouth, tunnel.north, oculus.floorY], [moonfallNorth, tunnel.south, lowerGallery.floorY]] as const) {
      const hole = wall.holes!.find(value => value.name === 'exhibition')!
      expect(hole.width).toBe(tunnel.width)
      expect(hole.height).toBe(tunnel.height)
      const [x, , z] = wallPosition(wall, hole.u, 0, 0)
      expect(x).toBeCloseTo(end[0], 9)
      expect(z).toBeCloseTo(end[1], 9)
      // the middle of the wall, along its width
      expect(Math.abs(hole.u)).toBeLessThan(1e-9)
      expect(wall.center[1]).toBe(floor)
    }
    // Moonfall’s middle lies west of the Oculus’, so the diagonal runs south-west between the straight runs out of both walls.
    expect(tunnel.south[0]).toBeLessThan(tunnel.north[0])
    expect(tunnelFrame.turn).toBeGreaterThan(0.3)
    expect(tunnelFrame.turn).toBeLessThan(Math.PI / 4)
    expect(roomAt(tunnelCenter)).toBe('exhibition')
  })
  test('its floor is level at both ends, rises evenly along the diagonal and holds a player all the way, as the Exhibition’s', () => {
    expect(tunnelFloorHeight(0)).toBe(tunnel.northY)
    expect(tunnelFloorHeight(length)).toBe(tunnel.southY)
    expect(tunnelSlope * (length - 2 * elbow)).toBeCloseTo(tunnel.southY - tunnel.northY, 9)
    // gentler than the old tunnel’s straight 1 in 6.5
    expect(tunnelSlope).toBeLessThan(0.17)
    for (const offset of [-half + 0.35, 0, half - 0.35]) {
      let previous = tunnel.northY
      for (const [x, z] of along(offset)) {
        const floor = tunnelFloorAt(x, z)!
        expect(floor).toBeDefined()
        expect(floor).toBeGreaterThanOrEqual(previous - 1e-9)
        expect(floor - previous).toBeLessThanOrEqual(tunnelSlope * 0.1 + 1e-6)
        previous = floor
        expect(floorHeight([x, floor + 0.02, z])).toBeCloseTo(floor, 9)
        expect(insideGallery([x, floor + 1.6, z])).toBe(true)
        expect(insideGallery([x, floor - 1.01, z])).toBe(false)
        expect(insideGallery([x, floor + tunnel.height + 0.01, z])).toBe(false)
        expect(insideTunnel([x, floor + 1.6, z])).toBe(true)
        expect(roomAt([x, floor + 1.6, z])).toBe('exhibition')
      }
      expect(previous).toBe(tunnel.southY)
    }
    // Just past either end, the rooms take over.
    expect(roomAt([tunnel.north[0], tunnel.northY + 1.6, tunnel.north[1] - 0.2])).toBe('oculus')
    expect(roomAt([tunnel.south[0], tunnel.southY + 1.6, tunnel.south[1] + 0.2])).toBe('moonfall')
    // Beside the straight runs, nothing.
    for (const side of [-1, 1]) {
      expect(insideGallery([tunnel.north[0] + side * (half + 0.3), tunnel.northY + 1.6, tunnel.north[1] + 0.5])).toBe(false)
      expect(insideGallery([tunnel.south[0] + side * (half + 0.3), tunnel.southY + 1.6, tunnel.south[1] - 0.5])).toBe(false)
    }
  })
  test('its floor and ceiling have matching visible and physical surfaces, without steps or gaps where the slope meets the level ends', () => {
    const material = new MeshBasicMaterial
    const slabs = tunnelSlabGeometries()
    const meshes = slabs.map(geometry => new Mesh(geometry, material))
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    try {
      addGeometries(world, slabs)
      world.step()
      for (const offset of [-half + 0.05, -1.8, 0, 1.8, half - 0.05]) {
        // just off the seams, where a ray straight down one of them may slip between two colliders’ edges
        for (const [seamX, seamZ] of along(offset, 0.05)) {
          const [x, z] = [seamX + 0.003, seamZ + 0.004]
          const floor = tunnelFloorAt(x, z)!
          for (const direction of [-1, 1]) {
            const ray = new Raycaster(new Vector3(x, floor + 1.6, z), new Vector3(0, direction, 0))
            const height = floor + (direction > 0 ? tunnel.height : 0)
            expect(ray.intersectObjects(meshes)[0].point.y).toBeCloseTo(height, 5)
            const physical = world.castRay(new RAPIER.Ray(ray.ray.origin, ray.ray.direction), 5, true)
            if (!physical) {
              throw new Error(`no collision at ${x}, ${z}, ${direction}`)
            }
            expect(ray.ray.origin.y + direction * physical.timeOfImpact).toBeCloseTo(height, 4)
          }
        }
      }
    } finally {
      world.free()
      material.dispose()
      for (const slab of slabs) {
        slab.dispose()
      }
    }
  })
  test('its walls close it on both sides all the way, under the windows and over them', () => {
    const material = new MeshBasicMaterial
    const {meshes, dispose} = wallMeshes(tunnelWalls, material)
    try {
      expect(tunnelWalls.every(wall => wall.trimStyle === 'plain' && wall.sticky === false)).toBe(true)
      const [first, ...rest] = along(0)
      for (const [i, [x, z]] of rest.slice(0, -1).entries()) {
        const previous = i ? rest[i - 1] : first
        const heading = new Vector3(x - previous[0], 0, z - previous[1])
        heading.normalize()
        const floor = tunnelFloorAt(x, z)!
        for (const side of [-1, 1]) {
          const across = new Vector3(-heading.z * side, 0, heading.x * side)
          for (const height of [0.4, 3.1]) {
            const ray = new Raycaster(new Vector3(x, floor + height, z), across, 0, half + 0.5)
            const [hit] = ray.intersectObjects(meshes)
            expect(hit).toBeDefined()
            // the wall’s face or its baseboard, all the way across where the walls turn
            expect(hit.distance).toBeGreaterThan(half - wallFace - 0.2)
            expect(hit.distance).toBeLessThan(half + 0.15)
          }
        }
      }
    } finally {
      dispose()
      material.dispose()
    }
  })
  test('the diagonal’s walls rise with its floor, and the windows sit in them', () => {
    for (const side of ['west', 'east'] as const) {
      const wall = tunnelWalls.find(value => value.id === `exhibition-${side}`)!
      const window = wall.holes!.find(hole => hole.name === 'display')!
      // Along its own x, it rises by the slope, and its foot runs along the floor.
      for (const u of [window.u - window.width / 2, window.u, window.u + window.width / 2]) {
        const [x, , z] = wallPosition(wall, u, 0, 0)
        expect(wall.center[1] + u * wall.slope!).toBeCloseTo(tunnelFloorAt(...frameToWorld([0, worldToFrame([x, z])[1]]))!, 6)
        expect(Math.abs(worldToFrame([x, z])[0])).toBeCloseTo(half, 6)
        // the whole window in the sloping stretch
        expect(worldToFrame([x, z])[1]).toBeGreaterThan(elbow)
        expect(worldToFrame([x, z])[1]).toBeLessThan(length - elbow)
      }
    }
  })
  for (const fps of [30, 60, 120]) {
    for (const offset of [-1.35, 0, 1.35]) {
      for (const sprint of [false, true]) {
        for (const returning of [false, true]) {
          test(`a player walks ${returning ? 'down from Moonfall into the Oculus' : 'up from the Oculus into Moonfall'} at ${fps} Hz, offset ${offset}, sprint ${sprint}`, () => {
            const world = new RAPIER.World({
              x: 0,
              y: -9.81,
              z: 0,
            })
            world.timestep = 1 / fps
            addWalls(world, [...tunnelWalls, oculusSouth, moonfallNorth])
            for (const room of [moonfall, oculus]) {
              world.createCollider(RAPIER.ColliderDesc.cuboid(room.size[0] / 2, 0.12, room.size[1] / 2).setTranslation(room.center[0], (room === oculus ? oculus.floorY : lowerGallery.floorY) - 0.12, room.center[1]))
            }
            const slabs = tunnelSlabGeometries()
            addGeometries(world, slabs)
            const path = route(offset)
            if (returning) {
              path.reverse()
            }
            const [startX, startZ] = path[0]
            try {
              const end = walk(world, [startX, (returning ? tunnel.southY : tunnel.northY) + 0.04, startZ], path.slice(1), {
                sprint,
                each: ([x, y, z]) => {
                  if (!insideGallery([x, y + 1.6, z])) {
                    throw new Error(`outside the gallery at ${x}, ${y}, ${z}`)
                  }
                },
              })
              expect(end[1]).toBeCloseTo((returning ? tunnel.northY : tunnel.southY) + 0.02, 1)
              expect(end.grounded).toBe(true)
            } finally {
              world.free()
              for (const slab of slabs) {
                slab.dispose()
              }
            }
          })
        }
      }
    }
  }
})
test('the frame of the diagonal turns back and forth exactly', () => {
  for (const point of [[0, 0], [1.2, -3], [-4, 17]] as const) {
    const [x, z] = worldToFrame(frameToWorld(point))
    expect(x).toBeCloseTo(point[0], 9)
    expect(z).toBeCloseTo(point[1], 9)
  }
  const down = directionFromFrame([0, 0, 1])
  const [ax, az] = frameToWorld([0, 1])
  const [ox, oz] = frameToWorld([0, 0])
  expect(down.x).toBeCloseTo(ax - ox, 9)
  expect(down.z).toBeCloseTo(az - oz, 9)
})
