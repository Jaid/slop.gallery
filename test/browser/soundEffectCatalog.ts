import playVoices from 'procedural-audio'

import {soundEffects} from '../../src/lib/audio/soundEffects.ts'

const rate = 48_000
const effectsGain = 0.6 * 10 ** (12 / 20)
const assert: (condition: boolean, message: string) => asserts condition = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

/** Renders every sound effect recipe into silent offline buffers: no audible output, DOM, input, focus or viewport changes. */
export default async function verify() {
  const effects = []
  for (const effect of soundEffects) {
    const length = Math.max(...effect.voices.map(voice => voice.duration + (voice.delay ?? 0)))
    const context = new OfflineAudioContext(1, Math.ceil(rate * (length + 0.12)), rate)
    const master = context.createGain()
    master.gain.value = effectsGain
    master.connect(context.destination)
    playVoices({
      context,
      master,
    }, effect.voices, {seed: effect.id})
    const buffer = await context.startRendering()
    const samples = buffer.getChannelData(0)
    let peak = 0
    let power = 0
    let tail = 0
    const tailStart = samples.length - rate * 0.05
    for (const [index, sample] of samples.entries()) {
      assert(Number.isFinite(sample), `${effect.id} rendered a nonfinite sample`)
      peak = Math.max(peak, Math.abs(sample))
      power += sample * sample
      if (index >= tailStart) {
        tail = Math.max(tail, Math.abs(sample))
      }
    }
    assert(peak > 0.0005, `${effect.id} rendered silence`)
    assert(peak < 0.6, `${effect.id} exceeded headroom`)
    assert(tail < 0.00001, `${effect.id} did not finish silently`)
    effects.push({
      id: effect.id,
      label: effect.label,
      seconds: Number(length.toFixed(3)),
      peak: Number(peak.toFixed(4)),
      rms: Number(Math.sqrt(power / samples.length).toFixed(5)),
    })
  }
  return effects
}
