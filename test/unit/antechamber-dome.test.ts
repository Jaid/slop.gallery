import {expect, test} from 'bun:test'

import {Vector3} from 'three/webgpu'

import antechamberDome, {antechamberDomeGeometry, antechamberGlassPlacements, antechamberLatticeGeometry, antechamberLatticeY, antechamberWindows} from '../../src/lib/gallery/antechamberDome.ts'
import {antechamberDomeCrownY} from '../../src/lib/gallery/antechamberDomeShape.ts'
import {roomClearHeight, rooms} from './fixtures/gallery.ts'

const antechamber = rooms.find(room => room.id === 'antechamber')!
test('the dome springs from the top of the ceiling slab and stays inside the walls', () => {
  expect(antechamberDome.springY).toBeCloseTo(antechamber.height - 0.02 + 0.09, 9)
  expect(antechamberDome.radius).toBeLessThan(antechamber.size[0] / 2 - 0.105)
  expect(roomClearHeight(antechamber)).toBeCloseTo(antechamberDomeCrownY - antechamber.floorY, 9)
})
test('the round windows keep clear of one another, the springing and the oculus', () => {
  const windows = antechamberWindows()
  expect(windows.length).toBeGreaterThan(0)
  for (const [index, {direction, radius}] of windows.entries()) {
    const elevation = Math.asin(direction.y)
    expect(elevation - radius).toBeGreaterThan(0.1)
    expect(elevation + radius).toBeLessThan(antechamberDome.oculus * Math.PI / 180 - 0.1)
    for (const other of windows.slice(index + 1)) {
      expect(direction.angleTo(other.direction)).toBeGreaterThan(radius + other.radius + 0.05)
    }
  }
})
test('the shell leaves out the oculus and the faces wholly inside a window', () => {
  const geometry = antechamberDomeGeometry()
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()!
  const [around, up] = antechamberDome.segments
  const oculusRows = (90 - antechamberDome.oculus) / (90 / up)
  // The topmost row of the sphere has one triangle per segment, every other row two.
  expect(index.count / 3).toBeLessThan(around * (up * 2 - 1) - around * (oculusRows * 2 - 1))
  const corner = new Vector3
  for (let i = 0; i < index.count; i += 3) {
    for (const {direction, radius} of antechamberWindows()) {
      const inside = [0, 1, 2].every(offset => corner.fromBufferAttribute(position, index.getX(i + offset)).normalize().dot(direction) > Math.cos(radius))
      expect(inside).toBe(false)
    }
  }
})
test('each pane meets the shell at its window’s rim', () => {
  const windows = antechamberWindows()
  for (const [index, {center, normal, radius}] of antechamberGlassPlacements().entries()) {
    const rim = Math.hypot(center.length() + antechamberDome.glassInset, radius)
    expect(rim).toBeCloseTo(antechamberDome.radius, 9)
    expect(normal.dot(windows[index].direction)).toBeCloseTo(-1, 9)
  }
})
test('the lattice rests on the rim of the oculus and covers it', () => {
  const lattice = antechamberLatticeGeometry()
  lattice.computeBoundingBox()
  const {min, max} = lattice.boundingBox!
  const oculusRadius = antechamberDome.radius * Math.cos(antechamberDome.oculus * Math.PI / 180)
  expect(max.x).toBeGreaterThan(oculusRadius)
  // The geometry holds 32-bit floats.
  expect(min.y).toBeCloseTo(0, 6)
  expect(max.y).toBeCloseTo(antechamberDome.latticeDepth, 6)
  expect(antechamberLatticeY).toBeLessThan(antechamberDome.radius * Math.sin(antechamberDome.oculus * Math.PI / 180))
})
