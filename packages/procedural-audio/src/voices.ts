/** a filter a voice sounds through, which may glide exponentially to `endFrequency` by the voice’s end */
export type VoiceFilter = {
  endFrequency?: number
  frequency: number
  q?: number
  type: BiquadFilterType
}
/** a tone that rises within `attack` seconds and falls exponentially to silence by its end, which may glide exponentially to `endFrequency` on the way */
export type OscillatorVoice = {
  /** seconds it takes to rise to its volume, by default 0.003 */
  attack?: number
  /** seconds after the recipe starts until it sets in */
  delay?: number
  duration: number
  endFrequency?: number
  filter?: VoiceFilter
  frequency: number
  kind: 'oscillator'
  type?: OscillatorType
  volume: number
}
/** white noise through a filter, shaped like an {@link OscillatorVoice} */
export type NoiseVoice = {
  attack?: number
  delay?: number
  duration: number
  filter: VoiceFilter
  kind: 'noise'
  volume: number
}
/** one layer of a sound; a recipe is a list of them, plain data that can be built, scaled and compared without any audio context */
export type Voice = NoiseVoice | OscillatorVoice

/** A tone of `frequency` hertz, a sine unless `options` say otherwise. */
export const osc = (frequency: number, duration: number, volume: number, options: Partial<Omit<OscillatorVoice, 'duration' | 'frequency' | 'kind' | 'volume'>> = {}): OscillatorVoice => ({
  kind: 'oscillator',
  type: 'sine',
  frequency,
  duration,
  volume,
  ...options,
})

/** White noise through `filter`. */
export const noise = (duration: number, volume: number, filter: VoiceFilter, options: Partial<Omit<NoiseVoice, 'duration' | 'filter' | 'kind' | 'volume'>> = {}): NoiseVoice => ({
  kind: 'noise',
  duration,
  volume,
  filter,
  ...options,
})

/** Delays every voice of a recipe by `seconds`, to string recipes together into one playback. */
export function shiftVoices(voices: ReadonlyArray<Voice>, seconds: number): Array<Voice> {
  return voices.map(voice => ({
    ...voice,
    delay: (voice.delay ?? 0) + seconds,
  }))
}

/** Scales the volume of every voice of a recipe by `factor`. */
export function scaleVoices(voices: ReadonlyArray<Voice>, factor: number): Array<Voice> {
  return voices.map(voice => ({
    ...voice,
    volume: voice.volume * factor,
  }))
}
