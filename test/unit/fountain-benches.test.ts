import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu'

import {afterEach, beforeEach, describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {fountainBench, fountainBenches, fountainBenchFrame} from '../../src/lib/gallery/fountainBenches.ts'
import {lobbyFountainSpot} from '../../src/lib/gallery/lobbyFountain.ts'
import SlattedBenchGeometry from '../../src/lib/gallery/SlattedBenchGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'

function attributeVector(attribute: BufferAttribute | InterleavedBufferAttribute, index: number) {
  const vector = new Vector3
  return vector.fromBufferAttribute(attribute, index)
}
await RAPIER.init()
const {centers, radius, bendRadius, halfDepth, topY} = fountainBenchFrame
const bendY = topY - bendRadius
let geometry: SlattedBenchGeometry
beforeEach(() => {
  geometry = new SlattedBenchGeometry
})
afterEach(() => geometry.dispose())
describe('round-tube fountain bench frames', () => {
  test('cylinders and bent shoulders have true radial normals, not flat bars or averaged bevel shading', () => {
    const positions = geometry.metal.getAttribute('position')
    const normals = geometry.metal.getAttribute('normal')
    const point = new Vector3
    const normal = new Vector3
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i)
      normal.fromBufferAttribute(normals, i)
      expect(normal.length()).toBeCloseTo(1, 6)
      if (point.y > topY + radius + 0.00001) {
        continue // slat screw heads, not the frame
      }
      const x = centers.reduce((nearest, candidate) => (Math.abs(point.x - candidate) < Math.abs(point.x - nearest) ? candidate : nearest))
      if (point.y < 0.00001 && normal.y < -0.99) {
        expect(Math.hypot(point.x - x, Math.abs(point.z) - halfDepth)).toBeLessThanOrEqual(radius + 0.00001)
        continue // flat, closed foot caps
      }
      const candidates = [new Vector3(x, topY, Math.max(-halfDepth + bendRadius, Math.min(halfDepth - bendRadius, point.z)))]
      for (const side of [-1, 1]) {
        candidates.push(new Vector3(x, Math.max(0, Math.min(bendY, point.y)), side * halfDepth))
        const centerZ = side * (halfDepth - bendRadius)
        const angle = Math.max(0, Math.min(Math.PI / 2, Math.atan2(point.y - bendY, side * (point.z - centerZ))))
        candidates.push(new Vector3(x, bendY + bendRadius * Math.sin(angle), centerZ + side * bendRadius * Math.cos(angle)))
      }
      const closest = candidates.toSorted((a, b) => a.distanceToSquared(point) - b.distanceToSquared(point))[0]
      const radial = point.clone().sub(closest)
      expect(radial.length()).toBeCloseTo(radius, 6)
      expect(normal.dot(radial.normalize())).toBeGreaterThan(0.999999)
    }
  })
  test('frames are closed, outward-wound and smooth across every tangent join within a small triangle budget', () => {
    expect(triangleCount(geometry.metal)).toBeLessThan(2400)
    const positions = geometry.metal.getAttribute('position')
    const normals = geometry.metal.getAttribute('normal')
    const indices = geometry.metal.index!
    const edges = new Map<string, number>
    const sharedNormals = new Map<string, Vector3>
    const key = (point: Vector3) => [point.x, point.y, point.z].map(value => Math.round(value * 1e6)).join(':')
    let sharedVertices = 0
    for (let i = 0; i < indices.count; i += 3) {
      const ids = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
      const points = ids.map(index => attributeVector(positions, index))
      const face = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]))
      expect(face.length()).toBeGreaterThan(1e-8)
      const shading = ids.reduce((sum, index) => sum.add(attributeVector(normals, index)), new Vector3).normalize()
      expect(face.normalize().dot(shading)).toBeGreaterThan(0.98)
      for (let j = 0; j < 3; j++) {
        const edge = [key(points[j]), key(points[(j + 1) % 3])].toSorted().join('/')
        edges.set(edge, (edges.get(edge) ?? 0) + 1)
      }
    }
    expect(edges.values().every(count => count === 2)).toBe(true)
    for (let i = 0; i < positions.count; i++) {
      const point = attributeVector(positions, i)
      if (point.y < 0.00001 || point.y > topY + radius + 0.00001) {
        continue // caps and screws intentionally retain hard edges
      }
      const normal = attributeVector(normals, i)
      const previous = sharedNormals.get(key(point))
      if (previous) {
        expect(normal.dot(previous)).toBeGreaterThan(0.999999)
        sharedVertices++
      }
      sharedNormals.set(key(point), normal)
    }
    expect(sharedVertices).toBeGreaterThan(200)
  })
  test('physical hits follow the curved frame, including its shoulders', () => {
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    const material = new MeshBasicMaterial
    const mesh = new Mesh(geometry.metal, material)
    try {
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.metal), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      for (const x of centers) {
        for (const side of [-1, 1]) {
          const samples = [new Vector3(x, 0.15, side * halfDepth)]
          for (const angle of [0, Math.PI / 8, Math.PI / 4, 3 * Math.PI / 8, Math.PI / 2]) {
            samples.push(new Vector3(x, bendY + bendRadius * Math.sin(angle), side * (halfDepth - bendRadius + bendRadius * Math.cos(angle))))
          }
          for (const center of samples) {
            for (const angle of [0.1, 0.5, 1, 2, 3]) {
              const direction = new Vector3(Math.cos(angle), 0, Math.sin(angle))
              const origin = center.clone().addScaledVector(direction, 0.12)
              direction.negate()
              const ray = new Raycaster(origin, direction, 0, 0.24)
              const visual = ray.intersectObject(mesh)[0]
              const physical = world.castRay(new RAPIER.Ray(origin, direction), 0.24, true)
              expect(visual).toBeDefined()
              expect(physical).not.toBeNull()
              expect(physical!.timeOfImpact).toBeCloseTo(visual.distance, 5)
            }
          }
        }
      }
    } finally {
      world.free()
      material.dispose()
    }
  })
  test('all four seats collide, along their whole length, while the diagonals between them stay open', () => {
    const world = new RAPIER.World({
      x: 0,
      y: 0,
      z: 0,
    })
    try {
      for (const {position, rotation} of fountainBenches) {
        const orientation = new Quaternion
        orientation.setFromAxisAngle(new Vector3(0, 1, 0), rotation[1])
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...position).setRotation(orientation))
        world.createCollider(RAPIER.ColliderDesc.cuboid(fountainBench.width / 2, 0.0425, fountainBench.depth / 2).setTranslation(0, fountainBench.height - 0.0425, 0), body)
        world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry.metal), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), body)
      }
      world.step()
      const down = (x: number, z: number) => world.castRay(new RAPIER.Ray({
        x,
        y: 1,
        z,
      }, {
        x: 0,
        y: -1,
        z: 0,
      }), 1, true)
      for (const {position, rotation} of fountainBenches) {
        for (const along of [-1, 0, 1]) {
          expect(down(position[0] + Math.cos(rotation[1]) * along, position[2] - Math.sin(rotation[1]) * along)).not.toBeNull()
        }
      }
      const diagonal = fountainBench.radius / Math.SQRT2
      for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        expect(down(lobbyFountainSpot[0] + dx * diagonal, lobbyFountainSpot[2] + dz * diagonal)).toBeNull()
      }
    } finally {
      world.free()
    }
  })
})
