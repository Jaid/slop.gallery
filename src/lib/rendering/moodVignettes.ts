import type {MoodVignette} from '#src/moods/base/Mood.ts'
import type {Node} from 'three/webgpu'

import {mix, uniform, vec4} from 'three/tsl'
import {create} from 'zustand'

/** A layer lives for one showing of the mood. Only its uniform changes during the fade. */
export const vignetteLayer = (draw: MoodVignette) => ({
  draw,
  amount: uniform(0),
})
type Layers = ReadonlyArray<ReturnType<typeof vignetteLayer>>

/** Published only when the shaders in the finished frame change, not on every tick of the mixer. */
export const useMoodVignettes = create<Layers>(() => [])

export function showMoodVignettes(layers: Layers) {
  const last = useMoodVignettes.getState()
  if (last.length !== layers.length || layers.some((layer, i) => layer !== last[i])) {
    useMoodVignettes.setState(layers, true)
  }
}

/** The room shaders first, the cast one last, each painting the display-space RGB beneath it. Alpha belongs to the incoming frame. */
export function compositeVignettes(frame: Node<'vec4'>, layers: Layers) {
  if (!layers.length) {
    return frame
  }
  let rgb = frame.rgb
  for (const {draw, amount} of layers) {
    rgb = mix(rgb, draw(rgb), amount)
  }
  return vec4(rgb, frame.a)
}
