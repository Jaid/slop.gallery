import playVoices from 'procedural-audio'

import throwVoices from '../../src/lib/audio/throwVoices.ts'
import {itemMotion} from '../../src/lib/physics/itemMotion.ts'

/** Render every release gesture through the gallery’s effects gain, checking audibility, headroom, silent tails and distinct waveforms without playing anything aloud. */
export default async function verify() {
  const cases = {
    standing: itemMotion(1.8, [0, 0, -1], true),
    light: itemMotion(0.008, [0, 0, -1], true),
    heavy: itemMotion(30, [0, 0, -1], true),
    sprint: itemMotion(1.8, [0, 0, -1], true, [0, 0, -9]),
    jump: itemMotion(1.8, [0, 0, -1], true, [0, 5, 0]),
    drop: itemMotion(1.8, [0, 0, -1], false),
    movingDrop: itemMotion(1.8, [0, 0, -1], false, [0, 0, -9]),
  }
  const results = []
  const waves = []
  for (const [name, motion] of Object.entries(cases)) {
    const context = new OfflineAudioContext(1, 48_000, 48_000)
    const master = context.createGain()
    master.gain.value = 0.6 * 10 ** (12 / 20)
    master.connect(context.destination)
    playVoices({
      context,
      master,
    }, throwVoices(motion), {seed: 'release-test'})
    const buffer = await context.startRendering()
    const samples = buffer.getChannelData(0)
    let peak = 0
    let tail = 0
    let square = 0
    for (const [i, sample] of samples.entries()) {
      if (!Number.isFinite(sample)) {
        throw new TypeError(`${name} produced a nonfinite sample.`)
      }
      peak = Math.max(peak, Math.abs(sample))
      square += sample ** 2
      if (i > 24_000) {
        tail = Math.max(tail, Math.abs(sample))
      }
    }
    if (peak < 0.001 || peak > 0.6 || tail > 0.0001) {
      throw new Error(`${name}: peak ${peak}, tail ${tail}.`)
    }
    for (const wave of waves) {
      if (samples.every((value, i) => value === wave[i])) {
        throw new Error(`${name} sounds identical to another gesture.`)
      }
    }
    waves.push(samples)
    results.push({
      name,
      peak,
      rms: Math.sqrt(square / samples.length),
      tail,
    })
  }
  return results
}
