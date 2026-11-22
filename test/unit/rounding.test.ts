import {expect, test} from 'bun:test'

import {roundedView} from '../../src/lib/gallery/rounding.ts'

const degrees = Math.PI / 180
/** The direction of a view turned `yaw` and `pitch` degrees. */
const direction = (yaw: number, pitch: number) => [-Math.sin(yaw * degrees) * Math.cos(pitch * degrees), Math.sin(pitch * degrees), -Math.cos(yaw * degrees) * Math.cos(pitch * degrees)] as const
test('a view rounds to whole meters and whole degrees of yaw and pitch', () => {
  expect(roundedView([-1.16, 2.16, 2.29], [...direction(39.6, -5.31)])).toEqual({
    position: [-1, 2, 2],
    yaw: 40,
    pitch: -5,
  })
})
test('a rounded view has no negative zeros, and its direction needs no length of 1', () => {
  const view = roundedView([-0.3, 1.7, -0.2], direction(-0.2, 0.3).map(value => value * 4) as [number, number, number])
  expect(view).toEqual({
    position: [0, 2, 0],
    yaw: 0,
    pitch: 0,
  })
  expect([...view.position, view.yaw, view.pitch].every(value => !Object.is(value, -0))).toBe(true)
})
test('yaw turns left from looking toward −z, round the whole circle', () => {
  expect(roundedView([0, 0, 0], [...direction(90, 0)]).yaw).toBe(90)
  expect(roundedView([0, 0, 0], [...direction(-135.4, 20.6)])).toMatchObject({
    yaw: -135,
    pitch: 21,
  })
  expect(Math.abs(roundedView([0, 0, 0], [...direction(179.8, 0)]).yaw)).toBe(180)
})
