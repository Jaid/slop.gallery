import {expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {colliderGeometry} from '../../src/lib/gallery/architecture.ts'
import {baseboardCapFront, wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import ProfiledBaseboardGeometry from '../../src/lib/gallery/ProfiledBaseboardGeometry.ts'

test('profiled skirting is a closed outward-facing strip solid with hard section edges', () => {
  const geometry = new ProfiledBaseboardGeometry([[-2, 0], [0, 0.3], [2, 0]], 0.4, 0.1, 0.125, -2)
  const material = new MeshBasicMaterial
  const mesh = new Mesh(geometry, material)
  try {
    const [positions, indices] = colliderGeometry(geometry)
    const edges = new Map<string, Array<number>>
    const a = new Vector3
    const b = new Vector3
    const c = new Vector3
    let volume = 0
    for (let i = 0; i < indices.length; i += 3) {
      a.fromArray(positions, indices[i] * 3)
      b.fromArray(positions, indices[i + 1] * 3)
      c.fromArray(positions, indices[i + 2] * 3)
      volume += a.dot(b.cross(c)) / 6
      for (let corner = 0; corner < 3; corner++) {
        const from = indices[i + corner]
        const to = indices[i + (corner + 1) % 3]
        const key = [Math.min(from, to), Math.max(from, to)].join(',')
        edges.set(key, [...edges.get(key) ?? [], Math.sign(to - from)])
      }
    }
    // Every edge belongs to two triangles, traversed in opposite directions.
    expect(edges.values().every(uses => uses.length === 2 && uses[0] + uses[1] === 0)).toBe(true)
    expect(volume).toBeCloseTo(4 * ((0.2 - wallFace) * 0.3 + (baseboardCapFront - wallFace) * 0.1), 6)
    const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
    for (let x = -1.99; x < 2; x += 0.073) {
      ray.ray.origin.set(x, 2, baseboardCapFront - 0.01)
      const hits = ray.intersectObject(mesh)
      expect(hits).toHaveLength(1)
      expect(hits[0].point.y).toBeCloseTo(0.4 + 0.3 * (1 - Math.abs(x) / 2), 6)
      expect(hits[0].face!.normal.y).toBeGreaterThan(0.98)
    }
    // Linear in the number of rings, even when the entire floor profile is nonlevel.
    expect(indices.length / 3).toBeLessThan(500)
  } finally {
    geometry.dispose()
    material.dispose()
  }
})
test('repeated profile coordinates end one solid and begin another, not a self-intersecting sweep', () => {
  const geometry = new ProfiledBaseboardGeometry([[-2, 0], [0, 0], [0, 1], [2, 1]], 0.4, 0.1)
  const material = new MeshBasicMaterial
  try {
    const ray = new Raycaster(new Vector3(-0.1, 3, 0.23), new Vector3(0, -1, 0))
    const mesh = new Mesh(geometry, material)
    expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(0.4, 6)
    ray.ray.origin.x = 0.1
    expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(1.4, 6)
  } finally {
    geometry.dispose()
    material.dispose()
  }
})
for (const [profile, height, cap, step] of [
  [[], 0.4, 0.1, 0.1],
  [[[0, 0]], 0.4, 0.1, 0.1],
  [[[0, 0], [0, 1]], 0.4, 0.1, 0.1],
  [[[1, 0], [0, 0]], 0.4, 0.1, 0.1],
  [[[0, 0], [1, NaN]], 0.4, 0.1, 0.1],
  [[[0, 0], [1, 0]], 0.4, 0.4, 0.1],
  [[[0, 0], [1, 0]], 0.4, 0.1, 0],
  [[[0, 0], [1, 0]], 0.4, 0.1, -1],
] as const) {
  test(`profiled skirting rejects invalid dimensions and profiles: ${JSON.stringify([profile, height, cap, step])}`, () => {
    expect(() => new ProfiledBaseboardGeometry(profile, height, cap, step)).toThrow(RangeError)
  })
}
