import type {SatelliteOrbit, SatellitePose} from '../../src/lib/gallery/fusion/orbit.ts'

import {describe, expect, test} from 'bun:test'

import {Group, Quaternion, Vector3} from 'three/webgpu'

import FusionEffect from '../../src/lib/gallery/fusion/effects/base/FusionEffect.ts'
import {brewing, portalEnvelope} from '../../src/lib/gallery/fusion/envelope.ts'
import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import {choreographed, emberRhythm, grab, ignition, implosion, introSeconds, introTether, introTrail, laps, pulse, release, whirl, whirled, whirling} from '../../src/lib/gallery/fusion/intro.ts'
import {introOrbitRate, orbitAngle, orbitPoint, orbitSpeed, satellitePose} from '../../src/lib/gallery/fusion/orbit.ts'
import {portalFrame, portalRebound, satelliteSize, touchesPortal} from '../../src/lib/gallery/fusion/portalFrame.ts'
import {firstTurn, fusionPulse, fusionTiming, imageAt, introTurns, minimumTurns, nextTurn} from '../../src/lib/gallery/fusion/timing.ts'

const work = {
  id: 'work',
  position: [2, 2.4, -5] as [number, number, number],
  rotation: Math.PI / 2,
  width: 1.2,
  height: 1.6,
}
const surroundings = {
  floor: 0,
  room: 8,
  sides: [6, 6] as const,
}
const frame = portalFrame(work, surroundings)
/** a fusion of the hung portrait and one more ingredient, both with an image */
const pair = {
  images: 2,
  ingredients: 2,
}
const pose = (): SatellitePose => ({
  position: new Vector3,
  quaternion: new Quaternion,
  scale: 1,
})
const wallSide = (point: Vector3) => (point.x - work.position[0]) * frame.normal[0] + (point.z - work.position[2]) * frame.normal[2]
describe('portal frame', () => {
  test('the portal floats in front of its work at about eye height, facing out of the wall', () => {
    expect(frame.normal[0]).toBeCloseTo(1)
    expect(frame.normal[2]).toBeCloseTo(0)
    expect(frame.center[0] - work.position[0]).toBeGreaterThan(0.9)
    expect(frame.center[1]).toBeGreaterThanOrEqual(1.55)
    expect(frame.center[1]).toBeLessThanOrEqual(2.05)
    const dot = frame.normal[0] * frame.tangent[0] + frame.normal[2] * frame.tangent[2]
    expect(dot).toBeCloseTo(0)
  })
  test('the orbit narrows beside a corner and stays clear of the wall behind the work', () => {
    const cornered = portalFrame(work, {
      ...surroundings,
      sides: [1.6, 6],
    })
    expect(cornered.orbit.along).toBeLessThan(frame.orbit.along)
    expect(cornered.orbit.along + satelliteSize / 2).toBeLessThan(1.6)
    const cramped = portalFrame(work, {
      ...surroundings,
      room: 2.2,
    })
    for (const each of [frame, cramped]) {
      const point = orbitPoint(each, -Math.PI / 2, 1, new Vector3)
      expect(wallSide(point)).toBeGreaterThan(satelliteSize / 2)
    }
  })
})
describe('timeline', () => {
  test('the minimum lasts until the images took their turns after the intro and the lull', () => {
    const {image, intro, lull, minimum} = fusionTiming
    expect(lull).toBeGreaterThan(0)
    expect(minimum).toBe(intro + lull + minimumTurns * image)
    expect(nextTurn(minimum)).toBe(minimum)
    expect(imageAt(minimum - image / 2, 2)).toMatchObject({
      turn: introTurns + minimumTurns - 1,
      clarity: 1,
    })
  })
  test('after the lull, the images surface one after another, over and over', () => {
    const {image, intro} = fusionTiming
    const first = firstTurn()
    expect(imageAt(intro - 0.1, 2)).toBeUndefined()
    expect(imageAt(intro + 0.1, 2)).toBeUndefined()
    expect(imageAt(first - 0.001, 2)).toBeUndefined()
    expect(imageAt(first + image / 2, 2)).toEqual({
      index: 0,
      turn: introTurns,
      clarity: 1,
    })
    expect(imageAt(first + image * 1.5, 2)).toMatchObject({
      index: 1,
      turn: introTurns + 1,
      clarity: 1,
    })
    expect(imageAt(first + 0.001, 2)!.clarity).toBeLessThan(0.05)
  })
  test('the ring of fire’s shockwave rings through the lull, and every image after it gets one of its own', () => {
    const {image, intro} = fusionTiming
    const first = firstTurn()
    const lulling = portalEnvelope(first - 0.1, undefined, undefined, fusionTiming, pair)
    expect(lulling.image).toBeUndefined()
    expect(lulling.pulse).toBeCloseTo(first - 0.1 - intro, 9)
    expect(lulling.pulseStrength).toBe(2)
    const surfacing = portalEnvelope(first + 0.1, undefined, undefined, fusionTiming, pair)
    expect(surfacing.pulse).toBeCloseTo(0.1, 9)
    expect(surfacing.pulseStrength).toBeLessThan(1)
    expect(portalEnvelope(first + image + 0.2, undefined, undefined, fusionTiming, pair).pulse).toBeCloseTo(0.2, 9)
    // Without a lull, the landing’s shockwave stands in for the first image’s.
    const hasty = {
      ...fusionTiming,
      lull: 0,
    }
    expect(portalEnvelope(intro + 0.1, undefined, undefined, hasty, pair).pulseStrength).toBe(2)
    expect(portalEnvelope(intro + image + 0.1, undefined, undefined, hasty, pair).pulseStrength).toBeLessThan(1)
  })
  test('the portal brews after its intro, closes after the result is out and dies down when it fizzles', () => {
    // It swells while an image shows.
    expect(portalEnvelope(firstTurn() + fusionTiming.image / 2, undefined, undefined, fusionTiming, pair).size).toBeGreaterThan(1.1)
    const success = {
      kind: 'success' as const,
      at: 5,
    }
    const climax = portalEnvelope(5 + fusionTiming.climax / 2, success, undefined, fusionTiming, pair)
    expect(climax.image).toMatchObject({result: true})
    const emergedAt = 5 + fusionTiming.climax
    expect(portalEnvelope(emergedAt, success, emergedAt, fusionTiming, pair).flash).toBeGreaterThan(0.8)
    expect(portalEnvelope(emergedAt + fusionTiming.afterglow, success, emergedAt, fusionTiming, pair).size).toBe(0)
    const failure = {
      kind: 'failure' as const,
      at: 4,
    }
    const fizzled = portalEnvelope(4 + fusionTiming.fizzle, failure, undefined, fusionTiming, pair)
    expect(fizzled.size).toBe(0)
    expect(fizzled.embers).toBe(1)
  })
  test('the portal’s light goes out smoothly by the time the portal closes, after its afterglow or its fizzle', () => {
    const {afterglow, climax, fizzle} = fusionTiming
    const success = {
      kind: 'success' as const,
      at: 5,
    }
    const emergedAt = 5 + climax
    const failure = {
      kind: 'failure' as const,
      at: 4,
    }
    const runs = [
      [emergedAt, emergedAt + afterglow, (elapsed: number) => portalEnvelope(elapsed, success, emergedAt, fusionTiming, pair).light],
      [failure.at, failure.at + fizzle, (elapsed: number) => portalEnvelope(elapsed, failure, undefined, fusionTiming, pair).light],
      // broken off, which recoils with a blaze of its own
      [failure.at, failure.at + fizzle, (elapsed: number) => portalEnvelope(elapsed, failure, undefined, fusionTiming, pair, failure.at - 0.4).light],
    ] as const
    for (const [from, end, light] of runs) {
      expect(light(from + 0.05)).toBeGreaterThan(10)
      // The last frame before the portal closes is as good as dark already.
      expect(light(end - 1 / 60)).toBeLessThan(0.05)
      expect(light(end)).toBe(0)
      expect(light(end + 1)).toBe(0)
    }
    // The afterglow, which doesn’t flicker like the fizzle, dims frame by frame at 60 frames per second without a step.
    const [[from, end, light]] = runs
    let previous = light(from)
    for (let elapsed = from + 1 / 60; elapsed <= end; elapsed += 1 / 60) {
      const current = light(elapsed)
      expect(current).toBeLessThanOrEqual(previous)
      expect(previous - current).toBeLessThan(Math.max(1, previous * 0.15))
      previous = current
    }
    // Until the outcome is in, it shines as it always did.
    const brewed = brewing(10, fusionTiming, 2)
    expect(portalEnvelope(10, undefined, undefined, fusionTiming, pair).light).toBe(brewed.light)
  })
})
describe('rhythm', () => {
  test('every peak of the ceremony falls on the pulse: the burst, the ignition, the landing, every turn and the result flipping out', () => {
    const {climax, image, intro, lull, minimum} = fusionTiming
    expect(introSeconds(pulse, fusionTiming)).toBe(fusionPulse)
    expect(introSeconds(implosion, fusionTiming)).toBe(1.5)
    expect(introSeconds(ignition, fusionTiming)).toBe(3)
    expect(intro).toBe(4.5)
    expect(firstTurn()).toBe(6)
    expect([image, lull, climax]).toEqual([fusionPulse, fusionPulse, fusionPulse])
    expect(minimum).toBe(12)
    expect(minimum + climax).toBe(13.5)
  })
  test('for each number of ingredients, the ember’s beats divide the pulse between the burst and the ignition evenly', () => {
    for (const ingredients of [2, 3, 4]) {
      const {beats, dub, turns} = emberRhythm(ingredients)
      expect(beats).toHaveLength(ingredients + 1)
      expect(beats.at(-1)).toBe(ignition)
      const moments = [implosion, ...beats]
      for (const [index, beat] of beats.entries()) {
        expect(beat - moments[index]).toBeCloseTo(pulse / (ingredients + 1), 9)
      }
      // The second thump of a beat comes before the next beat.
      expect(dub).toBeLessThan(pulse / (ingredients + 1))
      expect(turns).toHaveLength(ingredients)
    }
    expect(emberRhythm(2).beats).toEqual([2, 2.5, 3])
    expect(emberRhythm(3).beats).toEqual([1.875, 2.25, 2.625, 3])
  })
  test('the intro shows the image of each ingredient once, on its beat', () => {
    for (const ingredients of [2, 3, 4]) {
      const shown: Array<number> = []
      for (let elapsed = 0; elapsed < fusionTiming.intro; elapsed += 0.005) {
        const {image} = portalEnvelope(elapsed, undefined, undefined, fusionTiming, {
          images: ingredients,
          ingredients,
        })
        if (!(image && 'index' in image && image.clarity > 0.9 && shown.at(-1) !== image.index)) {
          continue
        }
        expect(image.turn).toBe(image.index)
        shown.push(image.index)
      }
      expect(shown).toEqual(Array.from({length: ingredients}, (_, index) => index))
    }
    // The turns after the lull count on from every turn the intro can show.
    expect(introTurns).toBe(4)
  })
})
describe('orbit', () => {
  const facing = new Quaternion
  const start = {
    position: new Vector3(...work.position),
    quaternion: facing.setFromAxisAngle(new Vector3(0, 1, 0), work.rotation),
  }
  const satellite: SatelliteOrbit = {
    beat: emberRhythm(2).beats[0],
    index: 0,
    phase: -2.3,
    scale: 0.5,
    start,
    home: start,
  }
  test('after the intro, a work circles clear of the wall and the floor', () => {
    for (let elapsed = fusionTiming.intro; elapsed < 12; elapsed += 0.05) {
      const {position, scale} = satellitePose(frame, fusionTiming, satellite, elapsed, undefined, pose())
      expect(scale).toBe(0.5)
      expect(wallSide(position)).toBeGreaterThan(satelliteSize / 2)
      expect(position.y - satelliteSize / 2).toBeGreaterThan(0.4)
    }
  })
  test('on success, it spirals into the portal’s middle and vanishes', () => {
    const outcome = {
      kind: 'success' as const,
      at: 6,
    }
    const end = satellitePose(frame, fusionTiming, satellite, outcome.at + fusionTiming.climax, outcome, pose())
    expect(end.scale).toBe(0)
    expect(end.position.distanceTo(new Vector3(...frame.center))).toBeLessThan(1e-9)
  })
  test('on failure, the work flies back to its wall at full size', () => {
    const outcome = {
      kind: 'failure' as const,
      at: 6,
    }
    const end = satellitePose(frame, fusionTiming, satellite, outcome.at + fusionTiming.fizzle, outcome, pose())
    expect(end.scale).toBe(1)
    expect(end.position.distanceTo(start.position)).toBeLessThan(1e-9)
    expect(end.quaternion.angleTo(start.quaternion)).toBeLessThan(1e-6)
  })
})
describe('intro', () => {
  const facing = new Quaternion
  facing.setFromAxisAngle(new Vector3(0, 1, 0), work.rotation)
  const satellites: Array<SatelliteOrbit> = [{
    beat: emberRhythm(2).beats[0],
    index: 0,
    phase: -Math.PI / 2 - 0.7,
    scale: 0.5,
    start: {
      position: new Vector3(...work.position),
      quaternion: facing,
    },
    home: {
      position: new Vector3(...work.position),
      quaternion: facing,
    },
  }, {
    beat: emberRhythm(2).beats[1],
    index: 1,
    phase: Math.PI / 2 - 0.7,
    scale: 0.7,
    start: {
      position: new Vector3(work.position[0] + 0.6, work.position[1] - 0.3, work.position[2] + 0.8),
      quaternion: new Quaternion,
    },
    tumble: new Vector3(0.6, 0.8, 0),
  }]
  const end = fusionTiming.intro
  const just = end - 1e-4
  test('starts from where everything was seized and hands it over to the orbit where the loop picks it up', () => {
    for (const satellite of satellites) {
      const first = satellitePose(frame, fusionTiming, satellite, 0, undefined, pose())
      expect(first.position.distanceTo(satellite.start.position)).toBeLessThan(1e-6)
      expect(first.quaternion.angleTo(satellite.start.quaternion)).toBeLessThan(1e-6)
      expect(first.scale).toBeCloseTo(1, 6)
      const before = satellitePose(frame, fusionTiming, satellite, just, undefined, pose())
      const after = satellitePose(frame, fusionTiming, satellite, end, undefined, pose())
      expect(before.position.distanceTo(after.position)).toBeLessThan(0.01)
      expect(before.quaternion.angleTo(after.quaternion)).toBeLessThan(0.01)
      expect(before.scale).toBeCloseTo(after.scale, 2)
    }
  })
  test('keeps everything above the floor, clear of the wall while it whirls and moving smoothly', () => {
    const setOff = introSeconds(ignition, fusionTiming)
    for (const satellite of satellites) {
      let last: Vector3 | undefined
      for (let elapsed = 0; elapsed < end + 0.5; elapsed += 1 / 120) {
        const {position, scale} = satellitePose(frame, fusionTiming, satellite, elapsed, undefined, pose())
        expect(Number.isFinite(position.x + position.y + position.z + scale)).toBe(true)
        expect(position.y).toBeGreaterThan(0.3)
        if (elapsed >= setOff) {
          expect(wallSide(position)).toBeGreaterThan(0.1)
        }
        // A yank may be quick and the whirl lets go at full speed, but nothing jumps faster than 34 m/s between frames.
        if (last) {
          expect(position.distanceTo(last)).toBeLessThan(0.28)
        }
        last = position.clone()
      }
    }
  })
  test('shows each image once, then settles into the brewing portal', () => {
    const shown = new Map<number, number>
    for (let elapsed = 0; elapsed < end; elapsed += 0.01) {
      const {image} = portalEnvelope(elapsed, undefined, undefined, fusionTiming, pair)
      if (!(image && 'index' in image && image.clarity > 0.9)) {
        continue
      }
      expect(image.turn).toBe(image.index)
      shown.set(image.index, (shown.get(image.index) ?? 0) + 1)
    }
    expect(shown.keys().toArray().toSorted((a, b) => a - b)).toEqual([0, 1])
    const last = portalEnvelope(just, undefined, undefined, fusionTiming, pair)
    const brewed = brewing(end, fusionTiming, 2)
    for (const key of ['size', 'energy', 'lens', 'spin'] as const) {
      expect(Math.abs(last[key] - brewed[key])).toBeLessThan(0.05)
    }
    expect(portalEnvelope(0, undefined, undefined, fusionTiming, pair).size).toBeLessThan(0.1)
  })
  test('whirls both extra laps on tethers from the last beat on, lets go of them at full speed and sets both circling freely', () => {
    expect(whirled(whirl)).toBe(0)
    expect(whirling(release)).toBeCloseTo(1, 9)
    expect(whirled(choreographed)).toBeCloseTo(laps * Math.PI * 2, 9)
    expect(whirled(choreographed + 1)).toBeCloseTo(laps * Math.PI * 2, 9)
    let angle = 0
    for (let t = whirl; t < choreographed + 0.5; t += 0.005) {
      expect(whirled(t)).toBeGreaterThanOrEqual(angle)
      angle = whirled(t)
    }
    // It whirls them slowly at first and gathers speed ever faster toward the release.
    const halfway = (whirl + release) / 2
    expect(whirling(halfway)).toBeLessThan(0.3)
    expect(whirled(halfway)).toBeLessThan(whirled(release) / 6)
    for (const index of [0, 1]) {
      expect(introTether(index, introSeconds(grab(index), fusionTiming) - 1e-3, fusionTiming)).toBeUndefined()
      expect(introTether(index, introSeconds(grab(index) + 0.1, fusionTiming), fusionTiming)?.reach).toBeCloseTo(1, 6)
      expect(introTether(index, introSeconds(release + 0.1, fusionTiming), fusionTiming)).toBeUndefined()
      expect(introTether(index, end + 3, fusionTiming)).toBeUndefined()
    }
    expect(introOrbitRate(introSeconds(release, fusionTiming), fusionTiming)).toBeGreaterThan(orbitSpeed * 4)
    expect(Math.abs(introOrbitRate(just, fusionTiming) - orbitSpeed)).toBeLessThan(0.3)
  })
  test('the ring of fire’s landing knocks everything out along the wall, from where it drifts back into its orbit', () => {
    const center = new Vector3(...frame.center)
    const normal = new Vector3(...frame.normal)
    const along = (point: Vector3) => {
      const offset = point.clone().sub(center)
      return offset.addScaledVector(normal, -offset.dot(normal)).length()
    }
    for (const satellite of satellites) {
      const knocked = satellitePose(frame, fusionTiming, satellite, end + 0.15, undefined, pose()).position
      const orbiting = orbitPoint(frame, orbitAngle(satellite.phase, end + 0.15), 1, new Vector3)
      expect(along(knocked)).toBeGreaterThan(along(orbiting) * 1.4)
      // never toward the wall or away from it
      expect(wallSide(knocked)).toBeCloseTo(wallSide(orbiting), 9)
      for (const elapsed of [end + 1.5, end + 3]) {
        expect(satellitePose(frame, fusionTiming, satellite, elapsed, undefined, pose()).position.distanceTo(orbitPoint(frame, orbitAngle(satellite.phase, elapsed), 1, new Vector3))).toBeLessThan(1e-9)
      }
    }
  })
  test('the ring of fire left behind falls into the portal and lands as the intro ends, with a blaze', () => {
    for (const index of [0, 1]) {
      expect(introTrail(index, introSeconds(whirl, fusionTiming) - 1e-3, fusionTiming)).toBeUndefined()
      let reach = 1
      for (let elapsed = introSeconds(release, fusionTiming); elapsed < end; elapsed += 0.01) {
        const blazing = introTrail(index, elapsed, fusionTiming)!
        expect(blazing.reach).toBeLessThanOrEqual(reach)
        reach = blazing.reach
      }
      expect(introTrail(index, just, fusionTiming)!.reach).toBeLessThan(0.01)
      expect(introTrail(index, end, fusionTiming)).toBeUndefined()
    }
    const landing = portalEnvelope(end, undefined, undefined, fusionTiming, pair)
    expect(landing.flash).toBeGreaterThan(1)
    expect(landing.burst).toBe(0)
    expect(landing.burstStrength).toBeGreaterThan(1)
    expect(portalEnvelope(end + 2, undefined, undefined, fusionTiming, pair).flash).toBeLessThan(0.01)
  })
})
/** an effect that goes on for 0.2 s after the result flipped out, showing nothing */
class LingeringEffect extends FusionEffect {
  override readonly afterglow = 0.2
  readonly id = 'lingering'

  show() {
    return {
      root: new Group,
      update: () => {},
      dispose: () => {},
    }
  }
}
const spec = () => ({
  work,
  partner: {
    kind: 'item' as const,
    id: 'prop',
  },
  images: ['work.jxl'],
  latches: ['charge', 'charge'] as const,
  effects: [],
})
describe('fusion', () => {
  const timing = {
    intro: 0.08,
    lull: 0.04,
    image: 0.02,
    minimum: 0.3,
    climax: 0.04,
    afterglow: 0.03,
    fizzle: 0.04,
  }
  test('a result waits for the minimum, holds its image ready and lets go of it once the portal closes', async () => {
    let released = 0
    let closed = 0
    const fusion = new Fusion(spec(), {
      frame,
      timing,
      hold: () => ({
        ready: Promise.resolve(),
        release: () => released++,
      }),
      onClose: () => closed++,
    })
    await fusion.succeed(new Blob(['result']))
    expect(fusion.elapsed()).toBeGreaterThanOrEqual(timing.minimum + timing.climax)
    fusion.emerge()
    fusion.finish()
    expect(fusion.closed).toBe(false)
    await new Promise(resolve => setTimeout(resolve, (timing.afterglow + 0.1) * 1000))
    expect(fusion.closed).toBe(true)
    expect(closed).toBe(1)
    expect(released).toBe(1)
  })
  test('an effect that goes on longer than the afterglow keeps the portal open until it is over', async () => {
    const plain = new Fusion(spec(), {
      frame,
      timing,
    })
    expect(plain.afterglow).toBe(timing.afterglow)
    plain.abort()
    const fusion = new Fusion({
      ...spec(),
      effects: [new LingeringEffect],
    }, {
      frame,
      timing,
    })
    expect(fusion.afterglow).toBe(0.2)
    await fusion.succeed(new Blob(['result']))
    fusion.emerge()
    await new Promise(resolve => setTimeout(resolve, (timing.afterglow + 0.05) * 1000))
    expect(fusion.closed).toBe(false)
    await new Promise(resolve => setTimeout(resolve, 0.2 * 1000))
    expect(fusion.closed).toBe(true)
  })
  test('aborting ends a fusion at once, and only once', async () => {
    let closed = 0
    const fusion = new Fusion(spec(), {
      frame,
      timing,
      onClose: () => closed++,
    })
    const failing = fusion.fail()
    fusion.abort()
    await failing
    fusion.finish()
    expect(fusion.closed).toBe(true)
    expect(closed).toBe(1)
    expect(fusion.elapsed()).toBeLessThan(timing.minimum)
    fusion.addImage('late.jxl')
    expect(fusion.spec.images).toEqual(['work.jxl'])
  })
  test('a failure waits for the intro, but not for the minimum', async () => {
    const fusion = new Fusion(spec(), {
      frame,
      timing,
    })
    await fusion.fail()
    expect(fusion.outcome).toEqual({
      kind: 'failure',
      at: timing.intro,
    })
    expect(fusion.closed).toBe(true)
    expect(fusion.elapsed()).toBeGreaterThanOrEqual(timing.intro + timing.fizzle)
    expect(fusion.elapsed()).toBeLessThan(timing.minimum + timing.fizzle)
  })
  test('breaking it off aborts its signal at once and fails it as the next turn of the images begins, which fail() then waits for', async () => {
    const fusion = new Fusion(spec(), {
      frame,
      timing,
    })
    const first = firstTurn(timing)
    await new Promise(resolve => setTimeout(resolve, (first + timing.image * 1.4) * 1000))
    expect(fusion.cancel()).toBe(true)
    expect(fusion.signal.aborted).toBe(true)
    expect(fusion.canceledAt).toBeGreaterThan(first + timing.image)
    expect(fusion.outcome?.kind).toBe('failure')
    expect(fusion.outcome!.at).toBeCloseTo(first + timing.image * Math.ceil((fusion.canceledAt! - first) / timing.image), 9)
    expect(fusion.outcome!.at).toBeLessThan(timing.minimum)
    expect(fusion.cancel()).toBe(false)
    await fusion.fail()
    expect(fusion.closed).toBe(true)
    expect(fusion.elapsed()).toBeGreaterThanOrEqual(fusion.outcome!.at + timing.fizzle)
  })
  test('a result that came in early can still be broken off until its climax begins, which drops it for the fizzle', async () => {
    const fusion = new Fusion(spec(), {
      frame,
      timing,
    })
    const job = fusion.succeed(new Blob(['result']))
    expect(fusion.outcome).toEqual({
      kind: 'success',
      at: timing.minimum,
    })
    expect(fusion.cancel()).toBe(true)
    expect(fusion.signal.aborted).toBe(true)
    expect(fusion.outcome?.kind).toBe('failure')
    await job
    expect(fusion.closed).toBe(true)
    expect(fusion.emergedAt).toBeUndefined()
  })
  test('once its climax has begun, it can no longer be broken off', async () => {
    const fusion = new Fusion(spec(), {
      frame,
      timing,
    })
    const job = fusion.succeed(new Blob(['result']))
    await new Promise(resolve => setTimeout(resolve, (timing.minimum + 0.01) * 1000))
    expect(fusion.cancel()).toBe(false)
    expect(fusion.signal.aborted).toBe(false)
    await job
    expect(fusion.outcome?.kind).toBe('success')
    fusion.abort()
  })
})
describe('breaking off', () => {
  test('waits for the end of the intro, not at all during the lull, then for the next turn of the images', () => {
    const {intro, image} = fusionTiming
    const first = firstTurn()
    expect(nextTurn(0.5)).toBe(intro)
    expect(nextTurn(intro)).toBe(intro)
    expect(nextTurn(intro + 0.1)).toBe(intro + 0.1)
    expect(nextTurn(first)).toBe(first)
    expect(nextTurn(first + 0.1)).toBeCloseTo(first + image, 9)
    expect(nextTurn(first + image * 2.5)).toBeCloseTo(first + image * 3, 9)
  })
  test('makes the portal recoil at once with a blaze, a shockwave and sparks, then flicker on charred until it fizzles', () => {
    const elapsed = firstTurn() + fusionTiming.image * 0.6
    const failure = {
      kind: 'failure' as const,
      at: nextTurn(elapsed),
    }
    const calm = portalEnvelope(elapsed, failure, undefined, fusionTiming, pair)
    const recoil = portalEnvelope(elapsed, failure, undefined, fusionTiming, pair, elapsed)
    expect(recoil.flash).toBeGreaterThan(1)
    expect(recoil.pulse).toBe(0)
    expect(recoil.pulseStrength).toBeGreaterThan(1.5)
    expect(recoil.burst).toBe(0)
    expect(recoil.embers).toBeGreaterThan(0.5)
    expect(recoil.light).toBeGreaterThan(calm.light + 50)
    const charred = portalEnvelope(elapsed + 0.55, failure, undefined, fusionTiming, pair, elapsed)
    expect(elapsed + 0.55).toBeLessThan(failure.at)
    expect(charred.flash).toBeLessThan(0.01)
    expect(charred.embers).toBeCloseTo(0.3, 1)
    // Before it was broken off, nothing changes.
    expect(portalEnvelope(elapsed - 0.1, failure, undefined, fusionTiming, pair, elapsed)).toEqual(portalEnvelope(elapsed - 0.1, failure, undefined, fusionTiming, pair))
    expect(portalEnvelope(failure.at + fusionTiming.fizzle, failure, undefined, fusionTiming, pair, elapsed).size).toBe(0)
  })
  test('a body reaches into the portal when its capsule comes within the disc', () => {
    const [x, y, z] = frame.center
    const body = (center: [number, number, number], height = 1.7) => touchesPortal(frame, {
      center,
      height,
      radius: 0.3,
    })
    // Standing right under a portal at its highest, the head just reaches it; jumping, the body does from the side too.
    expect(frame.center[1]).toBe(2.05)
    expect(body([x, 0.85, z])).toBe(true)
    expect(body([x, y - 1, z])).toBe(true)
    expect(body([x + 0.7, y, z])).toBe(true)
    expect(body([x + 0.75, y, z])).toBe(false)
    expect(body([x, y - 1.6, z])).toBe(false)
    expect(body([x, y - 1, z + 1])).toBe(false)
  })
  test('throws the body back the way it jumped in, as fast as it came within bounds, with a hop', () => {
    const [x, y, z] = frame.center
    const rebound = (center: [number, number, number], velocity: [number, number, number]) => portalRebound(frame, {
      center,
      velocity,
    })
    // A walking jump straight at it from the room comes back faster than it went in.
    const walked = rebound([x + 0.6, y - 0.4, z], [-3, 2, 0])
    expect(walked[0]).toBeCloseTo(5)
    expect(walked[1]).toBe(3)
    expect(walked[2]).toBeCloseTo(0)
    // A sprinting jump that grazes it diagonally goes back nearly the way it came, at no more than 8 m/s.
    const sprinted = rebound([x + 0.3, y - 0.5, z - 0.5], [-6.4, 1, 6.4])
    expect(Math.hypot(sprinted[0], sprinted[2])).toBeCloseTo(8)
    expect((sprinted[0] - sprinted[2]) * Math.SQRT1_2 / 8).toBeGreaterThan(Math.cos(Math.PI / 18))
    // Rising straight into it, the body is thrown out away from its middle, or into the room right under it.
    const beside = rebound([x, y - 1, z + 0.3], [0, 5.4, 0])
    expect(beside[0]).toBeCloseTo(0)
    expect(beside[2]).toBeCloseTo(5)
    const under = rebound([x, y - 1, z], [0, 5.4, 0])
    expect(under[0]).toBeCloseTo(frame.normal[0] * 5)
    expect(under[2]).toBeCloseTo(frame.normal[2] * 5)
  })
})
