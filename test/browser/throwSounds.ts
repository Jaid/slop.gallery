import playVoices from 'procedural-audio'

import throwVoices from '../../src/lib/audio/throwVoices.ts'
import {itemLaunch} from '../../src/lib/physics/itemLaunch.ts'

/** Standalone offline rendering: the release cues must stay audible, bounded and end silently at the game’s effects gain. */
export default async function verify() {
  const results = []
  for (const mass of [0.005, 0.9, 1.8, 60]) {
    for (const throwing of [false, true]) {
      for (const carrier of [[0, 0, 0], [0, 0, 9], [0, 6, 9]] as const) {
        const context = new OfflineAudioContext(2, 24_000, 48_000)
        const master = context.createGain()
        master.gain.value = 0.6 * 10 ** (12 / 20)
        master.connect(context.destination)
        playVoices({
          context,
          master,
        }, throwVoices(itemLaunch(mass, [0, 0, 1], carrier, throwing)), {seed: 'release'})
        const buffer = await context.startRendering()
        const samples = buffer.getChannelData(0)
        let peak = 0
        let energy = 0
        for (const sample of samples) {
          if (!Number.isFinite(sample)) {
            throw new TypeError('Nonfinite release sound.')
          }
          peak = Math.max(peak, Math.abs(sample))
          energy += sample * sample
        }
        const tail = Math.max(...samples.slice(-2400).map(Math.abs))
        if (peak < 0.0005 || peak > 0.6 || tail > 0.0001) {
          throw new Error(`Release sound outside headroom or not silent at end: ${peak}, ${tail}.`)
        }
        results.push({
          mass,
          throwing,
          carrier,
          peak,
          rms: Math.sqrt(energy / samples.length),
        })
      }
    }
  }
  return results
}
