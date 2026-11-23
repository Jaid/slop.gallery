import {describe, expect, test} from 'bun:test'

import RAPIER from '@dimforge/rapier3d-compat'
import {computeMeshVolume} from 'three-bvh-csg'
import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {stairFlights, stairRailGeometry, stairTurn} from '../../src/lib/gallery/staircase.ts'
import StairHandrailGeometry, {stairHandrailBend, stairHandrailEase} from '../../src/lib/gallery/stairs/StairHandrailGeometry.ts'

await RAPIER.init()
describe('continuous stair handrails', () => {
  for (const side of ['inner', 'outer'] as const) {
    test(`${side}: one watertight solid with no internal join caps or mismatched profiles`, () => {
      const geometry = stairRailGeometry(side)
      try {
        const [positions, indices] = colliderGeometry(geometry)
        const edges = new Map<string, {
          count: number
          direction: number
        }>
        for (let i = 0; i < indices.length; i += 3) {
          const triangle = [indices[i], indices[i + 1], indices[i + 2]]
          // No face lies in the plane where the flights meet the turn.
          expect(triangle.every(index => Math.abs(stairTurn.local(positions[index * 3], positions[index * 3 + 2])[0]) < 0.00001)).toBe(false)
          for (let edge = 0; edge < 3; edge++) {
            const a = triangle[edge]
            const b = triangle[(edge + 1) % 3]
            const key = [Math.min(a, b), Math.max(a, b)].join(':')
            const value = edges.get(key) ?? {
              count: 0,
              direction: 0,
            }
            value.count++
            value.direction += a < b ? 1 : -1
            edges.set(key, value)
          }
        }
        for (const edge of edges.values()) {
          expect(edge).toEqual({
            count: 2,
            direction: 0,
          })
        }
        for (const attribute of Object.values(geometry.attributes)) {
          expect([...attribute.array].every(Number.isFinite)).toBe(true)
        }
        const normals = geometry.getAttribute('normal')
        for (let i = 0; i < normals.count; i++) {
          expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i))).toBeCloseTo(1, 5)
        }
        const radius = side === 'inner' ? stairTurn.innerRadius + 0.22 : stairTurn.outerRadius - 0.22
        const length = stairFlights.reduce((sum, flight) => sum + flight.length, 0)
        const segments = Math.ceil(Math.PI * radius / (stairHandrailBend / 16))
        expect(computeMeshVolume(geometry)).toBeCloseTo(0.065 ** 2 * (length + radius * segments * Math.sin(Math.PI / segments)), 5)
      } finally {
        geometry.dispose()
      }
    })
    test(`${side}: rendering and collision follow eased curves through both grade joins`, () => {
      const geometry = stairRailGeometry(side)
      const material = new MeshBasicMaterial
      const mesh = new Mesh(geometry, material)
      const world = new RAPIER.World({
        x: 0,
        y: 0,
        z: 0,
      })
      world.createCollider(RAPIER.ColliderDesc.trimesh(...colliderGeometry(geometry), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES))
      world.step()
      try {
        const radius = side === 'inner' ? stairTurn.innerRadius + 0.22 : stairTurn.outerRadius - 0.22
        const shift = side === 'inner' ? stairTurn.innerShift : stairTurn.outerShift
        // The turn’s first flight is the lower one, which falls away from the turn down to the hall, its second the upper one, which rises away from it up to the gallery.
        for (const [i, flight] of [stairFlights[1], stairFlights[0]].entries()) {
          /** how much the rail rises per meter away from the turn, negative where it falls */
          const rise = Math.abs(flight.grade) * (i === 0 ? -1 : 1)
          // Path distance from the join, negative along the flight and positive around the turn, kept off the ring edges.
          const offsets = Array.from({length: 49}, (_, j) => (j - 24) / 24 * (stairHandrailBend + 0.25) + 0.0001)
          const tops = offsets.map(offset => {
            const angle = Math.max(offset, 0) / radius
            const [x, z] = stairTurn.place(Math.min(offset, 0) + Math.sin(angle) * radius, shift + (i === 0 ? -1 : 1) * Math.cos(angle) * radius)
            const expected = stairTurn.top + 1 - rise * Math.min(offset, 0) + rise * stairHandrailEase(offset)
            // across the rail where it runs along the flights, like the original z offsets across a turn heading east
            const [nx, nz] = stairTurn.across
            const surfaces = [-0.017, 0.013].flatMap(across => [-1, 1].map(direction => {
              const origin = new Vector3(x + nx * across, expected - direction, z + nz * across)
              const aim = new Vector3(0, direction, 0)
              const handrailRay = new Raycaster(origin, aim, 0, 2)
              const hit = handrailRay.intersectObject(mesh)[0]
              expect(hit.distance).toBeCloseTo(1 - 0.065 / 2, 2)
              expect(world.castRay(new RAPIER.Ray(origin, aim), 2, true)!.timeOfImpact).toBeCloseTo(hit.distance, 5)
              return hit.point.y
            }))
            return Math.max(...surfaces)
          })
          // No kink: the grade along the top changes gradually instead of jumping from the flight’s slope to level.
          const grades = tops.slice(1).map((top, j) => (top - tops[j]) / (offsets[j + 1] - offsets[j]))
          expect(Math.abs(grades[0] + rise)).toBeLessThan(0.01)
          expect(Math.abs(grades.at(-1)!)).toBeLessThan(0.01)
          for (let j = 1; j < grades.length; j++) {
            expect(Math.abs(grades[j] - grades[j - 1])).toBeLessThan(Math.abs(rise) / 8)
          }
        }
      } finally {
        world.free()
        material.dispose()
        geometry.dispose()
      }
    })
  }
  test('rejects invalid or reversed flight extents', () => {
    const [lower, upper] = [stairFlights[1].end, stairFlights[0].start]
    const [onTurnX, onTurnZ] = stairTurn.place(0, 0)
    const [pastX, pastZ] = stairTurn.place(1, 0)
    expect(() => new StairHandrailGeometry(stairTurn, 'inner', [Infinity, lower[1], lower[2]], upper)).toThrow(RangeError)
    expect(() => new StairHandrailGeometry(stairTurn, 'outer', [onTurnX, lower[1], onTurnZ], upper)).toThrow(RangeError)
    expect(() => new StairHandrailGeometry(stairTurn, 'inner', lower, [pastX, upper[1], pastZ])).toThrow(RangeError)
  })
})
