import type {MoodScreen, MoodScreenId} from '#src/moods/base/Mood.ts'
import type {Node} from 'three/webgpu'

import {float, Fn, If, mix, mx_noise_float, screenUV, smoothstep, uniform, vec3, vec4} from 'three/tsl'

import {rgb} from '#src/orbs/lib/fill.ts'

export type ShownMoodScreen = {
  amount: number
  screen: MoodScreen
}
/** how many independent mood screen shaders a frame can hold */
export const moodScreenDepth = 4
const ids = ['brush-vignette'] as const satisfies ReadonlyArray<MoodScreenId>
const amountOf = {
  'brush-vignette': uniform(0),
} as const satisfies Record<MoodScreenId, ReturnType<typeof uniform>>
const listeners = new Set<(active: boolean) => void>
let active = false

/** whether a screen mood is showing, including a fade in or out */
export function moodScreenActive() {
  return active
}

/** Observes whether the render pipeline has to draw any mood screen shader. */
export function subscribeMoodScreen(listener: (active: boolean) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
/** Updates screen shaders without rebuilding their node graphs. */
export function paintMoodScreens(shown: ReadonlyArray<ShownMoodScreen>) {
  const selected = shown.length > moodScreenDepth ? shown.filter(entry => shown.filter(other => other.amount * other.screen.strength > entry.amount * entry.screen.strength).length < moodScreenDepth).slice(0, moodScreenDepth) : shown
  const strengths: Partial<Record<MoodScreenId, number>> = {}
  for (const entry of selected) {
    const {id, strength} = entry.screen
    strengths[id] = 1 - (1 - (strengths[id] ?? 0)) * (1 - entry.amount * strength)
  }
  for (const id of ids) {
    amountOf[id].value = strengths[id] ?? 0
  }
  const next = ids.some(id => amountOf[id].value > 0)
  if (next !== active) {
    active = next
    for (const listener of listeners) {
      listener(active)
    }
  }
}

/** Draws every showing screen shader in registry order over a display-space frame. */
export function screenMood(frame: Node<'vec4'>) {
  // eslint-disable-next-line typescript/no-use-before-define -- the function is initialized before any render pipeline asks for the graph
  return drawMoodScreens(frame)
}

// Runtime branching matters: Heavy keeps this pipeline mounted even when no mood is showing, and none of the paint’s procedural noise should run then.
const drawMoodScreens = Fn(([frame]: [Node<'vec4'>]) => {
  const current = frame.toVar('moodScreen')
  If(amountOf['brush-vignette'].greaterThan(0), () => {
    current.assign(brushVignette(current, amountOf['brush-vignette']))
  })
  return current
})
/**
 * The Paint Orb’s moving canvas: broad oil strokes sweep in, one after another, around the edge and leave the middle of the view clear. The mood’s eased fade is the brush timeline, so picking the orb up draws the frame and letting it go erases it in reverse. `?fade=false` shows the finished vignette at once.
 */
function brushVignette(frame: Node<'vec4'>, strength: Node<'float'>) {
  const point = screenUV
  const brush = (path: Node<'float'>, across: Node<'float'>, along: Node<'float'>, seed: number, width: number, start: number, tone: string) => {
    const grain = mx_noise_float(vec3(across.mul(155).add(path.mul(55)), along.mul(30), seed))
    const bristles = across.mul(430).add(along.mul(9)).add(seed * 4).add(grain.mul(5)).sin()
    const halfWidth = float(width).mul(float(1).add(grain.mul(0.22))).mul(float(1).sub(along.mul(0.18)))
    const ragged = halfWidth.sub(path.abs()).add(grain.mul(0.0035))
    const outline = smoothstep(-0.004, 0.003, ragged)
    const reached = smoothstep(start, start + 0.38, strength)
    const reveal = smoothstep(-0.035, 0.02, reached.add(0.018).sub(along))
    const dry = bristles.mul(0.5).add(0.5).mul(0.18).add(0.82)
    const fringe = smoothstep(-0.08, 0.95, path.abs().div(halfWidth)).oneMinus().mul(0.22).add(0.78)
    const caps = smoothstep(0, 0.08, along).mul(smoothstep(0, 0.08, along.oneMinus())).mul(0.45).add(0.55)
    const coverage = outline.mul(reveal).mul(dry).mul(fringe).mul(caps).clamp(0, 1)
    const gleam = grain.mul(0.4).add(across.mul(31).add(along.mul(7)).sin().mul(0.1)).add(0.5)
    return {
      coverage,
      pigment: rgb(tone).mul(gleam.mul(0.28).add(0.72)),
    }
  }
  const x = point.x
  const y = point.y
  let painted = frame.rgb
  const lay = (stroke: ReturnType<typeof brush>, opacity: number) => {
    painted = mix(painted, stroke.pigment, stroke.coverage.mul(opacity))
  }
  lay(brush(y.sub(0.03).sub(x.mul(8.2).sin().mul(0.012)).sub(x.mul(31).cos().mul(0.004)), x, x.oneMinus(), 2, 0.055, 0.04, '#1f3aa8'), 0.64)
  lay(brush(float(0.97).sub(y).add(x.mul(9.7).sin().mul(0.018)).add(x.mul(27).cos().mul(0.003)), x, x, 6, 0.055, 0.2, '#0f7a5c'), 0.69)
  lay(brush(x.sub(0.03).sub(y.mul(7.4).sin().mul(0.016)).sub(y.mul(25).sin().mul(0.004)), y, y, 11, 0.052, 0.34, '#d8341e'), 0.65)
  lay(brush(float(0.97).sub(x).add(y.mul(8.7).cos().mul(0.013)).add(y.mul(35).sin().mul(0.004)), y, y.oneMinus(), 15, 0.052, 0.49, '#f2b705'), 0.67)
  return vec4(mix(frame.rgb, painted, strength), frame.a)
}
