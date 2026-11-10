import type {MoodGrade} from '#src/moods/base/Mood.ts'
import type {Node} from 'three/webgpu'

import {luminance, mix, uniform, vec4} from 'three/tsl'
import {Color, SRGBColorSpace, Vector3} from 'three/webgpu'

/** a gradient map showing at `amount` (0–1) of its strength */
export type ShownGrade = {
  amount: number
  grade: MoodGrade
}

/** how many gradient maps a frame takes on at once, one over the other */
const depth = 4
const layers = Array.from({length: depth}, () => ({
  /** how much of the frame the gradient map replaces: the mood’s strength times how far it has come */
  amount: uniform(0),
  shadow: uniform(new Vector3),
  midtone: uniform(new Vector3),
  highlight: uniform(new Vector3),
}))
const color = new Color
const rgb = {
  r: 0,
  g: 0,
  b: 0,
}
const paint = (target: {value: Vector3}, hex: string) => {
  color.set(hex).getRGB(rgb, SRGBColorSpace)
  target.value.set(rgb.r, rgb.g, rgb.b)
}

/**
 * Shows `grades` in every frame that {@link gradeMood} passes, each over the ones before it, or nothing without any.
 * Beyond the four a frame takes on, the faintest are left out.
 */
export function paintMoodGrades(grades: ReadonlyArray<ShownGrade>) {
  const shown = grades.length > depth ? grades.filter(entry => grades.filter(other => other.amount * other.grade.strength > entry.amount * entry.grade.strength).length < depth).slice(0, depth) : grades
  for (const [index, layer] of layers.entries()) {
    const entry = shown.at(index)
    layer.amount.value = entry ? entry.grade.strength * entry.amount : 0
    if (!entry) {
      continue
    }
    paint(layer.shadow, entry.grade.shadow)
    paint(layer.midtone, entry.grade.midtone)
    paint(layer.highlight, entry.grade.highlight)
  }
}

/**
 * Lays the gradient maps of the moods showing over `frame`, a color in display space, after the output transform, one over the other: each one’s luminance picks a color from the shadow over the midtone to the highlight, which replaces part of the color it was laid over.
 * A gradient map is display-referred: before tone mapping, every lamp and highlight would sit far past its highlight color. It is an artistic grade on top of the tone mapping, which only brings the HDR frame into the screen’s range and stays as it is.
 */
export function gradeMood(frame: Node<'vec4'>): Node<'vec4'> {
  let graded = frame.rgb
  for (const {amount, shadow, midtone, highlight} of layers) {
    const tone = luminance(graded).saturate()
    const lower = mix(shadow, midtone, tone.mul(2).saturate())
    const mapped = mix(lower, highlight, tone.mul(2).sub(1).saturate())
    graded = mix(graded, mapped, amount)
  }
  return vec4(graded, frame.a)
}
