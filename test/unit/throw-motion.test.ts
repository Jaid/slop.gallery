import type {Vec3} from '../../src/lib/gallery/types.ts'
import type {NoiseVoice, OscillatorVoice} from 'procedural-audio'

import {describe, expect, test} from 'bun:test'

import tossVoices from '../../src/lib/audio/tossVoices.ts'
import {referenceMass, throwSpeed, throwSpeedFor, toss} from '../../src/lib/physics/throwMotion.ts'
import {orbMass} from '../../src/orbs/index.ts'

const gravity = 9.81
/** how far a throw at `velocity` flies over level ground from the height it left at, in meters */
const range = ([x, y, z]: Vec3, height = 1.4) => Math.hypot(x, z) * (y + Math.sqrt(y ** 2 + 2 * gravity * height)) / gravity
const forward: Vec3 = [0, 0, -1]
const masses = [0.008, 0.025, 0.1, 0.35, 0.908, 1.25, referenceMass, 2.4, 3.2, 4.5, 5.4, 30]
describe('throw strength by mass', () => {
  test('an orb leaves at the player’s throw speed and anything much lighter or heavier flies shorter', () => {
    expect(referenceMass).toBe(orbMass)
    expect(throwSpeedFor(referenceMass)).toBeCloseTo(throwSpeed, 9)
    const ranges = masses.map(mass => range(toss({
      direction: forward,
      mass,
      throwing: true,
    }).velocity))
    const orb = ranges[masses.indexOf(referenceMass)]
    // a leaf, a pumpkin and a potted plant
    expect(ranges[0]).toBeLessThan(orb * 0.4)
    expect(ranges[masses.indexOf(4.5)]).toBeLessThan(orb * 0.7)
    expect(ranges[masses.indexOf(5.4)]).toBeLessThan(orb * 0.65)
    expect(ranges.at(-1)!).toBeLessThan(orb * 0.25)
    // Fastest somewhere among the light things, slowing down both ways from there.
    const fastest = ranges.indexOf(Math.max(...ranges))
    expect(masses[fastest]).toBeGreaterThan(0.1)
    expect(masses[fastest]).toBeLessThan(1)
    for (let index = 1; index < masses.length; index++) {
      expect(ranges[index] < ranges[index - 1]).toBe(index > fastest)
    }
    // A light thing still flies a little farther than an orb, but not by far.
    expect(Math.max(...ranges)).toBeLessThan(orb * 1.9)
  })
  test('an unknown mass throws like an orb', () => {
    for (const mass of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(throwSpeedFor(mass)).toBe(throwSpeed)
    }
  })
})
describe('throws on the move', () => {
  const still = toss({
    direction: forward,
    mass: referenceMass,
    throwing: true,
  })
  test('standing still, a throw leaves along the view with a lift of a fifth of its speed', () => {
    expect(still.velocity[0]).toBeCloseTo(0, 9)
    expect(still.velocity[1]).toBeCloseTo(2, 9)
    expect(still.velocity[2]).toBeCloseTo(-throwSpeed, 9)
    expect(still.drive).toBe(0)
    expect(still.rise).toBe(0)
  })
  test('sprinting into it drives it harder, flatter and farther than the run-up alone', () => {
    const sprint = toss({
      carrier: [0, 0, -9],
      direction: forward,
      mass: referenceMass,
      throwing: true,
    })
    expect(sprint.drive).toBe(1)
    expect(sprint.effort).toBeGreaterThan(still.effort * 1.15)
    // flatter: little lift for how fast it goes
    expect(sprint.velocity[1] / Math.hypot(sprint.velocity[0], sprint.velocity[2])).toBeLessThan(still.velocity[1] / Math.hypot(still.velocity[0], still.velocity[2]) / 3)
    expect(range(sprint.velocity)).toBeGreaterThan(range(still.velocity) + range([0, 0, -9]) * 0.5)
    // Walking drives it far less.
    const walk = toss({
      carrier: [0, 0, -3],
      direction: forward,
      mass: referenceMass,
      throwing: true,
    })
    expect(walk.drive).toBeCloseTo(1 / 3, 9)
    expect(walk.effort).toBeLessThan(sprint.effort)
    expect(walk.effort).toBeGreaterThan(still.effort)
  })
  test('running sideways or backing away doesn’t drive it, only carries it along', () => {
    for (const carrier of [[6, 0, 0], [0, 0, 4.5]] as Array<Vec3>) {
      const thrown = toss({
        carrier,
        direction: forward,
        mass: referenceMass,
        throwing: true,
      })
      expect(thrown.drive).toBe(0)
      expect(thrown.effort).toBeCloseTo(still.effort, 9)
      for (const axis of [0, 1, 2]) {
        expect(thrown.velocity[axis]).toBeCloseTo(still.velocity[axis] + carrier[axis], 9)
      }
    }
  })
  test('rising at the start of a jump turns it up into a high arc like a jump shot, softer', () => {
    const jumpSpeed = Math.sqrt(2 * gravity * 1.5)
    const shot = toss({
      carrier: [0, jumpSpeed, 0],
      direction: forward,
      mass: referenceMass,
      throwing: true,
    })
    expect(shot.rise).toBeCloseTo(1, 9)
    expect(shot.effort).toBeLessThan(still.effort)
    const elevation = (velocity: Vec3) => Math.atan2(velocity[1], Math.hypot(velocity[0], velocity[2]))
    // Turned up by 40° on top of the jump’s own rise, a lob that drops steeply: far higher, but hardly any farther than a throw from the ground, despite the jump’s height and rise.
    expect(elevation(shot.velocity) - elevation(still.velocity)).toBeGreaterThan(40 * Math.PI / 180)
    const apex = (velocity: Vec3) => velocity[1] ** 2 / (2 * gravity)
    expect(apex(shot.velocity)).toBeGreaterThan(apex(still.velocity) * 8)
    expect(Math.hypot(shot.velocity[0], shot.velocity[2])).toBeLessThan(Math.hypot(still.velocity[0], still.velocity[2]) * 0.5)
    expect(range(shot.velocity, 1.9)).toBeLessThan(range(still.velocity) * 1.6)
    // Falling only takes from it what the fall does.
    const falling = toss({
      carrier: [0, -4, 0],
      direction: forward,
      mass: referenceMass,
      throwing: true,
    })
    expect(falling.rise).toBe(0)
    expect(falling.velocity[1]).toBeCloseTo(still.velocity[1] - 4, 9)
  })
  test('a jump shot looking straight up stays straight up, never tipping over backward', () => {
    const shot = toss({
      carrier: [0, 5, 0],
      direction: [0, 1, 0],
      mass: referenceMass,
      throwing: true,
    })
    expect(shot.velocity[0]).toBe(0)
    expect(shot.velocity[2]).toBe(0)
    expect(shot.velocity[1]).toBeGreaterThan(5)
    const steep = toss({
      carrier: [0, 5, 0],
      direction: [0, 1, -0.05],
      mass: referenceMass,
      throwing: true,
    })
    expect(steep.velocity[2]).toBeLessThan(0)
  })
})
describe('drops on the move', () => {
  test('standing still, a drop just falls, without a spin', () => {
    const dropped = toss({
      direction: forward,
      mass: referenceMass,
      throwing: false,
    })
    expect(dropped.velocity).toEqual([0, 0, 0])
    expect(dropped.spin).toEqual([0, 0, 0])
    expect(dropped.effort).toBe(0)
  })
  test('on the move, a drop carries on with the player like a little throw, tumbling a little', () => {
    const carrier: Vec3 = [2, 3, -7]
    const dropped = toss({
      carrier,
      direction: forward,
      mass: referenceMass,
      throwing: false,
    })
    expect(dropped.velocity).toEqual(carrier)
    expect(Math.hypot(...dropped.spin)).toBeGreaterThan(0)
    const thrown = toss({
      carrier,
      direction: forward,
      mass: referenceMass,
      throwing: true,
    })
    expect(Math.hypot(...dropped.spin)).toBeLessThan(Math.hypot(...thrown.spin))
  })
})
type Voices = ReturnType<typeof tossVoices>
const peak = (voices: Voices) => Math.max(...voices.map(voice => voice.volume))
/** the swish of the arm and the prop through the air */
const swish = (voices: Voices) => voices.find(voice => voice.kind === 'noise' && voice.filter.type === 'bandpass' && voice.duration > 0.05) as NoiseVoice | undefined
/** the interaction tone, which always comes first */
const tone = (voices: Voices) => voices[0] as OscillatorVoice
/** the sound of throwing a thing of `mass`, moving at `carrier` */
const thrownAt = (mass: number, carrier?: Vec3) => tossVoices(toss({
  carrier,
  direction: forward,
  mass,
  throwing: true,
}))
describe('the sound of letting go', () => {
  test('a drop standing still sounds the plain drop tone and nothing else, a throw the throw tone with a swish', () => {
    const dropped = tossVoices(toss({
      direction: forward,
      mass: referenceMass,
      throwing: false,
    }))
    expect(dropped).toHaveLength(1)
    expect(tone(dropped).frequency).toBe(400)
    const thrown = tossVoices(toss({
      direction: forward,
      mass: referenceMass,
      throwing: true,
    }))
    expect(tone(thrown).frequency).toBe(130)
    expect(swish(thrown)).toBeDefined()
  })
  test('faster throws swish louder, longer and brighter; a drop on the run swishes too', () => {
    const slow = swish(tossVoices(toss({
      direction: forward,
      mass: 30,
      throwing: true,
    })))!
    const fast = swish(tossVoices(toss({
      carrier: [0, 0, -9],
      direction: forward,
      mass: 0.35,
      throwing: true,
    })))!
    expect(fast.volume).toBeGreaterThan(slow.volume * 3)
    expect(fast.duration).toBeGreaterThan(slow.duration)
    expect(fast.filter.endFrequency!).toBeGreaterThan(slow.filter.endFrequency!)
    expect(swish(tossVoices(toss({
      carrier: [0, 0, -9],
      direction: forward,
      mass: referenceMass,
      throwing: false,
    })))).toBeDefined()
  })
  test('heavy things sound lower and heave, light ones higher and flick, a jump shot’s tone rises', () => {
    const at = thrownAt
    const frequency = (voices: Voices) => tone(voices).frequency
    expect(frequency(at(4.5))).toBeLessThan(frequency(at(referenceMass)) * 0.8)
    expect(frequency(at(0.008))).toBeGreaterThan(frequency(at(referenceMass)) * 2)
    expect(at(4.5).filter(voice => voice.kind === 'oscillator')).toHaveLength(2)
    expect(at(0.008).filter(voice => voice.kind === 'noise')).toHaveLength(2)
    const shot = tone(at(referenceMass, [0, 5.4, 0]))
    expect(shot.endFrequency!).toBeGreaterThan(shot.frequency)
    const level = tone(at(referenceMass))
    expect(level.endFrequency!).toBeLessThan(level.frequency)
  })
  test('a sprint throw snaps, and every recipe stays within the interface sounds’ headroom', () => {
    const sprint = tossVoices(toss({
      carrier: [0, 0, -9],
      direction: forward,
      mass: referenceMass,
      throwing: true,
    }))
    expect(sprint.some(voice => voice.kind === 'noise' && voice.filter.type === 'highpass')).toBe(true)
    for (const mass of masses) {
      for (const carrier of [[0, 0, 0], [0, 0, -9], [0, 5.4, -9], [0, -12, 0]] as Array<Vec3>) {
        for (const throwing of [false, true]) {
          const voices = tossVoices(toss({
            carrier,
            direction: forward,
            mass,
            throwing,
          }), 1)
          expect(peak(voices)).toBeLessThan(0.09)
          for (const voice of voices) {
            expect(Number.isFinite(voice.volume) && voice.volume > 0).toBe(true)
            expect(Number.isFinite(voice.duration) && voice.duration > 0).toBe(true)
          }
        }
      }
    }
  })
})
