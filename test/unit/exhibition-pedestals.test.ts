import type {PedestalLobe} from '../../src/lib/gallery/DisplayPedestalGeometry.ts'

import {expect, test} from 'bun:test'

import {knotSign, knotSignParts, knotSignRoundParts} from 'knot-materials/signs.ts'
import {DoubleSide, Euler, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import DisplayPedestalGeometry, {pedestalOverhang} from '../../src/lib/gallery/DisplayPedestalGeometry.ts'
import {tunnelFloorHeight, tunnelSkew, tunnelSlope} from '../../src/lib/gallery/lowerGallery.ts'
import tunnelDisplays, {displayNorthExtension, tunnelDisplayWindow} from '../../src/lib/gallery/tunnelDisplays.ts'
import {exhibitHeight, exhibitionPedestal, exhibitionPedestalLobes, exhibitionSidecar, exhibitionSlots, exhibitOffset} from '../../src/rooms/exhibition/exhibits.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const displayOf = (slot: (typeof exhibitionSlots)[number]) => tunnelDisplays.find(display => display.exhibits.some(exhibit => exhibit.id === slot.id))!
test('every display shows three exhibits at eye level over their pedestals, inside the Exhibition', () => {
  expect(exhibitionSlots).toHaveLength(6)
  expect(exhibitHeight).toBeGreaterThan(tunnelDisplayWindow.bottom)
  expect(exhibitHeight).toBeLessThan(tunnelDisplayWindow.top)
  for (const slot of exhibitionSlots) {
    const display = displayOf(slot)
    const [x, y, z] = slot.position
    const floor = tunnelFloorHeight(z)
    expect(slot.pedestal).toEqual([display.backAt(z), floor, z])
    expect(x).toBeCloseTo(display.backAt(z) + slot.direction * exhibitOffset, 9)
    expect(y - floor).toBeCloseTo(exhibitHeight, 9)
    expect(y - floor).toBeGreaterThan(exhibitionPedestal.height)
    expect(slopGallery.roomAt([x, y, z])?.id).toBe('exhibition')
  }
})
test('the pedestals back onto the back walls with their sidecars, leaving ways in from the cutouts and along the windows', () => {
  const [sidecar, main] = exhibitionPedestalLobes
  const northReach = -sidecar.z + sidecar.radius + pedestalOverhang
  const southReach = main.radius + pedestalOverhang
  const depth = main.length + main.radius + pedestalOverhang
  // The exhibit is shown over the middle of its pedestal’s depth.
  expect(Math.abs(exhibitOffset - depth / 2)).toBeLessThan(0.15)
  // The sidecar merges into the pedestal’s straight flank, and its nameplate’s stand rests on it clear of the pedestal.
  expect(main.z - main.radius - sidecar.z).toBeLessThan(sidecar.radius - 0.2)
  expect(main.z - main.radius - sidecar.z).toBeGreaterThan(0.2)
  // Where it meets the pedestal’s north flank, the sidecar’s top lies two thirds up from the course there to the pedestal’s top.
  const flankCourse = exhibitionPedestal.plinth + tunnelSlope * (main.z - main.radius)
  const sidecarTop = sidecar.height + tunnelSlope * sidecar.z
  expect((sidecarTop - flankCourse) / (main.height - flankCourse)).toBeCloseTo(2 / 3, 9)
  const base = knotSignRoundParts.find(part => part.height === 0.028)!
  // the stand’s foot inside the sidecar’s flanks and round end
  expect(exhibitionSidecar.signShift + base.radius).toBeLessThan(sidecar.radius)
  expect(Math.hypot(Math.max(0, exhibitionSidecar.signOffset + base.radius - sidecar.length), exhibitionSidecar.signShift + base.radius)).toBeLessThan(sidecar.radius)
  expect(sidecar.z - exhibitionSidecar.signShift + base.radius).toBeLessThan(main.z - main.radius - pedestalOverhang)
  for (const slot of exhibitionSlots) {
    const display = displayOf(slot)
    const south = display.center[1] + display.size[1] / 2
    const north = display.center[1] - display.size[1] / 2
    const [, , z] = slot.position
    expect(z - northReach - north).toBeGreaterThan(0.5)
    // The way in from the cutout in the south end wall runs along the wall past the southern pedestal.
    expect(south - z - southReach).toBeGreaterThan(0.9)
    // A visitor of 30 cm half-width passes between the pedestals and the window.
    expect(display.size[0] - wallFace - depth).toBeGreaterThan(0.62)
    // The nameplate stands on its sidecar’s cap, faces the window and stays clear of its exhibit.
    const [signX, signY, signZ] = slot.sign.position
    expect(signZ).toBeCloseTo(z + sidecar.z - exhibitionSidecar.signShift, 9)
    expect(Math.abs(signX - display.backAt(signZ))).toBeCloseTo(exhibitionSidecar.signOffset, 9)
    // The sidecar’s cap is level at its height over the floor under its middle.
    expect(signY - knotSign.elevation).toBeCloseTo(tunnelFloorHeight(z + sidecar.z) + sidecar.height, 9)
    // It faces out toward the window, the lowest down the tunnel toward the Oculus, to the north, the middle one straight and the highest up the tunnel toward Moonfall, to the south.
    const turn = [-1, 0, 1][display.exhibits.findIndex(exhibit => exhibit.id === slot.id)] * exhibitionSidecar.signTurn
    const facing = new Vector3(0, 0, 1)
    facing.applyAxisAngle(new Vector3(0, 1, 0), slot.sign.rotation)
    expect(facing.x * slot.direction).toBeCloseTo(Math.cos(turn), 9)
    expect(facing.z).toBeCloseTo(Math.sin(turn), 9)
    // Every corner of its plaque, which leans back, stays off the back wall, and either north of the pedestal or over its cap.
    const capTop = slot.pedestal[1] + main.height
    const [plaque] = knotSignParts
    for (const corner of [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(zSide => new Vector3(x * plaque.size[0] / 2, y * plaque.size[1] / 2, zSide * plaque.size[2] / 2))))) {
      corner.applyEuler(new Euler(...plaque.rotation!)).add(new Vector3(...plaque.position)).applyAxisAngle(new Vector3(0, 1, 0), slot.sign.rotation).add(new Vector3(...slot.sign.position))
      expect(Math.abs(corner.x - display.backAt(corner.z))).toBeGreaterThan(0.08)
      expect(corner.z < z - southReach - 0.1 || corner.y > capTop + 0.03).toBe(true)
      expect(Math.hypot(corner.x - slot.position[0], corner.z - z)).toBeGreaterThan(1.2)
    }
  }
  expect(new Set(exhibitionSlots.map(slot => slot.label))).toEqual(new Set(['#01', '#02', '#03', '#04', '#05', '#06']))
  // The displays reach past their windows’ north ends, behind the tunnel’s wall.
  for (const display of tunnelDisplays) {
    expect(display.size[1]).toBeCloseTo(tunnelDisplayWindow.width + displayNorthExtension, 9)
  }
})
test('a pedestal’s course follows the sloping floor around both lobes, while their caps stay level, flush with the wall behind it', () => {
  const [sidecar, main] = exhibitionPedestalLobes
  for (const direction of [-1, 1] as const) {
    const geometry = new DisplayPedestalGeometry({
      direction,
      lobes: exhibitionPedestalLobes,
      plinth: exhibitionPedestal.plinth,
      slope: tunnelSlope,
    })
    const material = new MeshBasicMaterial({side: DoubleSide})
    const meshes = [geometry.stone, geometry.reveal, geometry.cap].map(part => new Mesh(part, material))
    const down = (x: number, z: number) => {
      const ray = new Raycaster(new Vector3(direction * x, 3, z), new Vector3(0, -1, 0))
      return ray.intersectObjects(meshes)
    }
    try {
      const stone = geometry.stone.boundingBox!
      expect(Math.min(direction * stone.min.x, direction * stone.max.x)).toBeCloseTo(0, 6)
      expect(Math.max(direction * stone.min.x, direction * stone.max.x)).toBeCloseTo(main.length + main.radius + pedestalOverhang, 3)
      expect(stone.max.z).toBeCloseTo(main.radius + pedestalOverhang, 3)
      expect(stone.min.z).toBeCloseTo(sidecar.z - sidecar.radius - pedestalOverhang, 3)
      // Each lobe’s cap is level at its height over the floor under its middle.
      for (const lobe of [sidecar, main]) {
        for (const along of [-0.3, 0, 0.3]) {
          expect(down(0.2, lobe.z + along * lobe.radius)[0].point.y).toBeCloseTo(lobe.height + tunnelSlope * lobe.z, 3)
        }
      }
      // Wherever the course runs, the stone sits on the sloping floor.
      for (const z of [sidecar.z - sidecar.radius, sidecar.z, (sidecar.z + main.z - main.radius) / 2, -1, 0, 1, main.radius]) {
        expect(down(0.1, z).at(-1)!.point.y).toBeCloseTo(-0.02 + z * tunnelSlope, 2)
      }
      // Where the lobes meet, the course runs on without a gap, and out past the sidecar there is none.
      const seamZ = sidecar.z + sidecar.radius * 0.8
      expect(down(sidecar.radius * 0.5, seamZ).length).toBeGreaterThan(0)
      expect(down(sidecar.length + sidecar.radius + pedestalOverhang + 0.05, sidecar.z)).toHaveLength(0)
      expect(down(sidecar.length + sidecar.radius + pedestalOverhang - 0.05, sidecar.z).length).toBeGreaterThan(0)
      for (const part of [geometry.stone, geometry.reveal, geometry.cap]) {
        expect([...part.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
      }
      expect(geometry.collision).toHaveLength(3)
    } finally {
      material.dispose()
      geometry.dispose()
    }
  }
  // too low for the slope, apart, out of order, one inside the other, flanks into the wall
  const invalid: Array<Array<PedestalLobe>> = [
    [{
      z: 0,
      radius: 3,
      height: 0.3,
    }],
    [{
      z: 0,
      radius: 1,
      height: 1,
    }, {
      z: 3,
      radius: 1,
      height: 1,
    }],
    [{
      z: 1,
      radius: 1,
      height: 1,
    }, {
      z: 0,
      radius: 1,
      height: 1,
    }],
    [{
      z: 0,
      radius: 1.5,
      length: 1,
      height: 1,
    }, {
      z: 0.2,
      radius: 0.3,
      height: 0.5,
    }],
    [{
      z: 0,
      radius: 1,
      length: -0.5,
      height: 1,
    }],
  ]
  for (const lobes of invalid) {
    expect(() => new DisplayPedestalGeometry({
      lobes,
      plinth: 0.1,
      slope: tunnelSlope,
    })).toThrow(RangeError)
  }
})
test('the diagonal pedestals have level caps, flush backs and a walkable aisle along the glazing', () => {
  const material = new MeshBasicMaterial({side: DoubleSide})
  try {
    for (const slot of exhibitionSlots) {
      const display = displayOf(slot)
      const geometry = new DisplayPedestalGeometry({
        direction: slot.direction,
        lobes: exhibitionPedestalLobes,
        plinth: exhibitionPedestal.plinth,
        slope: tunnelSlope,
        skew: tunnelSkew,
      })
      try {
        const mesh = new Mesh(geometry.cap, material)
        mesh.position.set(...slot.pedestal)
        mesh.updateMatrixWorld()
        for (const lobe of exhibitionPedestalLobes) {
          const z = slot.pedestal[2] + lobe.z
          const x = display.backAt(z) + slot.direction * (lobe.length + lobe.radius / 2)
          const ray = new Raycaster(new Vector3(x, slot.pedestal[1] + 2, z), new Vector3(0, -1, 0))
          expect(ray.intersectObject(mesh)[0].point.y).toBeCloseTo(tunnelFloorHeight(z) + lobe.height, 5)
        }
        for (const part of [geometry.stone, geometry.reveal, geometry.cap]) {
          const positions = part.getAttribute('position')
          for (let vertex = 0; vertex < positions.count; vertex++) {
            const x = slot.pedestal[0] + positions.getX(vertex)
            const z = slot.pedestal[2] + positions.getZ(vertex)
            expect((x - display.backAt(z)) * slot.direction).toBeGreaterThanOrEqual(-1e-6)
            const aisle = (x - display.frontAt(z)) * -slot.direction / Math.hypot(1, tunnelSkew) - wallFace
            expect(aisle).toBeGreaterThan(0.7)
          }
        }
      } finally {
        geometry.dispose()
      }
    }
  } finally {
    material.dispose()
  }
})
