import {expect, test} from 'bun:test'

import PlacardRoll, {placardClearance, placardLandings, placardQuarters, placardRoll} from '../../src/lib/gallery/PlacardRoll.ts'

const play = (delta: number) => {
  const roll = new PlacardRoll
  const frames: Array<{
    angle: number
    lift: number
    turned: boolean
  }> = []
  while (roll.update(delta)) {
    frames.push({
      angle: roll.angle,
      lift: roll.lift,
      turned: roll.turned,
    })
  }
  return {
    roll,
    frames,
  }
}
test('a placard winds up, rolls its turns past the last and back and comes to rest where it hangs', () => {
  const {roll, frames} = play(1 / 60)
  const total = placardRoll.turns * 2 * Math.PI
  expect(roll.running).toBe(false)
  expect(roll.angle).toBeCloseTo(total, 9)
  expect(roll.lift).toBe(0)
  expect(roll.rise).toBe(0)
  expect(roll.tilt).toBe(0)
  expect(Math.min(...frames.map(frame => frame.angle))).toBeCloseTo(-placardRoll.windup.angle, 2)
  expect(Math.max(...frames.map(frame => frame.angle))).toBeGreaterThan(total + 0.1)
  expect(frames.length).toBeCloseTo(placardRoll.duration * 60, -1)
})
test('the flick flings it off its wall and it bounces back once', () => {
  const {frames} = play(1 / 240)
  const lifts = frames.map(frame => frame.lift)
  expect(Math.max(...lifts)).toBeCloseTo(placardRoll.fling.height, 2)
  let landed = lifts.indexOf(Math.max(...lifts))
  while (lifts[landed + 1] < lifts[landed]) {
    landed++
  }
  expect(lifts[landed]).toBeLessThan(0.01)
  expect(Math.max(...lifts.slice(landed))).toBeCloseTo(placardRoll.fling.height * placardRoll.fling.restitution ** 2, 2)
})
test('the new text goes on while the face points to the wall', () => {
  for (const rate of [30, 60, 144, 240]) {
    const {frames} = play(1 / rate)
    const swap = frames.findIndex(frame => frame.turned)
    expect(swap).toBeGreaterThan(0)
    expect(Math.cos(frames[swap].angle)).toBeLessThan(-0.5)
    // It turned to the wall for the last time: once the face comes round to the viewer, it stays.
    const after = frames.slice(swap)
    const facing = after.findIndex(frame => Math.cos(frame.angle) > 0)
    expect(after.every(frame => frame.turned)).toBe(true)
    expect(after.slice(facing).every(frame => Math.cos(frame.angle) > 0)).toBe(true)
  }
})
test('no edge of a rolling placard reaches its wall', () => {
  const {frames} = play(1 / 240)
  for (const {angle, lift} of frames) {
    expect(lift).toBeGreaterThanOrEqual(placardClearance(angle))
  }
  expect(Math.max(...frames.map(frame => placardClearance(frame.angle)))).toBeGreaterThan(0)
})
test('its quarter turns and landings are where the stepped roll passes them', () => {
  const step = 1 / 4000
  const {frames} = play(step)
  const quarters = placardQuarters()
  expect(quarters).toHaveLength(placardRoll.turns * 4)
  for (const [index, quarter] of quarters.entries()) {
    const mark = (index + 1) * Math.PI / 2
    const frame = frames.findIndex(candidate => candidate.angle >= mark)
    expect(Math.abs((frame + 1) * step - quarter.time)).toBeLessThan(2 * step)
    const speed = (frames[frame].angle - frames[frame - 1].angle) / step
    expect(quarter.speed).toBeCloseTo(speed, 0)
  }
  // The text goes on as its face points to the wall for the last time, at the tenth quarter turn.
  const turned = frames.findIndex(frame => frame.turned)
  expect(Math.abs((turned + 1) * step - quarters[9].time)).toBeLessThan(2 * step)
  const lifts = frames.map(frame => frame.lift)
  const lowest = (from: number, to: number) => {
    const window = lifts.slice(Math.round(from / step), Math.round(to / step))
    return (lifts.indexOf(Math.min(...window), Math.round(from / step)) + 1) * step
  }
  const {bounce, slam} = placardLandings
  expect(slam).toBeLessThan(bounce)
  expect(Math.abs(lowest(slam - 0.05, slam + 0.05) - slam)).toBeLessThan(0.005)
  expect(Math.abs(lowest(bounce - 0.05, bounce + 0.05) - bounce)).toBeLessThan(0.005)
})
