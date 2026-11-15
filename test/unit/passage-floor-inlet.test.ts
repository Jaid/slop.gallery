import {expect, test} from 'bun:test'

import {BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import PassageFloorInlet from '../../src/lib/gallery/passages/PassageFloorInlet.ts'
import PassageRoute from '../../src/lib/gallery/passages/PassageRoute.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'

const route = new PassageRoute([0, 0], 0, 0, 3, [{
  y: 0.3,
  steps: [{length: 2}],
}, {length: 3}])
const profile = [[-1.5, -0.2], [-0.6, -0.1], [0, 0], [0.4, 0.08], [1.5, 0.2]] as const
const inlet = {
  length: 2,
  profile,
}
test('a floor inlet matches its sampled mouth and returns to the route at its end', () => {
  const floor = new PassageFloorInlet(route, 3, inlet)
  expect(floor.across).toEqual(profile.map(([right]) => right))
  expect(floor.along).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])
  for (const [right, y] of profile) {
    expect(floor.height(0, right)).toBe(y)
    for (const along of [2, 2.1, 4, 5]) {
      expect(floor.height(along, right)).toBe(route.at(along).y)
    }
  }
  expect(floor.height(0, -0.3)).toBeCloseTo(-0.05, 12)
  expect(floor.height(0, 0.2)).toBeCloseTo(0.04, 12)
  expect(floor.height(0, -1.5 - 1e-10)).toBeCloseTo(-0.2, 12)
  expect(floor.height(0, 1.5 + 1e-10)).toBeCloseTo(0.2, 12)
})
test('inlet floor queries, visible triangles and collision triangles agree between rows and columns', () => {
  const passage = new RoutedPassage('inlet', 'bastion', route, 3, {floorInlet: inlet})
  const vault = new RouteVaultGeometry(passage)
  const material = new MeshBasicMaterial
  const mesh = new Mesh(vault.paving, material)
  const collision = [new Mesh(vault.pavingCollision, material)]
  const {halfSize, position, rotation} = vault.pavingBox!
  const boxGeometry = new BoxGeometry(...halfSize.map(value => value * 2) as [number, number, number])
  const box = new Mesh(boxGeometry, material)
  box.position.set(...position)
  box.rotation.y = rotation
  box.updateMatrixWorld(true)
  collision.push(box)
  const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  try {
    expect(vault.pavingCollision).not.toBe(vault.paving)
    expect(halfSize).toEqual([1.5, pavingThickness / 2, 1.5])
    // Unequal increments exercise both sides of every diagonal, not just the mesh’s vertices.
    for (let along = 0.011; along < 4.95; along += 0.087) {
      for (let right = -1.49; right < 1.5; right += 0.113) {
        ray.ray.origin.set(along, 2, right)
        const top = ray.intersectObject(mesh)[0]
        expect(top).toBeDefined()
        expect(top.point.y).toBeCloseTo(passage.floorAt(along, right)!, 6)
        const contact = ray.intersectObjects(collision)[0]
        expect(contact.point.y).toBeCloseTo(top.point.y, 6)
        expect(top.face!.normal.y).toBeGreaterThan(0.9)
        up.ray.origin.set(along, -2, right)
        const bottom = up.intersectObject(mesh)[0]
        expect(bottom.point.y).toBeCloseTo(top.point.y - pavingThickness, 6)
      }
    }
  } finally {
    material.dispose()
    boxGeometry.dispose()
    vault.dispose()
  }
})
test('an inlet also samples route knots when its blend does not end on a route knot', () => {
  const floor = new PassageFloorInlet(route, 3, {
    length: 1.3,
    profile,
  })
  expect(floor.along).toContain(0.25)
  expect(floor.along).toContain(0.5)
  expect(floor.along).toContain(1.3)
  expect(floor.along.every((value, index) => index === 0 || value > floor.along[index - 1])).toBe(true)
  expect(floor.height(1.3, 0.4)).toBe(route.at(1.3).y)
})
test('only an unbroken, level straight tail is replaced by a box collider', () => {
  const sloping = new PassageRoute([0, 0], 0, 0, 3, [{length: 2}, {
    y: 0.3,
    steps: [{length: 3}],
  }])
  const turning = new PassageRoute([0, 0], 0, 0, 3, [{length: 2}, {
    radius: 4,
    angle: Math.PI / 2,
  }])
  for (const tailRoute of [sloping, turning]) {
    const passage = new RoutedPassage('inlet', 'bastion', tailRoute, 3, {floorInlet: inlet})
    const vault = new RouteVaultGeometry(passage)
    try {
      expect(vault.pavingBox).toBeUndefined()
      expect(vault.pavingCollision).toBe(vault.paving)
    } finally {
      vault.dispose()
    }
  }
  const passage = new RoutedPassage('inlet', 'bastion', route, 3, {
    floorInlet: inlet,
    pits: [[[3, -0.3], [3.5, -0.3], [3.5, 0.3], [3, 0.3]]],
  })
  const vault = new RouteVaultGeometry(passage)
  try {
    expect(vault.pavingBox).toBeUndefined()
    expect(vault.pavingCollision).toBe(vault.paving)
  } finally {
    vault.dispose()
  }
})
for (const [index, invalid] of ([
  {
    ...inlet,
    length: 0,
  },
  {
    ...inlet,
    length: -1,
  },
  {
    ...inlet,
    length: NaN,
  },
  {
    ...inlet,
    length: Infinity,
  },
  {
    ...inlet,
    length: 2.1,
  },
  {
    ...inlet,
    profile: [],
  },
  {
    ...inlet,
    profile: [[-1.5, 0]],
  },
  {
    ...inlet,
    profile: [[-1.5, 0], [1.5, NaN]],
  },
  {
    ...inlet,
    profile: [[-1.5, 0], [Infinity, 1]],
  },
  {
    ...inlet,
    profile: [[-1.5, 0], [0, 0], [0, 1], [1.5, 0]],
  },
  {
    ...inlet,
    profile: [[-1.5, 0], [0.4, 0], [0.2, 0], [1.5, 0]],
  },
  {
    ...inlet,
    profile: [[-1, 0], [1.5, 0]],
  },
  {
    ...inlet,
    profile: [[-1.5, 0], [1, 0]],
  },
] as const).entries()) {
  test(`invalid floor inlet ${index} rejected: ${JSON.stringify(invalid)}`, () => {
    expect(() => new PassageFloorInlet(route, 3, invalid)).toThrow(RangeError)
  })
}
test('floor inlets do not silently replace a crossfall, outline or curved entry', () => {
  expect(() => new RoutedPassage('bad', 'bastion', route, 3, {
    floorInlet: inlet,
    crossfall: {slope: 0.05},
  })).toThrow(RangeError)
  expect(() => new RoutedPassage('bad', 'bastion', route, 3, {
    floorInlet: inlet,
    outlines: [{
      side: 1,
      corners: [[0, 1.5], [5, 1.5]],
    }],
  })).toThrow(RangeError)
  const curved = new PassageRoute([0, 0], 0, 0, 3, [{
    radius: 4,
    angle: Math.PI / 2,
  }])
  expect(() => new PassageFloorInlet(curved, 3, inlet)).toThrow(RangeError)
})
