import type {PortraitDump} from '../../src/lib/webmcp/dumpPortraits.ts'

import {expect, test} from 'bun:test'

import {findLanding, orbitDistance, resultView, throughKeys, throwMotion} from '../../scripts/renderFusion.ts'

const work = (patch: Partial<PortraitDump>): PortraitDump => ({
  id: 'work',
  title: 'Work',
  hung: true,
  width: 1.2,
  height: 0.8,
  position: [0, 2, 0],
  quaternion: [0, 0, 0, 1],
  ...patch,
})
/** lying face up with its top toward −z: turned a quarter round x */
const faceUp: [number, number, number, number] = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]
test('the camera’s path passes through every key without stopping between them and holds still outside them', () => {
  const keys = [[0, 0, 10], [1, 2, 10], [3, 2, 4], [4, 6, 4]]
  for (const [time, ...values] of keys) {
    expect(throughKeys(keys, time)).toEqual(values)
  }
  expect(throughKeys(keys, -1)).toEqual([0, 10])
  expect(throughKeys(keys, 9)).toEqual([6, 4])
  // Through a key between two that rise, it keeps moving.
  const before = throughKeys(keys, 0.999)[0]
  const after = throughKeys(keys, 1.001)[0]
  expect(after).toBeGreaterThan(before)
  // It is continuous everywhere.
  for (let time = 0; time < 4; time += 0.001) {
    const [a, b] = throughKeys(keys, time)
    const [c, d] = throughKeys(keys, time + 0.001)
    expect(Math.abs(c - a)).toBeLessThan(0.02)
    expect(Math.abs(d - b)).toBeLessThan(0.02)
  }
})
test('the camera dollies after the thrown orb, is knocked back past where it threw from on the strike and drawn in again for the burst', () => {
  const timeline = {
    throwAt: 1,
    strike: 1.5,
  }
  expect(throwMotion(1, timeline)).toEqual({
    radius: 0,
    height: 0,
    fov: 0,
  })
  const flying = throwMotion(1.25, timeline)
  expect(flying.radius).toBeLessThan(-0.2)
  expect(flying.height).toBeGreaterThan(0.1)
  expect(throwMotion(1.5, timeline).radius).toBeCloseTo(-0.6, 9)
  const knocked = throwMotion(1.85, timeline)
  expect(knocked.radius).toBeGreaterThan(1.4)
  expect(knocked.fov).toBeGreaterThan(4)
  // It moves continuously, within a 60 fps frame by at most a quarter of a meter, even as it is knocked back.
  for (let time = 0; time < 4; time += 1 / 60) {
    expect(Math.abs(throwMotion(time + 1 / 60, timeline).radius - throwMotion(time, timeline).radius)).toBeLessThan(0.25)
  }
  expect(throwMotion(3, timeline).radius).toBeCloseTo(0, 9)
})
test('while the portal brews, the camera stands back far enough to see the satellites whole at the end of their orbit', () => {
  const portal = {
    orbit: {
      along: 1.35,
      across: 0.8,
      tilt: 0.72,
    },
  }
  for (const fov of [40, 48, 60]) {
    const halfWidth = orbitDistance(portal, fov) * Math.tan(fov * Math.PI / 360)
    expect(halfWidth).toBeGreaterThan(1.35 + 0.4)
  }
  expect(orbitDistance(portal, 40)).toBeGreaterThan(orbitDistance(portal, 60))
})
test('the result is the work that no longer hangs and no fusion holds, or a new one, followed until it lies still', () => {
  const dumps = [
    {
      time: 0,
      portraits: [work({}), work({id: 'other'})],
    },
    {
      time: 14,
      portraits: [work({
        hung: false,
        fusing: true,
      }), work({id: 'other'})],
    },
    ...Array.from({length: 30}, (_, index) => {
      const time = 15 + index * 0.1
      const falling = Math.max(0, 1.5 - index * 0.1)
      return {
        time,
        portraits: [work({id: 'other'}), work({
          id: 'result',
          hung: false,
          width: 1.5,
          height: 1,
          position: [0, 0.05 + falling, 1],
          quaternion: faceUp,
        })],
      }
    }),
  ]
  const landing = findLanding(dumps, 'work')!
  expect(landing.track[0].time).toBe(15)
  expect(landing.track).toHaveLength(30)
  expect(landing.settled).toBeCloseTo(16.5, 9)
  expect(landing.position).toEqual([0, 0.05, 1])
  expect(landing.width).toBe(1.5)
  // A result that keeps the work’s id counts, too.
  const kept = findLanding(dumps.map(({portraits, time}) => ({
    time,
    portraits: portraits.map(portrait => (portrait.id === 'result' ? {
      ...portrait,
      id: 'work',
    } : portrait)),
  })), 'work')!
  expect(kept.track[0].time).toBe(15)
  expect(findLanding(dumps.slice(0, 2), 'work')).toBeUndefined()
})
test('the camera looks down on a result lying face up from its bottom edge, so its image stands upright', () => {
  // In the middle of the Banquet, far from its walls
  const view = resultView({
    position: [14, 0.05, -4],
    quaternion: faceUp,
    width: 1.5,
    height: 1,
  }, 5.8)
  expect(view.faceDown).toBe(false)
  // Its top points toward −z, so the camera stands toward +z.
  expect(view.direction[2]).toBeCloseTo(1, 9)
  expect(view.eye - 0.05).toBeGreaterThan(view.back)
  // Under a low ceiling, it looks down less steeply from further away.
  const low = resultView({
    position: [14, 0.05, -4],
    quaternion: faceUp,
    width: 1.5,
    height: 1,
  }, 2)
  expect(low.eye).toBeLessThanOrEqual(1.6 + 1e-9)
  expect(low.back).toBeGreaterThan(view.back)
})
