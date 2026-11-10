import type {Voice} from 'procedural-audio'

import playVoices from 'procedural-audio'

import {footstepVoices, impactFootstepStrength, playerSoundEffects} from '../../src/lib/audio/playerSoundEffects.ts'

const rate = 48_000
const effectsGain = 0.6 * 10 ** (12 / 20)
const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}
const output = (seconds: number) => {
  const context = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate)
  const master = context.createGain()
  master.gain.value = effectsGain
  master.connect(context.destination)
  return {
    context,
    master,
  }
}
const stats = (samples: Float32Array) => {
  let peak = 0
  let power = 0
  for (const sample of samples) {
    assert(Number.isFinite(sample), 'Nonfinite audio sample')
    peak = Math.max(peak, Math.abs(sample))
    power += sample * sample
  }
  return {
    peak,
    rms: Math.sqrt(power / samples.length),
  }
}
const render = async (voices: ReadonlyArray<Voice>, seed: string) => {
  const duration = Math.max(...voices.map(voice => voice.duration + (voice.delay ?? 0)))
  const sound = output(duration + 0.12)
  playVoices(sound, voices, {seed})
  const buffer = await sound.context.startRendering()
  const samples = buffer.getChannelData(0)
  const result = stats(samples)
  assert(result.peak > 0.0001, `${seed} rendered silence`)
  assert(result.peak < 0.6, `${seed} exceeded headroom`)
  assert(stats(samples.slice(-rate * 0.05)).peak < 0.00001, `${seed} did not finish silently`)
  return result
}

/** Renders into offline buffers only: no audible output, DOM, input, focus or viewport changes. */
export default async function verify() {
  const cues = []
  for (const effect of Object.values(playerSoundEffects)) {
    cues.push({
      id: effect.id,
      label: effect.label,
      ...await render(effect.voices, effect.id),
    })
  }
  const steps = []
  for (const surface of ['generic', 'hollow', 'glass', 'fabric', 'stone'] as const) {
    const slow = await render(footstepVoices(surface, 0.9), 'step')
    const walk = await render(footstepVoices(surface, 3), 'step')
    const sprint = await render(footstepVoices(surface, 9), 'step')
    const sneak = await render(footstepVoices(surface, 3, {crouching: true}), 'sneak')
    assert(slow.rms < walk.rms && walk.rms < sprint.rms, 'Footstep energy must grow with speed')
    assert(sneak.rms < walk.rms, 'Sneaking must be quieter than normal walking')
    const lightLanding = await render(footstepVoices(surface, 3, {strength: impactFootstepStrength(2)}), 'land-light')
    const heavyLanding = await render(footstepVoices(surface, 3, {strength: impactFootstepStrength(10)}), 'land-heavy')
    assert(lightLanding.rms < heavyLanding.rms, 'Landing energy must grow with impact')
    steps.push({
      surface,
      slow,
      walk,
      sprint,
      sneak,
      lightLanding,
      heavyLanding,
    })
  }
  const sustained = output(1)
  const bed = playVoices(sustained, playerSoundEffects.zoom.voices, {
    seed: 'held',
    sustain: true,
  })
  const paused = sustained.context.suspend(0.5)
  const rendered = sustained.context.startRendering()
  await paused
  bed.stop(0.06)
  bed.stop(0.06)
  await sustained.context.resume()
  const heldBuffer = await rendered
  const heldSamples = heldBuffer.getChannelData(0)
  assert(stats(heldSamples.slice(rate * 0.3, rate * 0.45)).rms > 0.001, 'Held zoom failed to sustain')
  assert(stats(heldSamples.slice(rate * 0.7)).peak === 0, 'Released zoom kept playing')
  const interrupted = output(1)
  const forward = playVoices(interrupted, playerSoundEffects.viewEnter.voices, {seed: 'enter'})
  const reversal = interrupted.context.suspend(0.035)
  const mixed = interrupted.context.startRendering()
  await reversal
  forward.stop()
  playVoices(interrupted, playerSoundEffects.viewLeave.voices, {seed: 'leave'})
  await interrupted.context.resume()
  const reverseBuffer = await mixed
  const reverseSamples = reverseBuffer.getChannelData(0)
  assert(stats(reverseSamples).peak < 0.6, 'Interrupted voices stacked above headroom')
  assert(stats(reverseSamples.slice(rate * 0.5)).peak === 0, 'Interrupted voices leaked')
  return {
    cues,
    steps,
    heldZoomRelease: 'passed',
    interruptedTransitions: 'passed',
  }
}
