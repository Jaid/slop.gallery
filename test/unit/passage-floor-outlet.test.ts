import {expect, test} from 'bun:test'

import {Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import PassageFloorOutlet from '../../src/lib/gallery/passages/PassageFloorOutlet.ts'
import PassageRoute from '../../src/lib/gallery/passages/PassageRoute.ts'
import RoutedPassage from '../../src/lib/gallery/passages/RoutedPassage.ts'
import RouteVaultGeometry, {pavingThickness} from '../../src/lib/gallery/passages/RouteVaultGeometry.ts'

const straight = new PassageRoute([0, 0], 0, 0, 3, [{length: 4}, {
  y: 0.4,
  steps: [{
    radius: 2,
    angle: -Math.PI / 2,
  }],
}])
const curved = new PassageRoute([0, 0], 0, -0.5, 3, [
  {
    y: 0,
    steps: [
      {length: 5},
      {
        radius: 2,
        angle: -Math.PI / 2,
      },
    ],
  },
])
const profile = [[-1.5, 0.3], [-1.395, 0.3], [-0.6, 0.1], [0, -0.05], [0.6, 0.12], [1.395, 0.3], [1.5, 0.3]] as const
const outlet = {
  length: 1.2,
  profile,
}
test('a floor outlet matches its sampled end profile and returns smoothly to the passage’s crossfall floor', () => {
  const passage = new RoutedPassage('outlet', 'bastion', curved, 3, {
    crossfall: {
      slope: 0.05,
      easeOut: 1.5,
    },
    floorOutlet: outlet,
  })
  const floor = passage.floorOutlet!
  expect(floor).toBeDefined()
  expect(floor.fromAlong).toBeLessThan(curved.pieces[1].from)
  for (const [right, y] of profile) {
    expect(floor.height(curved.length, right)).toBeCloseTo(y, 12)
  }
  for (const along of [0, 1, 3, floor.fromAlong - 0.1, floor.fromAlong]) {
    const station = curved.at(along)
    for (const right of [-1.5, -0.6, 0, 0.6, 1.5]) {
      expect(passage.floorY(station, right)).toBeCloseTo(station.y - passage.sag(station, right), 10)
    }
  }
})
test('outlet floor queries, visible triangles and collision triangles agree across a curved crossfall passage', () => {
  const passage = new RoutedPassage('outlet', 'bastion', curved, 3, {
    crossfall: {
      slope: 0.05,
      easeOut: 1.5,
    },
    floorOutlet: outlet,
  })
  const vault = new RouteVaultGeometry(passage)
  const material = new MeshBasicMaterial
  const mesh = new Mesh(vault.paving, material)
  const collision = new Mesh(vault.pavingCollision, material)
  const ray = new Raycaster(new Vector3, new Vector3(0, -1, 0))
  const up = new Raycaster(new Vector3, new Vector3(0, 1, 0))
  try {
    expect(vault.pavingBox).toBeUndefined()
    for (let along = passage.floorOutlet!.fromAlong - 0.4; along < curved.length - 0.02; along += 0.137) {
      const station = curved.at(along)
      for (let right = -1.45; right <= 1.45; right += 0.213) {
        const x = station.point[0] - Math.sin(station.heading) * right
        const z = station.point[1] + Math.cos(station.heading) * right
        ray.ray.origin.set(x, 2, z)
        const top = ray.intersectObject(mesh)[0]
        const contact = ray.intersectObject(collision)[0]
        expect(top).toBeDefined()
        expect(contact).toBeDefined()
        expect(Math.abs(top.point.y - passage.floorAt(x, z)!)).toBeLessThan(0.003)
        expect(contact.point.y).toBeCloseTo(top.point.y, 6)
        up.ray.origin.set(x, -3, z)
        const bottom = up.intersectObject(mesh)[0]
        expect(bottom).toBeDefined()
        expect(bottom.point.y).toBeCloseTo(top.point.y - pavingThickness, 3)
      }
    }
  } finally {
    material.dispose()
    vault.dispose()
  }
})
test('outer turn lanes keep monotonic wall height without dipping below the floor beside them', () => {
  const passage = new RoutedPassage('outlet', 'bastion', curved, 3, {
    crossfall: {
      slope: 0.05,
      easeOut: 1.5,
    },
    floorOutlet: outlet,
  })
  for (let along = passage.floorOutlet!.fromAlong; along <= curved.length; along += 0.05) {
    const station = curved.at(along)
    // On the outer (+right) half of the counter-clockwise turn, the wall is at least as high as the lane beside it.
    expect(passage.floorY(station, 1.5)).toBeGreaterThanOrEqual(passage.floorY(station, 1.5 - wallFace) - 1e-9)
    expect(passage.floorY(station, 1.5 - wallFace)).toBeGreaterThanOrEqual(passage.floorY(station, 0.6) - 1e-9)
  }
})
for (const [index, invalid] of ([
  {
    ...outlet,
    length: 0,
  },
  {
    ...outlet,
    length: -1,
  },
  {
    ...outlet,
    length: NaN,
  },
  {
    ...outlet,
    length: Infinity,
  },
  {
    ...outlet,
    length: 4.9,
  },
  {
    ...outlet,
    profile: [],
  },
  {
    ...outlet,
    profile: [[-1.5, 0]],
  },
  {
    ...outlet,
    profile: [[-1.5, 0], [1.5, NaN]],
  },
  {
    ...outlet,
    profile: [[-1.5, 0], [Infinity, 1]],
  },
  {
    ...outlet,
    profile: [[-1.5, 0], [0, 0], [0, 1], [1.5, 0]],
  },
  {
    ...outlet,
    profile: [[-1.5, 0], [0.4, 0], [0.2, 0], [1.5, 0]],
  },
  {
    ...outlet,
    profile: [[-1, 0], [1.5, 0]],
  },
  {
    ...outlet,
    profile: [[-1.5, 0], [1, 0]],
  },
] as const).entries()) {
  test(`invalid floor outlet ${index} rejected: ${JSON.stringify(invalid)}`, () => {
    expect(() => new PassageFloorOutlet(straight, 3, invalid, station => station.y)).toThrow(RangeError)
  })
}
test('floor outlets reject outlines and overlapping floor inlets', () => {
  expect(() => new RoutedPassage('bad', 'bastion', straight, 3, {
    floorOutlet: outlet,
    outlines: [{
      side: 1,
      corners: [[0, 1.5], [4, 1.5]],
    }],
  })).toThrow(RangeError)
  expect(() => new RoutedPassage('bad', 'bastion', straight, 3, {
    floorInlet: {
      length: 3.7,
      profile,
    },
    floorOutlet: outlet,
  })).toThrow(RangeError)
})
