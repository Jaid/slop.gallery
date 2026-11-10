import {expect, test} from 'bun:test'

import {BackSide, DoubleSide, FrontSide, Mesh, MeshBasicNodeMaterial, Raycaster, Vector3} from 'three/webgpu'

import KnotResources from '../src/KnotResources.ts'
import {knotsById} from '../src/main.ts'

test('shared Knot BVH preserves native hits, face indices, UVs, sides and transformed distances', () => {
  const entries = [knotsById.get('lenticular_mirage')!, knotsById.get('coralline_crown')!]
  const resources = new KnotResources(entries)
  let hits = 0
  try {
    for (const {geometry} of resources.items) {
      const material = new MeshBasicNodeMaterial
      const mesh = new Mesh(geometry, material)
      try {
        mesh.position.set(3, 2, -4)
        mesh.rotation.set(0.4, 0.7, 0.1)
        mesh.scale.set(1.4, 0.8, 1.1)
        mesh.updateMatrixWorld()
        for (const side of [FrontSide, BackSide, DoubleSide]) {
          material.side = side
          for (let x = -0.6; x <= 0.6; x += 0.24) {
            for (let y = -0.6; y <= 0.6; y += 0.24) {
              const origin = new Vector3(x, y, 3)
              origin.applyMatrix4(mesh.matrixWorld)
              const direction = new Vector3(0, 0, -1)
              direction.transformDirection(mesh.matrixWorld)
              const ray = new Raycaster(origin, direction, 0, 9)
              // eslint-disable-next-line typescript/unbound-method -- Swaps in three’s own raycast as the reference; Raycaster calls it with the mesh as this.
              mesh.raycast = Mesh.prototype.raycast
              const expected = ray.intersectObject(mesh)
              mesh.raycast = resources.raycast
              const actual = ray.intersectObject(mesh)
              expect(actual.length).toBe(expected.length)
              hits += expected.length
              for (const [i, element] of actual.entries()) {
                expect(element.object).toBe(mesh)
                expect(element.distance).toBeCloseTo(expected[i].distance, 8)
                expect(element.faceIndex).toBe(expected[i].faceIndex)
                expect(element.uv!.distanceTo(expected[i].uv!)).toBeLessThan(1e-7)
                expect(element.point.distanceTo(expected[i].point)).toBeLessThan(1e-7)
              }
              ray.firstHitOnly = true
              const nearest = ray.intersectObject(mesh)
              expect(nearest).toHaveLength(Math.min(1, expected.length))
              if (expected.length === 0) {
                continue
              }
              expect(nearest[0].distance).toBeCloseTo(expected[0].distance, 8)
              ray.far = expected[0].distance - 0.01
              expect(ray.intersectObject(mesh)).toHaveLength(0)
              ray.far = 9
              ray.near = expected[0].distance + 0.01
              // eslint-disable-next-line typescript/unbound-method -- Swaps in three’s own raycast as the reference; Raycaster calls it with the mesh as this.
              mesh.raycast = Mesh.prototype.raycast
              const clipped = ray.intersectObject(mesh)
              mesh.raycast = resources.raycast
              const clippedNearest = ray.intersectObject(mesh)
              expect(clippedNearest).toHaveLength(Math.min(1, clipped.length))
              if (clipped.length) {
                expect(clippedNearest[0].distance).toBeCloseTo(clipped[0].distance, 8)
              }
            }
          }
        }
      } finally {
        material.dispose()
      }
    }
    expect(hits).toBeGreaterThan(100)
  } finally {
    resources.dispose()
  }
})
test('accelerated raycasts bypass the linear Mesh vertex walk without patching Three prototypes', () => {
  const entry = knotsById.get('lenticular_mirage')!
  const resources = new KnotResources([entry])
  const {geometry} = resources.items[0]
  const material = new MeshBasicNodeMaterial
  const mesh = new Mesh(geometry, material)
  // eslint-disable-next-line typescript/unbound-method -- Only compared by identity, never called.
  const native = Mesh.prototype.raycast
  let vertexReads = 0
  mesh.getVertexPosition = function (index, target) {
    vertexReads++
    return Mesh.prototype.getVertexPosition.call(this, index, target)
  }
  const ray = new Raycaster(new Vector3(0.3, 0.1, 3), new Vector3(0, 0, -1), 0, 9)
  try {
    const expected = ray.intersectObject(mesh)
    expect(vertexReads).toBeGreaterThan(30_000)
    vertexReads = 0
    mesh.raycast = resources.raycast
    expect(ray.intersectObject(mesh).length).toBe(expected.length)
    expect(vertexReads).toBe(0)
    // eslint-disable-next-line typescript/unbound-method -- Only compared by identity, never called.
    expect(Mesh.prototype.raycast).toBe(native)
  } finally {
    material.dispose()
    resources.dispose()
  }
})
