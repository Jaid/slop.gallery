import {expect, test} from 'bun:test'

import {FrontSide, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import mainEntrance from '../../src/lib/gallery/entrance.ts'
import EntranceGeometry from '../../src/lib/gallery/EntranceGeometry.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import WalnutMaterial from '../../src/lib/materials/WalnutMaterial.ts'
import walls from './fixtures/gallery.ts'

const withEntrance = (check: (geometry: EntranceGeometry) => void) => {
  const geometry = new EntranceGeometry
  try {
    check(geometry)
  } finally {
    geometry.dispose()
  }
}
test('the entrance stays within a lean triangle budget', () => {
  withEntrance(geometry => {
    expect(triangleCount(geometry.leaves) + triangleCount(geometry.frame) + triangleCount(geometry.metal)).toBeLessThan(2500)
  })
})
test('every walnut piece carries finite grain coordinates', () => {
  withEntrance(geometry => {
    const grain = geometry.leaves.getAttribute('woodGrain')
    expect(grain.itemSize).toBe(3)
    expect(grain.count).toBe(geometry.leaves.getAttribute('position').count)
    expect([...grain.array].every(Number.isFinite)).toBe(true)
    // Rails, stiles, the bent head rail and the panels each get their own seed.
    const seeds = new Set<number>
    for (let index = 0; index < grain.count; index++) {
      seeds.add(grain.getZ(index))
    }
    expect(seeds.size).toBeGreaterThan(20)
  })
  const material = new WalnutMaterial
  material.dispose()
})
test('the leaves are closed: no view through the joinery reaches the wall', () => {
  withEntrance(geometry => {
    const leaves = new Mesh(geometry.leaves, new MeshBasicMaterial({side: FrontSide}))
    const ray = new Raycaster
    const camera = new Vector3(0.35, 0.75, 0.8)
    // The bottom corners of the inner lower panel, seen at a steep angle.
    for (let x = 0.12; x <= 0.22; x += 0.001) {
      for (let y = 0.3; y < 0.6; y += 0.005) {
        const target = new Vector3(x, y, 0.2)
        ray.set(camera, target.sub(camera).normalize())
        const [hit] = ray.intersectObject(leaves)
        expect(hit.point.z).toBeGreaterThan(0.2)
      }
    }
  })
})
test('the panels stay in front of the baseboard and the keystone tucks under the cornice', () => {
  const north = walls.find(wall => wall.id === 'lobby-north')!
  // architecture.ts: the upper cornice band is 0.23 m tall, centered 0.22 m below the wall top.
  expect(mainEntrance.keystoneTop).toBeLessThanOrEqual(north.height - 0.22 - 0.115)
  expect(mainEntrance.keystoneTop).toBeGreaterThan(north.height - 0.22 - 0.115 - 0.01)
  withEntrance(geometry => {
    const position = geometry.leaves.getAttribute('position')
    let shallowest = Infinity
    for (let index = 0; index < position.count; index++) {
      // Baseboard cap: 0.21–0.25 m high, 0.25 m in front of the wall line.
      if (position.getY(index) < 0.45) {
        shallowest = Math.min(shallowest, position.getZ(index) > 0.2 ? position.getZ(index) : Infinity)
      }
    }
    expect(shallowest).toBeGreaterThan(0.255)
    // The keystone is the only stone near the crown that projects past the 0.36 m architrave.
    const frame = geometry.frame.getAttribute('position')
    let keystoneTop = -Infinity
    for (let index = 0; index < frame.count; index++) {
      if (frame.getZ(index) > 0.37) {
        keystoneTop = Math.max(keystoneTop, frame.getY(index))
      }
    }
    expect(keystoneTop).toBeCloseTo(mainEntrance.keystoneTop, 4)
  })
})
test('the bottom rails are bare walnut, without metal kick plates', () => {
  withEntrance(geometry => {
    const material = new MeshBasicMaterial({side: FrontSide})
    try {
      const leaves = new Mesh(geometry.leaves, material)
      const metal = new Mesh(geometry.metal, material)
      for (const x of [-1.4, -0.7, 0.7, 1.4]) {
        for (const y of [0.08, 0.18, 0.28]) {
          const ray = new Raycaster(new Vector3(x, y, 0.8), new Vector3(0, 0, -1))
          expect(ray.intersectObject(metal)).toHaveLength(0)
          const [hit] = ray.intersectObject(leaves)
          expect(hit).toBeDefined()
          expect(hit.point.z).toBeCloseTo(0.3, 5)
        }
      }
    } finally {
      material.dispose()
    }
  })
})
test('there is no metal saddle across the floor below the leaves', () => {
  withEntrance(geometry => {
    const material = new MeshBasicMaterial({side: FrontSide})
    try {
      const metal = new Mesh(geometry.metal, material)
      for (const x of [-1.6, -0.8, 0, 0.8, 1.6]) {
        for (const z of [0.12, 0.23, 0.34]) {
          const ray = new Raycaster(new Vector3(x, 0.5, z), new Vector3(0, -1, 0), 0, 0.5)
          expect(ray.intersectObject(metal)).toHaveLength(0)
        }
      }
    } finally {
      material.dispose()
    }
  })
})
test('the bronze pull bars and architrave trim stay in place', () => {
  withEntrance(geometry => {
    const material = new MeshBasicMaterial({side: FrontSide})
    try {
      const metal = new Mesh(geometry.metal, material)
      for (const side of [-1, 1]) {
        // Pull bar, its backplate and the slim trim outside the leaves.
        for (const [x, y, z] of [[0.091, 1.22, 0.387], [0.091, 1.68, 0.306], [1.69, 0.18, 0.38], [1.69, 3.2, 0.38]]) {
          const ray = new Raycaster(new Vector3(side * x, y, 0.8), new Vector3(0, 0, -1))
          const [hit] = ray.intersectObject(metal)
          expect(hit).toBeDefined()
          expect(hit.point.z).toBeCloseTo(z, 5)
        }
      }
      const crown = new Raycaster(new Vector3(0, mainEntrance.spring + mainEntrance.width / 2 + 0.04, 0.8), new Vector3(0, 0, -1))
      expect(crown.intersectObject(metal)[0]?.point.z).toBeCloseTo(0.38, 5)
    } finally {
      material.dispose()
    }
  })
})
