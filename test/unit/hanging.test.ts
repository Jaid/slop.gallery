import type {HangingPose, HangingStage} from '../../src/lib/gallery/hanging/index.ts'
import type WallDust from '../../src/lib/gallery/hanging/WallDust.ts'

import {describe, expect, test} from 'bun:test'

import {mulberry32} from 'math/random'
import {Group, Quaternion, Vector3} from 'three/webgpu'

import {frameBack} from '../../src/frames/base/PortraitFrame.ts'
import {frameImpactSounds} from '../../src/lib/audio/frameImpacts.ts'
import hangingVoices from '../../src/lib/audio/hangingVoices.ts'
import HangingRun from '../../src/lib/gallery/hanging/HangingRun.ts'
import {requestHanging, requestJolt, takeHanging} from '../../src/lib/gallery/hanging/hangings.ts'
import {hangingAnimation as animation} from '../../src/lib/gallery/hanging/index.ts'
import JoltAnimation from '../../src/lib/gallery/hanging/JoltAnimation.ts'
import {hangingNeighbors, neighborReach} from '../../src/lib/gallery/hanging/neighbors.ts'

const front = 0.06
const sizes = [[0.5, 0.5], [0.9, 1.4], [1.7, 0.95]] as const
const froms = [[0, 0, 1], [0.9, 0.2, 0.8], [-0.9, -0.3, 1.2], [0.2, 0.8, 0.35], [-0.4, -1, 1.7], [1.4, 0, 0.3]] as const
const stage = (width: number, height: number, from: Readonly<[number, number, number]>, seed = 7): HangingStage => {
  const random = mulberry32.create(seed)
  return {
    back: frameBack,
    from: new Vector3(...from),
    front,
    halfHeight: height / 2 + 0.08,
    halfWidth: width / 2 + 0.08,
    random: () => mulberry32.sample(random),
    side: from[0] < 0 ? -1 : 1,
  }
}
const restingPose = (): HangingPose => ({
  position: new Vector3,
  quaternion: new Quaternion,
  scale: new Vector3(1, 1, 1),
})
const poseAt = (time: number, on: HangingStage, of: JoltAnimation | typeof animation = animation) => {
  const pose = restingPose()
  of.pose(time, on, pose)
  return pose
}
/** the corners of the frame’s box, posed */
const corners = (pose: HangingPose, {halfWidth, halfHeight, back}: HangingStage) => {
  const points: Array<Vector3> = []
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      for (const z of [back, front]) {
        const point = new Vector3(x, y, z)
        points.push(point.multiply(pose.scale).applyQuaternion(pose.quaternion).add(pose.position))
      }
    }
  }
  return points
}
const bottom = new Vector3
/** how far the posed frame’s bottom edge moves from where it hangs at most, over `from` to `to` seconds in, and the first moment it swings back through hanging straight after it first swung out */
const swing = (on: HangingStage, of: JoltAnimation | typeof animation, from: number, to: number) => {
  let farthest = 0
  let turn = Infinity
  let sign = 0
  for (let time = from; time <= to; time += 1 / 1000) {
    const roll = bottom.set(0, -on.halfHeight, 0).applyQuaternion(poseAt(time, on, of).quaternion).x
    farthest = Math.max(farthest, Math.abs(roll))
    if (sign === 0 && Math.abs(roll) > 1e-4) {
      sign = Math.sign(roll)
    } else if (sign !== 0 && turn === Infinity && Math.sign(roll) === -sign) {
      turn = time
    }
  }
  return {
    farthest,
    turn,
  }
}
const rest = new Quaternion
/** a work hanging `along` meters to the right of the middle of a wall facing +z */
const hung = (id: string, along: number, extra: Partial<{
  height: number
  hung: boolean
  out: number
  rotation: number
  up: number
  width: number
}> = {}) => ({
  height: extra.height ?? 1,
  hung: extra.hung ?? true,
  id,
  position: [along, 1.6 + (extra.up ?? 0), extra.out ?? 0] as [number, number, number],
  rotation: extra.rotation ?? 0,
  width: extra.width ?? 1,
})
const slapVoices = (mass: number) => hangingVoices({
  impact: animation.impact,
  mass,
  sound: 'gilt',
  variation: 0,
})
const request = () => ({
  animation,
  from: [3, 1.5, -0.5] as [number, number, number],
  position: [1, 1.6, 0.2] as [number, number, number],
  rotation: Math.PI / 2,
  seed: 3,
})
const work = {
  floor: 0,
  front,
  height: 1.2,
  reach: 0.08,
  width: 0.9,
}
/** where a work hanging at 1.6 m on a wall facing +z flies in from, in its own frame, thrown from `from` */
const flownFrom = (from: [number, number, number]) => {
  const run = new HangingRun({
    ...request(),
    from,
    position: [0, 1.6, 0],
    rotation: 0,
  }, work)
  return run.stage.from
}
const fakeDust = () => {
  const emitted: Array<Parameters<WallDust['emit']>[0]> = []
  return {
    dust: {
      now: 50,
      emit: (particles: Parameters<WallDust['emit']>[0]) => emitted.push([...particles]),
    } as unknown as WallDust,
    emitted,
  }
}
describe('the hanging animation', () => {
  test('strikes the wall before it ends', () => {
    expect(animation.impact).toBeGreaterThan(0)
    expect(animation.impact).toBeLessThan(animation.duration)
    expect(animation.duration).toBeLessThan(2)
  })
  test('starts in the player’s hands, ends exactly where the work hangs and never reaches into the wall', () => {
    for (const [width, height] of sizes) {
      for (const from of froms) {
        const on = stage(width, height, from)
        expect(poseAt(0, on).position.distanceTo(on.from)).toBeLessThan(1e-6)
        const end = poseAt(animation.duration, on)
        expect(end.position.length()).toBeLessThan(2e-3)
        expect(end.quaternion.angleTo(rest)).toBeLessThan(2e-3)
        expect(end.scale.distanceTo(new Vector3(1, 1, 1))).toBeLessThan(2e-3)
        for (let time = 0; time <= animation.duration; time += 1 / 240) {
          const pose = poseAt(time, on)
          for (const corner of corners(pose, on)) {
            if (corner.z < frameBack - 4e-3) {
              throw new Error(`It reaches ${((frameBack - corner.z) * 1000).toFixed(1)} mm into the wall ${time.toFixed(3)} s in, from ${from.join(', ')} for ${width} × ${height}`)
            }
          }
          expect(pose.scale.z).toBeGreaterThan(0.25)
        }
      }
    }
  })
  test('moves without jumps', () => {
    for (const from of froms) {
      const on = stage(0.9, 1.2, from)
      let previous = corners(poseAt(0, on), on)
      for (let time = 1 / 240; time <= animation.duration; time += 1 / 240) {
        const current = corners(poseAt(time, on), on)
        const step = Math.max(...current.map((corner, i) => corner.distanceTo(previous[i])))
        // 60 m/s at most for any corner
        if (step > 0.25) {
          throw new Error(`It jumps ${step.toFixed(3)} m ${time.toFixed(3)} s in, from ${from.join(', ')}`)
        }
        previous = current
      }
    }
  })
  test('knocks dust off in front of the wall once it strikes it', () => {
    for (const from of froms) {
      const dust = animation.dust(stage(0.9, 1.2, from))
      expect(dust.length).toBeGreaterThan(20)
      for (const particle of dust) {
        expect([...particle.origin, ...particle.velocity, particle.delay, particle.life, particle.size, particle.drag, particle.gravity].every(Number.isFinite)).toBe(true)
        expect(particle.origin[2]).toBeGreaterThanOrEqual(frameBack)
        expect(particle.velocity[2]).toBeGreaterThanOrEqual(0)
        expect(particle.delay).toBeGreaterThanOrEqual(animation.impact)
        expect(particle.delay).toBeLessThan(animation.duration)
        expect(particle.life).toBeGreaterThan(0)
        expect(particle.size).toBeGreaterThan(0)
        expect(particle.spread).toBeGreaterThanOrEqual(particle.size)
        expect(particle.opacity).toBeGreaterThan(0)
        expect(particle.opacity).toBeLessThanOrEqual(1)
        expect(particle.drag).toBeGreaterThan(0)
      }
    }
  })
})
describe('the slap', () => {
  test('draws the work back toward the player before it flies', () => {
    const on = stage(0.9, 1.2, [0.4, -0.2, 1.2])
    const drawn = Math.max(...Array.from({length: 20}, (_, index) => poseAt(index * animation.impact / 20, on).position.length()))
    expect(drawn).toBeGreaterThan(on.from.length() * 1.05)
  })
  test('holds the work squashed flat against the wall for a moment before it springs back', () => {
    const on = stage(0.9, 1.2, [0, 0, 1])
    const squashed = poseAt(animation.impact + 0.001, on).scale.z
    expect(squashed).toBeLessThan(0.7)
    expect(poseAt(animation.impact + 0.04, on).scale.z).toBeCloseTo(squashed, 6)
    expect(poseAt(animation.impact + 0.04, on).quaternion.angleTo(rest)).toBeLessThan(1e-6)
    expect(poseAt(animation.impact + 0.08, on).scale.z).toBeGreaterThan(squashed + 0.05)
  })
  test('rocks big works less and slower than small ones', () => {
    const small = swing(stage(0.4, 0.5, [0.6, 0, 1]), animation, animation.impact, animation.duration)
    const big = swing(stage(1.8, 1.6, [0.6, 0, 1]), animation, animation.impact, animation.duration)
    expect(big.turn).toBeGreaterThan(small.turn)
    expect(big.farthest / 1.8).toBeLessThan(small.farthest / 0.5)
  })
})
describe('hanging runs', () => {
  test('come from the player’s side in the work’s own frame', () => {
    // The work faces +x, so its right is −z, where the player stands.
    const run = new HangingRun(request(), work)
    expect(run.stage.side).toBe(1)
    expect(run.stage.from.z).toBeGreaterThan(0)
  })
  test('fly in along the line of sight from the player’s hands, from no farther than a throw away and never out of the wall', () => {
    const far = flownFrom([-6, 1.4, 1.2])
    expect(far.angleTo(new Vector3(-6, -0.2, 1.2))).toBeLessThan(1e-6)
    expect(far.length()).toBeCloseTo(1.8, 6)
    const near = flownFrom([0.4, 1.3, 1.1])
    expect(near.distanceTo(new Vector3(0.4, -0.3, 1.1))).toBeLessThan(1e-6)
    const grazing = flownFrom([-6, 1.6, 0.05])
    expect(grazing.z).toBeCloseTo(0.3, 6)
    expect(grazing.x).toBeCloseTo(-1.8, 3)
  })
  test('pose the frame, send the dust flying at its impact and settle at their end', () => {
    const run = new HangingRun(request(), work)
    const art = new Group
    const placard = new Group
    const {dust, emitted} = fakeDust()
    expect(run.update(0.05, art, placard, dust)).toBe(true)
    expect(art.position.length()).toBeGreaterThan(0.1)
    expect(emitted).toHaveLength(0)
    expect(run.update(animation.impact - 0.05 + 0.02, art, placard, dust)).toBe(true)
    expect(emitted).toHaveLength(1)
    const [particles] = emitted
    const particle = [...particles][0]
    // born when it came loose, 0.03 s ago at most, in front of the wall, which faces +x here
    expect(particle.birth).toBeGreaterThan(49.95)
    expect(particle.birth).toBeLessThanOrEqual(50)
    expect(particle.origin[0]).toBeGreaterThan(1 + frameBack - 1e-6)
    expect(particle.velocity[0]).toBeGreaterThanOrEqual(0)
    expect(particle.floor).toBe(0)
    expect(placard.rotation.z).not.toBe(0)
    while (run.update(0.05, art, placard, dust)) {
      // runs on until it ends
    }
    expect(art.position.toArray()).toEqual([0, 0, 0])
    expect(art.quaternion.toArray()).toEqual([0, 0, 0, 1])
    expect(art.scale.toArray()).toEqual([1, 1, 1])
    expect(placard.position.toArray()).toEqual([0, 0, 0])
    expect(placard.rotation.z).toBe(0)
  })
  test('settle their work when it is taken off the wall midway', () => {
    const run = new HangingRun(request(), work)
    const art = new Group
    const placard = new Group
    run.update(animation.impact + 0.03, art, placard, null)
    expect(art.scale.z).not.toBe(1)
    run.settle(art, placard)
    expect(art.position.toArray()).toEqual([0, 0, 0])
    expect(art.scale.toArray()).toEqual([1, 1, 1])
    expect(placard.rotation.z).toBe(0)
  })
  test('wait until their work hangs where they asked for', () => {
    requestHanging('work', [1, 2, 3], 0.5, [1, 2, 5])
    expect(takeHanging('work', [0, 2, 3], 0.5)).toBeUndefined()
    expect(takeHanging('work', [1, 2, 3], 0.4)).toBeUndefined()
    const taken = takeHanging('work', [1, 2, 3], 0.5)
    expect(taken?.from).toEqual([1, 2, 5])
    expect(takeHanging('work', [1, 2, 3], 0.5)).toBeUndefined()
  })
})
describe('the hanging sound', () => {
  test('strikes as the work strikes its wall, in the sound of its frame, a little apart each time', () => {
    const sounds = Object.keys(frameImpactSounds) as Array<keyof typeof frameImpactSounds>
    const recipes = sounds.map(sound => hangingVoices({
      impact: animation.impact,
      mass: 1,
      sound,
      variation: 0,
    }))
    const distinct = new Set(recipes.map(voices => JSON.stringify(voices)))
    expect(distinct.size).toBe(sounds.length)
    for (const voices of recipes) {
      for (const voice of voices) {
        expect(voice.duration).toBeGreaterThan(0)
        expect(voice.delay ?? 0).toBeGreaterThanOrEqual(0)
        expect(voice.volume).toBeGreaterThan(0)
      }
      // Only the swing of the arm sounds before the strike, and it swells into it.
      const early = voices.filter(voice => (voice.delay ?? 0) < animation.impact - 1e-9)
      expect(early).toHaveLength(1)
      expect((early[0].delay ?? 0) + early[0].duration).toBeCloseTo(animation.impact)
      expect(voices.some(voice => Math.abs((voice.delay ?? 0) - animation.impact) < 1e-9 && voice.volume >= 0.05)).toBe(true)
    }
    const options = {
      impact: animation.impact,
      mass: 1,
      sound: 'gilt',
    } as const
    expect(hangingVoices({
      ...options,
      variation: -0.5,
    })).not.toEqual(hangingVoices({
      ...options,
      variation: 0.5,
    }))
  })
  test('booms the wall deeper and longer under a heavier work', () => {
    const light = slapVoices(0.4)
    const heavy = slapVoices(2.5)
    const changed = light.flatMap((voice, index) => (JSON.stringify(voice) === JSON.stringify(heavy[index]) ? [] : [[voice, heavy[index]] as const]))
    const booms = changed.filter(([voice]) => voice.kind === 'oscillator')
    expect(booms).toHaveLength(1)
    for (const [lighter, heavier] of changed) {
      expect(heavier.duration).toBeGreaterThan(lighter.duration)
      expect(heavier.volume).toBeGreaterThan(lighter.volume)
    }
    const [[lighter, heavier]] = booms
    expect(lighter.kind === 'oscillator' && heavier.kind === 'oscillator' && heavier.frequency < lighter.frequency).toBe(true)
  })
})
describe('jolts of neighbors', () => {
  test('rest until the blow arrives and end at rest', () => {
    const jolt = new JoltAnimation(0.2, 0.8)
    const on = stage(0.9, 1.2, [1.4, 0, 0.3])
    expect(poseAt(0.19, on, jolt).position.length()).toBe(0)
    expect(poseAt(0.27, on, jolt).quaternion.angleTo(rest)).toBeGreaterThan(1e-3)
    const end = poseAt(jolt.duration, on, jolt)
    expect(end.quaternion.angleTo(rest)).toBeLessThan(2e-3)
    expect(end.position.length()).toBeLessThan(2e-3)
  })
  test('shake a work right beside half as much as the slap, harder by their strength and less for big works', () => {
    const on = stage(0.9, 1.2, [1.4, 0, 0.3])
    const slapped = swing(on, animation, animation.impact, animation.duration).farthest
    const jolted = swing(on, new JoltAnimation(0, 1), 0, 1).farthest
    expect(jolted / slapped).toBeGreaterThan(0.4)
    expect(jolted / slapped).toBeLessThan(0.6)
    expect(swing(on, new JoltAnimation(0, 0.3), 0, 1).farthest).toBeLessThan(jolted * 0.4)
    const big = stage(1.8, 1.6, [1.4, 0, 0.3])
    expect(swing(big, new JoltAnimation(0, 1), 0, 1).farthest / 1.8).toBeLessThan(jolted / 1.2)
  })
  test('never replace an arrival still waiting for its work', () => {
    requestHanging('waiting', [1, 2, 3], 0.5, [1, 2, 5])
    requestJolt('waiting', [1, 2, 3], 0.5, [2, 2, 3], new JoltAnimation(0.1, 1))
    expect(takeHanging('waiting', [1, 2, 3], 0.5)?.animation).toBe(animation)
    requestJolt('waiting', [1, 2, 3], 0.5, [2, 2, 3], new JoltAnimation(0.1, 1))
    expect(takeHanging('waiting', [1, 2, 3], 0.5)?.animation).toBeInstanceOf(JoltAnimation)
  })
})
describe('neighbors', () => {
  const slapped = hung('a', 0)
  test('are found on the same wall only, the closest first', () => {
    const found = hangingNeighbors(slapped, [
      slapped,
      hung('b', 1.3, {out: 0.01}),
      hung('c', -4),
      hung('d', 1, {out: 0.5}),
      hung('e', 0.5, {rotation: Math.PI / 2}),
      hung('f', 0.5, {hung: false}),
      hung('g', 1 + neighborReach + 0.1),
      hung('h', 0, {up: 1.5}),
    ])
    expect(found.map(neighbor => neighbor.work.id)).toEqual(['b', 'h', 'c'])
  })
  test('feel the blow fully right beside, falling off linearly between their edges to a faint jolt at reach', () => {
    // a work of 1.2 m square, slapped onto the wall
    const square = hung('a', 0, {
      width: 1.2,
      height: 1.2,
    })
    const found = hangingNeighbors(square, [hung('beside', 1.1), hung('middle', 1.1 + neighborReach / 2), hung('far', 1.1 + neighborReach)])
    const [beside, middle, far] = found.map(({strength}) => strength)
    expect(found[0].gap).toBe(0)
    expect(beside).toBeCloseTo(1, 6)
    expect(far).toBeGreaterThan(0.05)
    expect(far).toBeLessThan(0.2)
    expect(middle).toBeCloseTo((beside + far) / 2, 6)
  })
  test('feel the blow of a heavy work harder than of a light one', () => {
    const [light, heavy] = [0.6, 1.6].map(size => hangingNeighbors(hung('a', 0, {
      width: size,
      height: size,
    }), [hung('b', 3)])[0].strength)
    expect(heavy).toBeGreaterThan(light * 1.3)
  })
})
