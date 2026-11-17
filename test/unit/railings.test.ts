import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {BoxGeometry, Line3, Mesh, MeshBasicMaterial, Quaternion, Raycaster, TubeGeometry, Vector3} from 'three/webgpu'

import lowerGallery, {oculusRamps} from '../../src/lib/gallery/lowerGallery.ts'
import oculusBalcony from '../../src/lib/gallery/oculusBalcony.ts'
import OculusGroundGeometry from '../../src/lib/gallery/OculusGroundGeometry.ts'
import tower, {towerRamp as ramp, towerBridge, towerBridges, towerFloorHeight} from '../../src/lib/gallery/oculusTower.ts'
import OculusBalconyRailing from '../../src/lib/gallery/railings/OculusBalconyRailing.ts'
import {bridgeRailRise} from '../../src/lib/gallery/railings/OculusRailing.ts'
import PolylineTubeGeometry from '../../src/lib/gallery/railings/PolylineTubeGeometry.ts'
import RailingPath from '../../src/lib/gallery/railings/RailingPath.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {addOculusRailings, oculusRailings} from './helpers/oculusRailings.ts'

await RAPIER.init()
const [west, south, east] = oculusRailings
/** how far the last bridge upright stands from its wall’s center line */
const wallGap = 0.3
describe('connected Oculus railings', () => {
  test('the west and east paths run from the side ramps up the tower’s ramp onto the bridges, the south one round the deck from bridge to bridge', () => {
    const wallX = towerBridges[0].wallDistance - wallGap
    expect(west.anchors[0].ground[2]).toBe(oculusRamps[0].startZ)
    expect(west.posts.at(-1)!.position[0]).toBeCloseTo(tower.x - wallX)
    expect(east.anchors.at(-1)!.ground[2]).toBe(oculusRamps[1].startZ)
    expect(east.posts[0].position[0]).toBeCloseTo(tower.x + wallX)
    expect(south.posts[0].position[0]).toBeCloseTo(tower.x + wallX)
    expect(south.posts.at(-1)!.position[0]).toBeCloseTo(tower.x - wallX)
    for (const end of [west.anchors.at(-1)!, east.anchors[0], south.anchors[0], south.anchors.at(-1)!]) {
      expect(Math.abs(end.ground[0] - tower.x)).toBeGreaterThan(wallX)
      expect(Math.abs(end.ground[2] - tower.z)).toBeLessThan(towerBridge.mouthWidth / 2)
    }
    // North of each bridge’s middle the outer paths end, south of it the south one, on the fillets that widen the bridges into their doorways.
    for (const path of [west, east]) {
      const end = path === west ? path.anchors.at(-1)! : path.anchors[0]
      expect(end.ground[2]).toBeLessThan(tower.z - towerBridge.width / 2)
    }
    for (const end of [south.anchors[0], south.anchors.at(-1)!]) {
      expect(end.ground[2]).toBeGreaterThan(tower.z + towerBridge.width / 2)
    }
    expect(west.length).toBeGreaterThan(25)
    expect(south.length).toBeGreaterThan(15)
    for (let i = 0; i <= 200; i++) {
      const point = west.getPoint(i / 200)
      const opposite = east.getPoint(1 - i / 200)
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true)
      expect(point.x).toBeCloseTo(2 * tower.x - opposite.x, 5)
      expect(point.y).toBeCloseTo(opposite.y, 5)
      expect(point.z).toBeCloseTo(opposite.z, 5)
      const across = south.getPoint(i / 200)
      const mirrored = south.getPoint(1 - i / 200)
      expect(across.x).toBeCloseTo(2 * tower.x - mirrored.x, 5)
      expect(across.z).toBeCloseTo(mirrored.z, 5)
    }
    for (const railing of oculusRailings) {
      const tube = new PolylineTubeGeometry(railing.points, railing.radius, 12)
      try {
        expect([...tube.getAttribute('position').array].every(Number.isFinite)).toBe(true)
        expect([...tube.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
      } finally {
        tube.dispose()
      }
    }
  })
  test.each(oculusRailings)('$run: junctions never reverse direction or fold the rendered tube inside out', railing => {
    const points = railing.anchors.map(({ground, height}) => new Vector3(ground[0], ground[1] + height, ground[2]))
    for (let i = 1; i < points.length - 1; i++) {
      const incoming = points[i].clone().sub(points[i - 1])
      const outgoing = points[i + 1].clone().sub(points[i])
      expect(incoming.angleTo(outgoing)).toBeLessThan(Math.PI / 6)
    }
    const tube = new PolylineTubeGeometry(railing.points, railing.radius, 12)
    try {
      const positions = tube.getAttribute('position')
      const normals = tube.getAttribute('normal')
      const indices = tube.index!
      for (let i = 0; i < indices.count; i += 3) {
        const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
        const [a, b, c] = ids.map(index => {
          const corner = new Vector3
          return corner.fromBufferAttribute(positions, index)
        })
        const face = b.sub(a).cross(c.sub(a)).normalize()
        const outward = ids.reduce((sum, index) => {
          const vertexNormal = new Vector3
          return sum.add(vertexNormal.fromBufferAttribute(normals, index))
        }, new Vector3).normalize()
        expect(face.dot(outward)).toBeGreaterThan(0.9)
      }
    } finally {
      tube.dispose()
    }
  })
  test.each(oculusRailings)('$run: the handrail has one mitered ring per rail vertex and wraps the capsule colliders exactly', railing => {
    const tube = new PolylineTubeGeometry(railing.points, railing.radius, 12)
    const resampled = new TubeGeometry(railing, Math.ceil(railing.length / 0.04), railing.radius, 12, false)
    try {
      const rings = railing.points.length
      expect(tube.getAttribute('position').count).toBe(rings * 13)
      expect(triangleCount(tube)).toBe((rings - 1) * 24)
      // A tube resampled every 4 cm would take more than three times as many triangles.
      expect(triangleCount(tube) * 3).toBeLessThan(triangleCount(resampled))
      const positions = tube.getAttribute('position')
      const segments = railing.points.slice(1).map((point, i) => new Line3(railing.points[i], point))
      const vertex = new Vector3
      const closest = new Vector3
      const sharpest = Math.max(...segments.slice(1).map((segment, i) => segment.delta(new Vector3).angleTo(segments[i].delta(closest))))
      for (let ring = 0; ring < rings; ring++) {
        const center = new Vector3
        for (let j = 0; j <= 12; j++) {
          vertex.fromBufferAttribute(positions, ring * 13 + j)
          if (j < 12) {
            center.add(vertex)
          }
          const distance = Math.min(...segments.map(segment => segment.closestPointToPoint(vertex, true, closest).distanceTo(vertex)))
          // Only outer miter corners stand proud of the capsules’ rounded joints, by under a millimeter.
          expect(distance).toBeGreaterThan(railing.radius - 0.00001)
          expect(distance).toBeLessThan(railing.radius / Math.cos(sharpest / 2) + 0.00001)
        }
        expect(center.divideScalar(12).distanceTo(railing.points[ring])).toBeLessThan(0.00001)
      }
      for (const [i, segment] of segments.entries()) {
        // Neighboring miter rings never cross, even on the shortest, most sharply turned segments.
        const direction = segment.delta(new Vector3).normalize()
        const projections = (ring: number) => Array.from({length: 13}, (__, j) => vertex.fromBufferAttribute(positions, ring * 13 + j).sub(segment.start).dot(direction))
        expect(Math.max(...projections(i))).toBeLessThan(Math.min(...projections(i + 1)))
      }
    } finally {
      tube.dispose()
      resampled.dispose()
    }
  })
  test('the half-height deck fence starts rising on the shoulders and reaches a meter on the bridges', () => {
    const anchors = oculusRailings.flatMap(railing => railing.anchors)
    const onDeck = (x: number, z: number) => Math.hypot(x - tower.x, z - tower.z) < tower.radius && z > ramp.endZ
    for (const railing of oculusRailings) {
      const perimeter = railing.anchors.filter(({ground}) => onDeck(ground[0], ground[2]))
      const shoulder = perimeter.toSorted((a, b) => Math.abs(a.ground[0] - tower.x) - Math.abs(b.ground[0] - tower.x))
      expect(shoulder.at(-1)!.height).toBeGreaterThan(0.5)
      expect(shoulder.map(anchor => anchor.height)).toEqual(shoulder.map(anchor => anchor.height).toSorted((a, b) => a - b))
      for (const anchor of perimeter) {
        expect(anchor.height).toBeLessThan(1)
        expect(anchor.ground[1]).toBe(ramp.endY)
      }
    }
    // Out along the bridges, past their rails’ climb from the deck’s fence, and on the ramps
    const full = anchors.filter(({ground}) => Math.abs(ground[0] - tower.x) > tower.radius + 0.1 + bridgeRailRise)
    expect(full.length).toBeGreaterThan(40)
    for (const anchor of full) {
      expect(anchor.height).toBeCloseTo(1, 10)
    }
    for (const post of oculusRailings.flatMap(railing => railing.posts)) {
      if (!onDeck(post.position[0], post.position[2])) {
        continue
      }
      expect(post.position[1] - post.height / 2).toBeCloseTo(ramp.endY, 8)
    }
    expect(Math.min(...anchors.map(anchor => anchor.height))).toBe(0.5)
    expect(Math.max(...anchors.map(anchor => anchor.height))).toBeCloseTo(1, 10)
  })
  test('the balcony rail and its posts stand at the ramps’ full railing height', () => {
    const balconyRailing = new OculusBalconyRailing
    const balconyY = oculusBalcony.position[1] + oculusBalcony.size[1] / 2
    for (const anchor of balconyRailing.anchors) {
      expect(anchor.height).toBe(ramp.railHeight)
      expect(anchor.ground[1]).toBe(balconyY)
    }
    expect(balconyRailing.posts.length).toBeGreaterThan(5)
    for (const post of balconyRailing.posts) {
      expect(post.height).toBe(ramp.railHeight)
      expect(post.position[1]).toBeCloseTo(balconyY + ramp.railHeight / 2)
    }
  })
  test('the linked rail colliders meet at every joint without closing the ramp or the bridges', () => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0,
    })
    try {
      addOculusRailings(world)
      world.step()
      const axis = new Vector3(0, 1, 0)
      for (const railing of oculusRailings) {
        for (const [i, segment] of railing.segments.entries()) {
          const rotation = new Quaternion(...segment.rotation)
          const start = new Vector3(...segment.position)
          start.add(axis.clone().applyQuaternion(rotation).multiplyScalar(-segment.halfLength))
          const end = new Vector3(...segment.position)
          end.add(axis.clone().applyQuaternion(rotation).multiplyScalar(segment.halfLength))
          expect(start.distanceTo(railing.getPoint(railing.distances[i] / railing.length))).toBeLessThan(0.00001)
          expect(end.distanceTo(railing.getPoint(railing.distances[i + 1] / railing.length))).toBeLessThan(0.00001)
        }
      }
      expect(world.castRay(new RAPIER.Ray(new Vector3(tower.x, ramp.endY + 0.4, ramp.endZ - 0.4), new Vector3(0, 0, 1)), 1.5, true)).toBeNull()
      expect(world.castRay(new RAPIER.Ray(new Vector3(tower.x, ramp.endY + 0.5, tower.z), new Vector3(0, 0, 1)), tower.radius + 0.5, true)).not.toBeNull()
      // Along both bridges, from the middle of the deck to their walls, and across them from rail to rail
      for (const {wallDistance} of towerBridges) {
        for (const side of [-1, 1]) {
          expect(world.castRay(new RAPIER.Ray(new Vector3(tower.x, ramp.endY + 0.6, tower.z), new Vector3(side, 0, 0)), wallDistance - 0.1, true)).toBeNull()
          // At the height of the handrail, which runs 12 cm in from the bridge’s edge
          const x = tower.x + side * (tower.radius + 2)
          const across = world.castRay(new RAPIER.Ray(new Vector3(x, towerFloorHeight(x, tower.z)! + towerBridge.railHeight, tower.z), new Vector3(0, 0, 1)), 2, true)
          expect(across!.timeOfImpact).toBeGreaterThan(towerBridge.width / 2 - 0.12 - 0.05)
          expect(across!.timeOfImpact).toBeLessThan(towerBridge.width / 2 - 0.12)
        }
      }
    } finally {
      world.free()
    }
  })
  test('every post stands on the existing stone instead of floating outside the rounded edges', () => {
    const ground = new OculusGroundGeometry
    const floor = new BoxGeometry(lowerGallery.oculus.size[0], 0.24, lowerGallery.oculus.size[1])
    floor.translate(lowerGallery.oculus.center[0], lowerGallery.floorY - 0.12, lowerGallery.oculus.center[1])
    const material = new MeshBasicMaterial
    const meshes = [new Mesh(ground, material), new Mesh(floor, material)]
    try {
      for (const post of oculusRailings.flatMap(railing => railing.posts)) {
        const baseY = post.position[1] - post.height / 2
        const footingRay = new Raycaster(new Vector3(post.position[0], baseY + 0.1, post.position[2]), new Vector3(0, -1, 0), 0, 0.2)
        const hit = footingRay.intersectObjects(meshes)[0]
        expect(hit).toBeDefined()
        expect(hit.point.y).toBeCloseTo(baseY, 2)
      }
    } finally {
      ground.dispose()
      floor.dispose()
      material.dispose()
    }
  })
  test('degenerate paths fail before creating invalid tubes or physics shapes', () => {
    expect(() => new RailingPath([])).toThrow(RangeError)
    expect(() => new RailingPath([
      {
        ground: [0, 0, 0],
        height: 1,
      },
      {
        ground: [0, 0, 0],
        height: 1,
      },
    ])).toThrow(RangeError)
    expect(() => new RailingPath([
      {
        ground: [0, 0, 0],
        height: 1,
      },
      {
        ground: [1, 0, 0],
        height: 0,
      },
    ])).toThrow(RangeError)
  })
})
