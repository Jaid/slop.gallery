/** seconds that looping noise and sway curves last; white noise has no audible seam */
export const loopLength = 6

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>

/** A few seconds of white noise, shared by everything that sounds in a context. Looped or started somewhere at random, it never repeats audibly. */
export function whiteNoise(context: BaseAudioContext) {
  let buffer = noiseBuffers.get(context)
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate * loopLength, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    noiseBuffers.set(context, buffer)
  }
  return buffer
}

/** Smooth random values in 0–1 that loop seamlessly, `rate` new targets per second, to modulate a level or a filter with. */
export function swayCurve(context: BaseAudioContext, rate: number) {
  const points = Math.max(2, Math.round(rate * loopLength))
  const targets = Array.from({length: points}, Math.random)
  const buffer = context.createBuffer(1, context.sampleRate * loopLength, context.sampleRate)
  const data = buffer.getChannelData(0)
  const step = data.length / points
  for (let i = 0; i < data.length; i++) {
    const position = i / step
    const index = Math.floor(position)
    const blend = (1 - Math.cos((position - index) * Math.PI)) / 2
    data[i] = targets[index % points] * (1 - blend) + targets[(index + 1) % points] * blend
  }
  return buffer
}
