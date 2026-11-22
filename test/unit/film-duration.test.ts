import {expect, test} from 'bun:test'

import {parseRecipe, sampleRecipe} from 'capture-session/script'

import {FilmRecipeClock} from '../../scripts/lib/filmRecipeClock.ts'
import {StitchTimeline} from '../../scripts/lib/stitchTimeline.ts'

const recipe = parseRecipe([
  {
    time: 0,
    yaw: 0,
  },
  {
    time: 1.25,
    tools: {first: {}},
  },
  {
    time: 2.5,
    tools: {second: {}},
  },
  {
    time: 3,
    yaw: 60,
    tools: {last: {}},
  },
])
const spawn = {
  position: [0, 0, 0] as [number, number, number],
  yaw: 0,
  pitch: 0,
  roll: 0,
  fov: 60,
}
const shot = (clock: FilmRecipeClock, stitchedStart: number, startingFrame = 1, clip = 0, cycle?: number) => {
  const take = clock.take(clip, stitchedStart, startingFrame, cycle)
  return Array.from({length: take.frameCount}, (_, frame) => ({
    yaw: sampleRecipe(recipe, take.secondsAt(frame), spawn).yaw,
    tools: take.callsAt(frame)?.map(call => call.name),
  }))
}
test('a short take trims camera motion and tool calls, and a longer take holds the final pose without replaying tools', () => {
  const short = shot(new FilmRecipeClock(recipe, 2, [2]), 0)
  expect(short.map(frame => frame.yaw)).toEqual([0, 10, 20, 30])
  expect(short.flatMap(frame => frame.tools ?? [])).toEqual(['first'])
  const long = new FilmRecipeClock(recipe, 2, [4.5])
  const first = shot(long, 0)
  expect(first.map(frame => frame.yaw)).toEqual([0, 10, 20, 30, 40, 50, 60, 60, 60])
  expect(first.flatMap(frame => frame.tools ?? [])).toEqual(['first', 'second', 'last'])
  expect(shot(long, 9)).toEqual(first)
  expect(shot(long, 0, 7)).toEqual([...first.slice(6), ...first.slice(0, 6)])
})
test('short stitched takes continue the flight, with the same camera and tools on both sides of a crossfade', () => {
  const clock = new FilmRecipeClock(recipe, 2, [2], 3)
  const timeline = new StitchTimeline(clock.clipFrames, 2, 0.5)
  const takes = [0, 1, 2].map(clip => shot(clock, timeline.clipStart(clip), 1, clip))
  expect(takes.map(frames => frames.map(frame => frame.yaw))).toEqual([[0, 10, 20, 30], [30, 40, 50, 60], [60, 60, 60, 60]])
  expect(takes[0].at(-1)).toEqual(takes[1][0])
  expect(takes[1].at(-1)).toEqual(takes[2][0])
  expect(takes[2].flatMap(frame => frame.tools ?? [])).toEqual(['last'])
  const full = new FilmRecipeClock(recipe, 2)
  expect(shot(full, 6)).toEqual(shot(full, 0))
})
test('in a looping movie the flight wraps round, so the last take fades into the first at the same moment', () => {
  const clock = new FilmRecipeClock(recipe, 2, [2.5], 3)
  const timeline = new StitchTimeline(clock.clipFrames, 2, 0.5, 1, {loop: true})
  expect(timeline.frameCount).toBe(12)
  const takes = [0, 1, 2].map(clip => shot(clock, timeline.clipStart(clip), 1, clip, timeline.frameCount))
  expect(takes.map(frames => frames.map(frame => frame.yaw))).toEqual([[0, 10, 20, 30, 40], [40, 50, 60, 60, 60], [60, 60, 60, 60, 0]])
  expect(takes[2].at(-1)).toEqual(takes[0][0])
})
test('duration requires positive finite seconds and can give a still recipe a recording length', () => {
  for (const invalid of [-1, 0, NaN, Infinity]) {
    expect(() => new FilmRecipeClock(recipe, 24, [invalid])).toThrow('--duration')
    expect(() => new FilmRecipeClock(recipe, 24, [1, invalid], 2)).toThrow('--duration')
  }
  expect(() => new FilmRecipeClock(recipe, 24, [1, 2], 3)).toThrow('2 lengths for 3 clips')
  const still = new FilmRecipeClock([{time: 0}], 24, [0.1])
  expect(still.clipFrames).toEqual([2])
})
test('world animation advances across cuts and agrees on every overlapping frame even when the camera repeats its recipe', () => {
  const clock = new FilmRecipeClock(recipe, 4, undefined, 2)
  const [clipFrames] = clock.clipFrames
  for (const fade of [0, 0.5]) {
    const timeline = new StitchTimeline(clock.clipFrames, 4, fade)
    const first = clock.take(0, 0, timeline.recipeStart)
    const next = clock.take(1, timeline.clipStart(1), timeline.recipeStart)
    expect(first.secondsAt(0)).toBe(next.secondsAt(0))
    for (let i = 0; i < timeline.fadeFrames; i++) {
      expect(next.animationSecondsAt(i)).toBe(first.animationSecondsAt(clipFrames - timeline.fadeFrames + i))
    }
    expect(next.animationSecondsAt(timeline.fadeFrames) - first.animationSecondsAt(clipFrames - 1)).toBe(1 / 4)
  }
})
test('clips of their own lengths continue one flight, unless every clip has room for the whole recipe', () => {
  const clock = new FilmRecipeClock(recipe, 2, [1, 2.5, 1], 3)
  expect(clock.clipFrames).toEqual([2, 5, 2])
  const timeline = new StitchTimeline(clock.clipFrames, 2, 0)
  const takes = [0, 1, 2].map(clip => shot(clock, timeline.clipStart(clip), 1, clip))
  expect(takes.map(frames => frames.map(frame => frame.yaw))).toEqual([[0, 10], [20, 30, 40, 50, 60], [60, 60]])
  expect(takes.flatMap(frames => frames.flatMap(frame => frame.tools ?? []))).toEqual(['first', 'second', 'last'])
  const replaying = new FilmRecipeClock(recipe, 2, [3, 3.5], 2)
  const replay = new StitchTimeline(replaying.clipFrames, 2, 0)
  expect(shot(replaying, replay.clipStart(1), 1, 1).map(frame => frame.yaw)).toEqual([0, 10, 20, 30, 40, 50, 60])
})
