import type {CameraPath} from '../../scripts/lib/fusionCamera.ts'
import type {PartyClosing} from '../../scripts/lib/fusionEmphasis.ts'
import type {FusionPlan, RenderFusionOptions} from '../../scripts/renderFusion.ts'
import type {PortraitDump} from '../../src/lib/webmcp/dumpPortraits.ts'

import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import fs from 'fs-extra'

import {keyedShot, throughKeys} from '../../scripts/lib/fusionCamera.ts'
import {partyShot} from '../../scripts/lib/fusionEmphasis.ts'
import renderFusion, {findLanding, orbitDistance, partyLength, resultView, throwMotion} from '../../scripts/renderFusion.ts'
import {partyEffects} from '../../src/party_effects/index.ts'
import gallery from '../../src/worlds/gallery/index.ts'

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
const bloodEffect = partyEffects.blood
test('a party lasts until the ingredient’s effect is over, at least until the portal has closed', () => {
  expect(partyLength()).toBe(1.6)
  expect(partyLength(bloodEffect)).toBe(bloodEffect.duration)
  expect(bloodEffect.duration).toBeGreaterThan(1.6)
})
test('the camera looks down on a result lying face up from its bottom edge, so its image stands upright', () => {
  // In the middle of the Banquet, far from its walls
  const view = resultView({
    position: [14, 0.05, -4],
    quaternion: faceUp,
    width: 1.5,
    height: 1,
  }, 5.8, gallery)
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
  }, 2, gallery)
  expect(low.eye).toBeLessThanOrEqual(1.6 + 1e-9)
  expect(low.back).toBeGreaterThan(view.back)
})
test('a camera path given by hand replaces the film’s camera, the throw leaving from in front of it, as the plan of the film tells without filming it', async () => {
  const folder = await fs.mkdtemp(join(tmpdir(), 'render-fusion-'))
  try {
    const path: CameraPath = {
      end: 18,
      handheld: false,
      keys: [
        {
          time: 0,
          position: [15, 1.6, -11],
          target: [19.78, 2.6, -8.68],
          fov: 52,
          roll: 0,
        },
        {
          time: 6,
          position: [14, 2.2, -6],
          target: [18.3, 2, -8.68],
          fov: 48,
          roll: 2,
        },
      ],
    }
    const camera = join(folder, 'camera.json')
    await Bun.write(camera, JSON.stringify(path))
    // an image hung in the slot the films use, a pixel of it
    const image = join(folder, 'pixel.png')
    await Bun.write(image, Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='))
    const options: RenderFusionOptions = {
      emphasis: 'neutral',
      fps: '60',
      graphics: 'cinematic',
      ingredient: 'horror',
      'jxl-distance': '1',
      seed: '1',
      settle: '2',
      room: 'banquet',
      portrait: image,
      slot: 'banquet-east_1',
      camera,
      'plan-file': join(folder, 'plan.json'),
    }
    const result = await renderFusion(options)
    expect(result.plan).toBe(join(folder, 'plan.json'))
    const plan = await Bun.file(join(folder, 'plan.json')).json() as FusionPlan
    expect(plan.timeline.end).toBe(18)
    expect(plan.frames).toHaveLength(18 * 60 + 1)
    expect(plan.keys).toEqual(path.keys)
    const third = keyedShot(path.keys, 3)
    expect(plan.frames[180].position[0]).toBeCloseTo(third.position[0], 4)
    expect(plan.frames[180].fov).toBeCloseTo(third.fov, 3)
    // The orb strikes the work once it flew from in front of the camera.
    expect(plan.timeline.strike).toBeGreaterThan(plan.timeline.throwAt)
    expect(plan.timeline.emergence - plan.timeline.strike).toBeCloseTo(13.5, 9)
    expect(Math.hypot(...plan.flight.from.map((value, axis) => value - keyedShot(path.keys, 1).position[axis]))).toBeLessThan(0.6)
  } finally {
    await fs.remove(folder)
  }
})
test('a fusion in the Sandbox’s Cell opens the Sandbox and keeps the camera within the Cell’s walls', async () => {
  const folder = await fs.mkdtemp(join(tmpdir(), 'render-fusion-'))
  try {
    const image = join(folder, 'pixel.png')
    await Bun.write(image, Uint8Array.fromBase64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='))
    const options: RenderFusionOptions = {
      emphasis: 'party',
      fps: '60',
      graphics: 'cinematic',
      ingredient: 'horror',
      'jxl-distance': '1',
      seed: '1',
      settle: '2',
      room: 'cell',
      portrait: image,
      slot: 'cell-south_2',
      'plan-file': join(folder, 'plan.json'),
    }
    await renderFusion(options)
    const plan = await Bun.file(join(folder, 'plan.json')).json() as FusionPlan
    expect(plan.world).toBe('sandbox')
    expect(plan.room).toBe('cell')
    expect(plan.slot.id).toBe('cell-south_2')
    // The Cell is 18 × 10 m round its middle.
    for (const {position: [x, , z]} of plan.frames) {
      expect(Math.abs(x)).toBeLessThan(9)
      expect(Math.abs(z)).toBeLessThan(5)
    }
    expect(plan.timeline.strike).toBeGreaterThan(plan.timeline.throwAt)
  } finally {
    await fs.remove(folder)
  }
})
test('every emphasis ends the same camera path, which holds where it stepped aside for the result, 20 s long: party keeps the effect in view from there, until a second after it is over', async () => {
  const folder = await fs.mkdtemp(join(tmpdir(), 'render-fusion-'))
  try {
    const plans: Record<string, FusionPlan> = {}
    for (const emphasis of ['neutral', 'party']) {
      const options: RenderFusionOptions = {
        emphasis,
        fps: '60',
        graphics: 'cinematic',
        ingredient: 'horror',
        'jxl-distance': '1',
        seed: '1',
        settle: '2',
        room: 'cell',
        'plan-file': join(folder, `${emphasis}.json`),
      }
      await renderFusion(options)
      plans[emphasis] = await Bun.file(join(folder, `${emphasis}.json`)).json() as FusionPlan
    }
    const {neutral, party} = plans
    expect(neutral.timeline.end).toBe(20)
    // The Horror Orb’s blood has drained away 6.4 s after the result flipped out.
    expect(party.timeline).toEqual({
      ...neutral.timeline,
      end: Math.ceil((neutral.timeline.emergence + bloodEffect.duration + 1) * 60 - 1e-6) / 60,
    })
    expect(party.timeline.end - party.timeline.emergence - bloodEffect.duration).toBeGreaterThanOrEqual(1 - 1e-6)
    expect(party.timeline.end - party.timeline.emergence - bloodEffect.duration).toBeLessThan(1 + 1 / 60)
    expect(party.frames).toHaveLength(Math.round(party.timeline.end * 60) + 1)
    expect((party.closing as PartyClosing).lasts).toBeCloseTo(party.timeline.end - party.timeline.emergence, 9)
    // The path’s keys are the same up to its last two, which follow the film to its end, where it still holds.
    expect(party.keys.slice(0, -2)).toEqual(neutral.keys.slice(0, -2))
    expect(party.keys.at(-1)!.time).toBe(party.timeline.end)
    expect(party.keys.at(-1)!.position).toEqual(neutral.keys.at(-1)!.position)
    expect(neutral.closing).toBeUndefined()
    const {emergence} = neutral.timeline
    const held = neutral.keys.filter(key => key.time >= emergence + 1.6)
    expect(held.length).toBeGreaterThan(1)
    for (const key of held) {
      expect(key.position).toEqual(held[0].position)
      expect(key.target).toEqual(held[0].target)
    }
    // The films are the same until the result flips out; from there, party takes over.
    const flipped = Math.floor(emergence * 60)
    expect(party.frames.slice(0, flipped + 1)).toEqual(neutral.frames.slice(0, flipped + 1))
    expect(party.frames.at(-1)!.position).not.toEqual(neutral.frames.at(-1)!.position)
    expect(party.closing?.kind).toBe('party')
    expect(party.closing && partyShot(party.closing as PartyClosing, party.timeline.end, party.timeline).fov).toBe(party.frames.at(-1)!.fov)
  } finally {
    await fs.remove(folder)
  }
})
