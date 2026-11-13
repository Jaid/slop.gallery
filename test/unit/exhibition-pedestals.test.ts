import type {PedestalLobe} from '../../src/lib/gallery/DisplayPedestalGeometry.ts'

import {expect, test} from 'bun:test'

import {knotSign, knotSignParts, knotSignRoundParts} from 'knot-materials/signs.ts'
import {DoubleSide, Euler, Mesh, MeshBasicMaterial, Raycaster, Vector3} from 'three/webgpu'

import {wallFace} from '../../src/lib/gallery/architectureDimensions.ts'
import DisplayPedestalGeometry, {pedestalOverhang} from '../../src/lib/gallery/DisplayPedestalGeometry.ts'
import {tunnelDiagonalEast, tunnelDiagonalFloorY, tunnelDiagonalHeading, tunnelDiagonalPoint, tunnelSlope} from '../../src/lib/gallery/lowerGallery.ts'
import tunnelDisplays, {tunnelDisplayWindow} from '../../src/lib/gallery/tunnelDisplays.ts'
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
    const floor = tunnelDiagonalFloorY(slot.s)
    const [backX, backZ] = tunnelDiagonalPoint(slot.s, display.backAcross)
    const [expectedX, expectedZ] = tunnelDiagonalPoint(slot.s, display.backAcross + slot.direction * exhibitOffset)
    expect(slot.pedestal).toEqual([backX, floor, backZ])
    expect(x).toBeCloseTo(expectedX, 9)
    expect(z).toBeCloseTo(expectedZ, 9)
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
    expect(slot.s - northReach - display.northS).toBeGreaterThan(0.1)
    // The way in from the cutout in the south end wall runs along the wall past the southern pedestal.
    expect(display.southS - slot.s - southReach).toBeGreaterThan(0.75)
    // A visitor of 30 cm half-width passes between the pedestals and the window.
    expect(display.size[0] - wallFace - depth).toBeGreaterThan(0.62)
    // The nameplate stands on its sidecar’s cap, faces the window and stays clear of its exhibit.
    const [signX, signY, signZ] = slot.sign.position
    const [expectedSignX, expectedSignZ] = tunnelDiagonalPoint(slot.s + sidecar.z - exhibitionSidecar.signShift, display.backAcross + slot.direction * exhibitionSidecar.signOffset)
    expect(signX).toBeCloseTo(expectedSignX, 9)
    expect(signZ).toBeCloseTo(expectedSignZ, 9)
    // The sidecar’s cap is level at its height over the floor under its middle.
    expect(signY - knotSign.elevation).toBeCloseTo(tunnelDiagonalFloorY(slot.s + sidecar.z) + sidecar.height, 9)
    // It faces out toward the window in the diagonal gallery’s frame.
    const turn = [-1, 0, 1][display.exhibits.findIndex(exhibit => exhibit.id === slot.id)] * exhibitionSidecar.signTurn
    const facing = new Vector3(0, 0, 1)
    facing.applyAxisAngle(new Vector3(0, 1, 0), slot.sign.rotation)
    const acrossDot = facing.x * tunnelDiagonalEast[0] + facing.z * tunnelDiagonalEast[1]
    const alongDot = facing.x * tunnelDiagonalHeading[0] + facing.z * tunnelDiagonalHeading[1]
    expect(acrossDot * slot.direction).toBeCloseTo(Math.cos(turn), 9)
    expect(alongDot).toBeCloseTo(Math.sin(turn), 9)
    // Every corner of its plaque stays off the back wall, and either north of the pedestal or over its cap.
    const capTop = slot.pedestal[1] + main.height
    const [plaque] = knotSignParts
    const [wallBaseX, wallBaseZ] = tunnelDiagonalPoint(0, display.backAcross)
    for (const corner of [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(zSide => new Vector3(x * plaque.size[0] / 2, y * plaque.size[1] / 2, zSide * plaque.size[2] / 2))))) {
      corner.applyEuler(new Euler(...plaque.rotation!)).add(new Vector3(...plaque.position)).applyAxisAngle(new Vector3(0, 1, 0), slot.sign.rotation).add(new Vector3(...slot.sign.position))
      const distFromBack = Math.abs((corner.x - wallBaseX) * tunnelDiagonalEast[0] + (corner.z - wallBaseZ) * tunnelDiagonalEast[1])
      const alongFromExhibit = (corner.x - slot.pedestal[0]) * tunnelDiagonalHeading[0] + (corner.z - slot.pedestal[2]) * tunnelDiagonalHeading[1]
      expect(distFromBack).toBeGreaterThan(0.08)
      expect(alongFromExhibit < -southReach - 0.1 || corner.y > capTop + 0.03).toBe(true)
      expect(Math.hypot(corner.x - slot.position[0], corner.z - slot.position[2])).toBeGreaterThan(1.2)
    }
  }
  expect(new Set(exhibitionSlots.map(slot => slot.label))).toEqual(new Set(['#01', '#02', '#03', '#04', '#05', '#06']))
  for (const display of tunnelDisplays) {
    expect(display.size[1]).toBeGreaterThan(tunnelDisplayWindow.width)
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
      for (const lobe of [sidecar, main]) {
        for (const along of [-0.3, 0, 0.3]) {
          expect(down(0.2, lobe.z + along * lobe.radius)[0].point.y).toBeCloseTo(lobe.height + tunnelSlope * lobe.z, 3)
        }
      }
      for (const z of [sidecar.z - sidecar.radius, sidecar.z, (sidecar.z + main.z - main.radius) / 2, -1, 0, 1, main.radius]) {
        expect(down(0.1, z).at(-1)!.point.y).toBeCloseTo(-0.02 + z * tunnelSlope, 2)
      }
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
