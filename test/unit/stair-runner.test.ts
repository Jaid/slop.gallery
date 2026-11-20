import type {FloorPolygon} from '../../src/lib/gallery/floorPolygons.ts'

import {expect, test} from 'bun:test'

import {corridorLanding, corridorLandingPaving, corridorRunner, corridorStairHead, corridorStairs} from '../../src/lib/gallery/corridor.ts'
import {polygonArea, polygonCentroid} from '../../src/lib/gallery/floorPolygons.ts'
import StairFlight from '../../src/lib/gallery/stairs/StairFlight.ts'
import StairRunner from '../../src/lib/gallery/stairs/StairRunner.ts'
import StairRunnerMaterial from '../../src/lib/materials/StairRunnerMaterial.ts'

const area = (polygons: ReadonlyArray<FloorPolygon>) => polygons.reduce((sum, polygon) => sum + Math.abs(polygonArea(polygon)), 0)
test('the runner material shades every corridor block without extra carpet meshes', () => {
  const material = new StairRunnerMaterial(corridorRunner)
  try {
    expect(material.runner).toBe(corridorRunner)
    for (const node of [material.colorNode, material.normalNode, material.roughnessNode, material.metalnessNode, material.sheenNode]) {
      expect(node).not.toBeNull()
    }
  } finally {
    material.dispose()
  }
})
test('one woven repeat spans exactly one tread and its riser', () => {
  expect(corridorRunner.stepLength).toBeCloseTo(corridorStairs.run + corridorStairs.rise)
  expect(corridorRunner.pathDistance(3, 'tread', 0) - corridorRunner.pathDistance(2, 'tread', 0)).toBeCloseTo(corridorRunner.stepLength)
})
test('the landing’s edge over the top tread is the flight’s first riser, which the runner climbs without a jump in its path', () => {
  const {heading: [hx, hz], start, width} = corridorStairs
  const along = ([x, z]: readonly [number, number]) => (x - start[0]) * hx + (z - start[2]) * hz
  const across = ([x, z]: readonly [number, number]) => (z - start[2]) * hx - (x - start[0]) * hz
  const edges = corridorLanding.floors.flatMap(floor => floor.map((corner, i) => [corner, floor[(i + 1) % floor.length]] as const))
  const riser = edges.filter(edge => edge.every(corner => Math.abs(along(corner)) < 1e-9))
  expect(riser).toHaveLength(1)
  const [left, right] = riser[0].map(across).toSorted((a, b) => a - b)
  expect(left).toBeCloseTo(-width / 2, 9)
  expect(right).toBeCloseTo(width / 2, 9)
  expect(corridorLanding.floorY).toBe(start[1])
  expect(corridorRunner.pathDistance(-1, 'riser', corridorStairs.rise)).toBeCloseTo(corridorRunner.pathDistance(0, 'tread', 0))
})
test('the landing’s edge is laid as the flight’s head tread, flush with it, and its boards cover the rest of it', () => {
  const {heading: [hx, hz], start, run, width} = corridorStairs
  const head = corridorStairHead
  expect(head.top).toBe(corridorLanding.floorY)
  expect(head.tread).toBe(true)
  expect((head.position[0] - start[0]) * hx + (head.position[2] - start[2]) * hz).toBeCloseTo(-run / 2)
  expect(head.size[0]).toBeCloseTo(run)
  expect(head.size[2]).toBeCloseTo(width)
  expect(area(corridorLandingPaving) + run * width).toBeCloseTo(area(corridorLanding.floors), 9)
})
test('a floor without the head’s footprint keeps everything around it', () => {
  const flight = new StairFlight('straight', [0, 0, 0], [4, -2, 0], 2, 10, 0, 0, 'corridor')
  const floor: FloorPolygon = [[-3, -2], [0, -2], [0, 2], [-3, 2]]
  const pieces = flight.outsideHead(floor)
  expect(area(pieces)).toBeCloseTo(12 - flight.run * flight.width, 9)
  for (const piece of pieces) {
    const [x, z] = polygonCentroid(piece)
    expect(x <= -flight.run + 1e-9 || Math.abs(z) >= flight.width / 2 - 1e-9).toBe(true)
  }
})
test('runners are rejected when their rods would reach the flight edge or the steps are too shallow', () => {
  expect(() => new StairRunner(corridorStairs, corridorStairs.width - 0.3)).toThrow(RangeError)
  const shallow = new StairFlight('shallow', [0, 0, 0], [-1, -0.02, 0], 2, 4, 0, 0, 'corridor')
  expect(() => new StairRunner(shallow, 1)).toThrow(RangeError)
})
