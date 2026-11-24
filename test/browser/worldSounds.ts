import type {Mood} from '../../src/moods/index.ts'
import type {Voice} from 'procedural-audio'

import playVoices, {shiftVoices} from 'procedural-audio'

import arrivalVoices, {arrivalGap} from '../../src/lib/audio/arrivalVoices.ts'
import {frameImpactSounds, frameImpactVoices} from '../../src/lib/audio/frameImpacts.ts'
import hangingVoices from '../../src/lib/audio/hangingVoices.ts'
import {orbImpactVoices} from '../../src/lib/audio/orbImpacts.ts'
import placardVoices from '../../src/lib/audio/placardVoices.ts'
import {footstepVoices, impactFootstepStrength} from '../../src/lib/audio/playerSoundEffects.ts'
import tossVoices from '../../src/lib/audio/tossVoices.ts'
import TransformerChain from '../../src/lib/audio/transformers/TransformerChain.ts'
import {hangingAnimation} from '../../src/lib/gallery/hanging/index.ts'
import {toss} from '../../src/lib/physics/throwMotion.ts'
import {moods} from '../../src/moods/index.ts'
import {orbMass} from '../../src/orbs/index.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

const rate = 48_000
const effectsGain = 0.6 * 10 ** (12 / 20)
const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}
const length = (voices: ReadonlyArray<Voice>) => Math.max(...voices.map(voice => voice.duration + (voice.delay ?? 0)))
type Measure = {
  /** the loudest 50 ms window’s RMS */
  loudest: number
  peak: number
}
/** Renders `play` into a stereo buffer of `seconds` on the effects master at `SoundEngine`’s boost and measures it, requiring sound, headroom and a silent end; `play` may go on playing while it renders, until the promise it returns settles. */
async function render(name: string, seconds: number, play: (output: {
  context: OfflineAudioContext
  master: GainNode
}) => unknown): Promise<Measure> {
  const context = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate)
  const master = context.createGain()
  master.gain.value = effectsGain
  master.connect(context.destination)
  const playing = play({
    context,
    master,
  })
  const rendering = context.startRendering()
  await playing
  const buffer = await rendering
  const channels = [buffer.getChannelData(0), buffer.getChannelData(1)]
  let peak = 0
  let loudest = 0
  let tail = 0
  const window = rate * 0.05
  for (const samples of channels) {
    let power = 0
    for (const [index, sample] of samples.entries()) {
      assert(Number.isFinite(sample), `${name} rendered a nonfinite sample`)
      peak = Math.max(peak, Math.abs(sample))
      power += sample * sample
      if (index >= window) {
        power -= samples[index - window] ** 2
      }
      loudest = Math.max(loudest, Math.sqrt(Math.max(0, power) / window))
      if (index >= samples.length - window) {
        tail = Math.max(tail, Math.abs(sample))
      }
    }
  }
  assert(peak > 0.0005, `${name} rendered silence`)
  assert(peak < 0.6, `${name} exceeded headroom with ${peak}`)
  assert(tail < 0.0001, `${name} did not finish silently`)
  return {
    peak: Number(peak.toFixed(4)),
    loudest: Number(loudest.toFixed(5)),
  }
}
const recipe = (name: string, voices: ReadonlyArray<Voice>) => render(name, length(voices) + 0.15, output => playVoices(output, voices, {seed: name}))

/** Renders every strike, arrival, placard roll and room of the world, through the transformers of its rooms’ moods, into silent offline buffers: no audible output, DOM, input, focus or viewport changes. */
export default async function verify() {
  const strikes: Record<string, Measure> = {}
  for (const surface of ['generic', 'stone', 'hollow', 'fabric', 'glass', 'orb'] as const) {
    let previous = 0
    for (const speed of [0.3, 4, 12]) {
      const measure = await recipe(`orb on ${surface} at ${speed} m/s`, orbImpactVoices(surface, speed))
      assert(measure.loudest > previous, `An orb on ${surface} must strike louder at ${speed} m/s`)
      previous = measure.loudest
      strikes[`orb:${surface}:${speed}`] = measure
    }
  }
  for (const sound of Object.keys(frameImpactSounds) as Array<keyof typeof frameImpactSounds>) {
    for (const contact of ['corner', 'edge', 'flat'] as const) {
      const soft = await recipe(`${sound} ${contact} at 1 m/s`, frameImpactVoices(contact, 1, sound))
      const hard = await recipe(`${sound} ${contact} at 14 m/s`, frameImpactVoices(contact, 14, sound))
      assert(soft.loudest < hard.loudest, `A ${sound} frame must strike louder on its ${contact} at 14 m/s`)
      strikes[`frame:${sound}:${contact}`] = hard
    }
  }
  // Heard from where it happened: farther away, quieter.
  const near = await render('a strike 1 m away', 0.6, output => playVoices(output, orbImpactVoices('generic', 6), {
    seed: 'near',
    position: [0, 0, -1],
    hearing: {
      near: 2,
      far: 26,
    },
  }))
  const far = await render('a strike 18 m away', 0.6, output => playVoices(output, orbImpactVoices('generic', 6), {
    seed: 'far',
    position: [0, 0, -18],
    hearing: {
      near: 2,
      far: 26,
    },
  }))
  assert(far.loudest < near.loudest * 0.6, 'A strike far away must sound quieter')
  const arrivals = {
    hung: await recipe('a work hung on arrival', arrivalVoices(true)),
    slapped: await recipe('a work slapped onto its wall on arrival', [...arrivalVoices(true, 0, hangingAnimation.impact), ...hangingVoices({
      impact: hangingAnimation.impact,
      mass: 1,
      sound: 'gilt',
      variation: 0,
    })]),
    dropped: await recipe('a work dropped into the room', arrivalVoices(false)),
    three: await recipe('three works dropped together', [0, 1, 2].flatMap(index => shiftVoices(arrivalVoices(false, index - 1), index * arrivalGap))),
  }
  const placards = {
    narrow: await recipe('a narrow placard rolling to its new text', placardVoices({
      variation: -1,
      width: 0.4,
    })),
    wide: await recipe('a wide placard rolling to its new text', placardVoices({
      variation: 1,
      width: 1.65,
    })),
  }
  // throws and drops of a leaf, an orb and a pumpkin, standing, sprinting and in a jump shot
  const tosses: Record<string, Measure> = {}
  for (const [thing, mass] of [['a leaf', 0.008], ['an orb', orbMass], ['a pumpkin', 4.5]] as const) {
    for (const [motion, carrier] of [['standing', [0, 0, 0]], ['sprinting', [0, 0, -9]], ['jumping', [0, 5.4, 0]]] as const) {
      for (const throwing of [false, true]) {
        const name = `${throwing ? 'throwing' : 'dropping'} ${thing} ${motion}`
        tosses[name] = await recipe(name, tossVoices(toss({
          carrier: [...carrier],
          direction: [0, 0, -1],
          mass,
          throwing,
        })))
      }
    }
  }
  assert(tosses['throwing an orb sprinting'].loudest > tosses['throwing an orb standing'].loudest, 'A throw on the run must sound stronger than one standing')
  assert(tosses['dropping an orb sprinting'].loudest > tosses['dropping an orb standing'].loudest, 'A drop on the run must swish')
  const rooms: Record<string, Measure & {dry: number}> = {}
  for (const placed of slopGallery.rooms) {
    const landing = footstepVoices(placed.groundSurface(placed.toWorld([0, 0, 0])), 3, {strength: impactFootstepStrength(9)})
    const play = (acoustic: boolean) => (output: {
      context: OfflineAudioContext
      master: GainNode
    }) => {
      const world = output.context.createGain()
      const transformers = new TransformerChain(output.context, world, output.master)
      const mood: Mood | undefined = placed.mood && moods[placed.mood]
      if (acoustic && mood?.transformer) {
        transformers.transform(mood, mood.transformer, 1)
      }
      // once the room’s mood has taken over
      return output.context.suspend(0.5).then(() => {
        playVoices({
          context: output.context,
          master: world,
        }, landing, {seed: 'landing'})
        return output.context.resume()
      })
    }
    const dry = await render(`a landing outside of every room, for ${placed.id}`, 5.2, play(false))
    const wet = await render(`a landing in the ${placed.id}`, 5.2, play(true))
    assert(wet.peak < dry.peak * 2, `The ${placed.id} must not ring louder than twice the dry sound`)
    rooms[placed.id] = {
      ...wet,
      dry: dry.loudest,
    }
  }
  return {
    strikes,
    distance: {
      near,
      far,
    },
    arrivals,
    placards,
    tosses,
    rooms,
  }
}
