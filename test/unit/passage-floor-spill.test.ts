import {expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import PassageFloorSpill from '../../src/lib/gallery/passages/PassageFloorSpill.ts'
import PassageRoute from '../../src/lib/gallery/passages/PassageRoute.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'

const route = new PassageRoute([0, 0], 0, 0, 3, [{length: 5}])
const profile = [[-1.5, 0.3], [-0.6, 0.12], [0, 0], [0.6, 0.12], [1.5, 0.3]] as const
const spill = {
  length: 2,
  profile,
}
const inlet = {
  length: 2,
  profile: [[-1.5, -0.2], [0, 0], [1.5, 0.2]] as const,
}
/** a base floor with a shallow fall toward its middle, for the spill to be laid over */
const base = (station: ReturnType<PassageRoute['at']>, right: number) => station.y - 0.02 * Math.max(0, 1.4 - Math.abs(right))
test('a floor spill matches its sampled end and returns to the route’s own floor where it begins', () => {
  const floor = new PassageFloorSpill(route, 3, spill, base)
  expect(floor.from).toBe(3)
  expect(floor.across).toEqual(profile.map(([right]) => right))
  expect(floor.along).toEqual([3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5])
  for (const [right, y] of profile) {
    expect(floor.height(5, right)).toBeCloseTo(y, 12)
    expect(floor.height(3, right)).toBe(base(route.at(3), right))
    expect(floor.height(2, right)).toBe(base(route.at(2), right))
  }
  expect(floor.height(5, 0.3)).toBeCloseTo(0.06, 12)
  expect(floor.height(5, -1.5 - 1e-10)).toBeCloseTo(0.3, 12)
  expect(floor.height(5, 1.5 + 1e-10)).toBeCloseTo(0.3, 12)
  // At the walls it climbs all the way from where it begins to the end.
  let previous = floor.height(3, 1.5)
  for (let along = 3.1; along <= 5; along += 0.1) {
    const height = floor.height(along, 1.5)
    expect(height).toBeGreaterThan(previous)
    previous = height
  }
})
test('spill floor queries, visible triangles and collision triangles agree between rows and columns, over a crossfall included', () => {
  const passage = new RoutedPassage('spill', 'bastion', route, 3, {
    crossfall: {
      slope: 0.05,
      easeOut: 1,
    },
    floorSpill: spill,
  })
  const vault = new RouteVaultGeometry(passage)
  const material = new MeshBasicMaterial
  const mesh = new Mesh(vault.paving, material)
  const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  try {
    expect(vault.pavingCollision).toBe(vault.paving)
    expect(vault.pavingBox).toBeUndefined()
    for (const [right, y] of profile) {
      expect(passage.floorY(route.end, right)).toBe(y)
      const start = route.at(3)
      expect(passage.floorY(start, right)).toBe(start.y - passage.sag(start, right))
    }
    // Unequal increments exercise both sides of every diagonal, not just the mesh’s vertices.
    for (let along = 3.011; along < 4.98; along += 0.087) {
      for (let right = -1.49; right < 1.5; right += 0.113) {
        ray.ray.origin.set(along, 2, right)
        const top = ray.intersectObject(mesh)[0]
        expect(top).toBeDefined()
        expect(top.point.y).toBeCloseTo(passage.floorAt(along, right)!, 6)
        expect(top.face!.normal.y).toBeGreaterThan(0.85)
        up.ray.origin.set(along, -2, right)
        const bottom = up.intersectObject(mesh)[0]
        // The slab keeps the route paving’s own thickness under the spill at its vertices, which the crossfall thins toward the middle; between them, its underside runs straight across the crossfall’s kink at the walls’ faces.
        expect(Math.abs(bottom.point.y - (top.point.y - pavingThickness + passage.sag(route.at(along), right)))).toBeLessThan(0.006)
      }
    }
    // Both walls’ baseboards climb with it to its sampled end.
    for (const wall of passage.walls) {
      expect(wall.baseboardProfile).toBeDefined()
      expect(Math.max(...wall.baseboardProfile!.map(([, rise]) => rise))).toBeCloseTo(0.3 - wall.center[1], 9)
    }
  } finally {
    material.dispose()
    vault.dispose()
  }
})
test('a spill can end on a turn, where it still matches its profile at the route’s end', () => {
  const turning = new PassageRoute([0, 0], 0, 0, 3, [{length: 2}, {
    radius: 4,
    angle: Math.PI / 2,
  }])
  const passage = new RoutedPassage('spill-turn', 'bastion', turning, 3, {floorSpill: spill})
  for (const [right, y] of profile) {
    expect(passage.floorY(turning.end, right)).toBeCloseTo(y, 12)
  }
  const started = turning.at(passage.floorSpill!.from)
  expect(passage.floorY(started, 0)).toBe(started.y)
})
for (const [index, invalid] of ([
  {
    ...spill,
    length: 0,
  },
  {
    ...spill,
    length: -1,
  },
  {
    ...spill,
    length: NaN,
  },
  {
    ...spill,
    length: Infinity,
  },
  {
    ...spill,
    length: 5.1,
  },
  {
    ...spill,
    profile: [],
  },
  {
    ...spill,
    profile: [[-1.5, 0]],
  },
  {
    ...spill,
    profile: [[-1.5, 0], [1.5, NaN]],
  },
  {
    ...spill,
    profile: [[-1.5, 0], [Infinity, 1]],
  },
  {
    ...spill,
    profile: [[-1.5, 0], [0, 0], [0, 1], [1.5, 0]],
  },
  {
    ...spill,
    profile: [[-1.5, 0], [0.4, 0], [0.2, 0], [1.5, 0]],
  },
  {
    ...spill,
    profile: [[-1, 0], [1.5, 0]],
  },
  {
    ...spill,
    profile: [[-1.5, 0], [1, 0]],
  },
] as const).entries()) {
  test(`invalid floor spill ${index} rejected: ${JSON.stringify(invalid)}`, () => {
    expect(() => new PassageFloorSpill(route, 3, invalid, base)).toThrow(RangeError)
  })
}
test('a spill may not run back past the last run or turn it ends on, nor join an inlet or outlines', () => {
  const twoPieces = new PassageRoute([0, 0], 0, 0, 3, [{length: 3}, {length: 2}])
  expect(() => new PassageFloorSpill(twoPieces, 3, {
    length: 2.1,
    profile,
  }, base)).toThrow(RangeError)
  expect(() => new RoutedPassage('bad', 'bastion', route, 3, {
    floorInlet: inlet,
    floorSpill: spill,
  })).toThrow(RangeError)
  expect(() => new RoutedPassage('bad', 'bastion', route, 3, {
    floorSpill: spill,
    outlines: [{
      side: 1,
      corners: [[0, 1.5], [5, 1.5]],
    }],
  })).toThrow(RangeError)
})
