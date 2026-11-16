import {expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import PassageRoute from '../../src/lib/gallery/passages/PassageRoute.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'

const route = new PassageRoute([0, 0], 0, 0, 3, [{length: 5}])
const outlet = {
  length: 2,
  reach: 1.5,
  profile: [[-1, 0.3, 0], [0, 0.1, -0.02], [1, 0.3, 0]] as const,
}
test('an end-floor blend matches its seam, preserves its incoming grade and returns to its original floor', () => {
  const passage = new RoutedPassage('outlet', 'bastion', route, 2, {floorOutlet: outlet})
  for (const [right, y] of outlet.profile) {
    expect(passage.floorAt(5, right)).toBeCloseTo(y, 12)
    expect(passage.floorAt(3, right)).toBe(0)
    expect(passage.floorAt(3.4, right)).toBe(0)
  }
  // The first facet approximates the incoming grade, rather than flattening the bow before the seam.
  expect((passage.floorAt(4.99, 0)! - passage.floorAt(5, 0)!) / 0.01).toBeCloseTo(-0.02, 1)
  for (let x = 3; x <= 5; x += 0.013) {
    for (let right = -1; right <= 1; right += 0.077) {
      expect(passage.floorAt(x, right)!).toBeGreaterThanOrEqual(-1e-10)
      expect(passage.floorAt(x, right)!).toBeLessThanOrEqual(0.3 + 1e-10)
    }
  }
})
for (const [name, invalid] of Object.entries({
  'zero length': {
    ...outlet,
    length: 0,
  },
  'negative length': {
    ...outlet,
    length: -1,
  },
  'infinite length': {
    ...outlet,
    length: Infinity,
  },
  'excessive length': {
    ...outlet,
    length: 6,
  },
  'NaN length': {
    ...outlet,
    length: NaN,
  },
  'zero reach': {
    ...outlet,
    reach: 0,
  },
  'infinite reach': {
    ...outlet,
    reach: Infinity,
  },
  'NaN reach': {
    ...outlet,
    reach: NaN,
  },
  'too short to contain the blend': {
    ...outlet,
    length: 1,
  },
  'empty profile': {
    ...outlet,
    profile: [],
  },
  'short profile': {
    ...outlet,
    profile: [[-1, 0, 0]],
  },
  'duplicate knot': {
    ...outlet,
    profile: [[-1, 0, 0], [0, 0, 0], [0, 0.1, 0], [1, 0, 0]],
  },
  'unordered knots': {
    ...outlet,
    profile: [[-1, 0, 0], [0.5, 0, 0], [0, 0, 0], [1, 0, 0]],
  },
  'missing left end': {
    ...outlet,
    profile: [[-0.9, 0, 0], [1, 0, 0]],
  },
  'missing right end': {
    ...outlet,
    profile: [[-1, 0, 0], [0.9, 0, 0]],
  },
  'NaN height': {
    ...outlet,
    profile: [[-1, NaN, 0], [1, 0, 0]],
  },
  'infinite grade': {
    ...outlet,
    profile: [[-1, 0, 0], [1, 0, Infinity]],
  },
} satisfies Record<string, {
  length: number
  profile: ReadonlyArray<readonly [number, number, number]>
  reach: number
}>)) {
  test(`invalid end-floor blend rejected: ${name}`, () => {
    expect(() => new RoutedPassage('bad', 'bastion', route, 2, {floorOutlet: invalid})).toThrow(RangeError)
  })
}
test('an outlet cannot silently override an inlet or an outline', () => {
  expect(() => new RoutedPassage('bad', 'bastion', route, 2, {
    floorOutlet: outlet,
    floorInlet: {
      length: 1,
      profile: [[-1, 0], [1, 0]],
    },
  })).toThrow(RangeError)
  expect(() => new RoutedPassage('bad', 'bastion', route, 2, {
    floorOutlet: outlet,
    outlines: [{
      side: 1,
      corners: [[0, 1], [5, 1]],
    }],
  })).toThrow(RangeError)
})
test('a blend beginning inside an arc uses the same authoritative triangle grid for queries and paving', () => {
  const curved = new PassageRoute([0, 0], 0, 0, 3, [{length: 2}, {
    radius: 4,
    angle: Math.PI / 2,
  }])
  const passage = new RoutedPassage('arc-outlet', 'bastion', curved, 2, {
    floorOutlet: {
      ...outlet,
      length: 1.8,
      reach: 0.7,
    },
    crossfall: {slope: 0.05},
  })
  const geometry = new RouteVaultGeometry(passage)
  const material = new MeshBasicMaterial
  const mesh = new Mesh(geometry.paving, material)
  const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  try {
    for (let along = passage.floorOutlet!.from + 0.011; along < curved.length; along += 0.037) {
      const station = curved.at(along)
      for (let right = -0.97; right < 1; right += 0.073) {
        const x = station.point[0] - Math.sin(station.heading) * right
        const z = station.point[1] + Math.cos(station.heading) * right
        ray.ray.origin.set(x, 2, z)
        const top = ray.intersectObject(mesh)[0]
        expect(top.point.y).toBeCloseTo(passage.floorAt(x, z)!, 5)
        up.ray.origin.set(x, -2, z)
        expect(up.intersectObject(mesh)[0].point.y).toBeCloseTo(top.point.y - pavingThickness, 5)
      }
    }
    // Crossfall upstream of the patch must not leave an open underside where its tessellation changes.
    for (const along of [0.3, 2, passage.floorOutlet!.from - 0.001, passage.floorOutlet!.from + 0.001]) {
      const station = curved.at(along)
      ray.ray.origin.set(station.point[0], 2, station.point[1])
      up.ray.origin.set(station.point[0], -2, station.point[1])
      expect(ray.intersectObject(mesh)[0].point.y - up.intersectObject(mesh)[0].point.y).toBeCloseTo(pavingThickness, 5)
    }
  } finally {
    geometry.dispose()
    material.dispose()
  }
})
test('both ends of an asymmetric profile survive endpoint roundoff without selecting the opposite jamb', () => {
  const passage = new RoutedPassage('rounded', 'bastion', route, 2, {floorOutlet: {
    ...outlet,
    profile: [[-1 + 5e-10, 0.2, 0], [0, 0.1, 0], [1 - 5e-10, 0.6, 0]],
  }})
  expect(passage.floorAt(5, -1)).toBeCloseTo(0.2, 12)
  expect(passage.floorAt(5, 1)).toBeCloseTo(0.6, 12)
  expect(passage.floorOutlet!.height({
    ...route.end,
    along: route.length + 1e-14,
  }, 1)).toBeCloseTo(0.6, 12)
})
