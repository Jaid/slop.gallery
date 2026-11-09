import type {Vec3} from '../../src/lib/gallery/types.ts'

import {expect, test} from 'bun:test'

import {aimThrow} from '../../src/lib/physics/aimThrow.ts'

/** where a body leaving `from` with `velocity` is `seconds` later under Rapier’s default gravity, as a parabola */
const flown = (from: Vec3, velocity: Vec3, seconds: number) => from.map((value, axis) => value + velocity[axis] * seconds - (axis === 1 ? 9.81 / 2 * seconds ** 2 : 0))
test('a throw at a target leaves at the speed asked for on the flatter arc and gets there', () => {
  for (const [from, target, speed] of [[[0, 1.5, 0], [0, 1.8, -4], 10], [[2, 1.4, 1], [-1, 0.5, 3], 6], [[0, 1, 0], [8, 1, 0], 9.5]] as Array<[Vec3, Vec3, number]>) {
    const aim = aimThrow(from, target, speed)!
    expect(Math.hypot(...aim.velocity)).toBeCloseTo(speed, 9)
    const reached = flown(from, aim.velocity, aim.seconds)
    for (const axis of [0, 1, 2]) {
      expect(reached[axis]).toBeCloseTo(target[axis], 9)
    }
    // The steeper arc would take longer.
    expect(aim.seconds).toBeLessThan(Math.hypot(target[0] - from[0], target[2] - from[2]) / speed * 1.6)
  }
})
test('a throw straight up or down flies along the vertical, and one out of reach at its speed has no aim', () => {
  const up = aimThrow([0, 0, 0], [0, 2, 0], 10)!
  expect(up.velocity).toEqual([0, 10, 0])
  expect(flown([0, 0, 0], up.velocity, up.seconds)[1]).toBeCloseTo(2, 9)
  const down = aimThrow([0, 3, 0], [0, 1, 0], 2)!
  expect(down.velocity).toEqual([0, -2, 0])
  expect(flown([0, 3, 0], down.velocity, down.seconds)[1]).toBeCloseTo(1, 9)
  expect(aimThrow([0, 0, 0], [0, 6, 0], 10)).toBeUndefined()
  expect(aimThrow([0, 0, 0], [30, 0, 0], 10)).toBeUndefined()
})
