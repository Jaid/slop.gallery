import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {float, hash, mix, select, time, vec2} from 'three/tsl'

/** what a ghost’s face does: how far its eyes are shut, where they glance in its own units and how startled it is, 0–1 */
export type GhostExpression = {
  blink: Node<'float'>
  glance: Node<'vec2'>
  startle: Node<'float'>
}

/** the colors of a ghost: its pale sheet, the glow it gives off and its hollow eyes and mouth */
export const ghostColors = {
  sheet: hsl.integer(163, 100, 97.5),
  glow: hsl.integer(157, 100, 88.4),
  hole: hsl.integer(175, 51, 4),
}
/** seconds a ghost’s eyes take to close and open again */
const blinkLength = 0.22
/**
 * How far a ghost’s eyes are shut, 0–1. Each ghost blinks once in every stretch of `period` seconds, at a random moment within it, and now and then twice in a row; `phase` sets it apart from the others.
 */
export function ghostBlink(phase: Node<'float'> | number, period: number) {
  const offset = typeof phase === 'number' ? float(phase) : phase
  const t = time.add(offset.mul(7.3))
  const stretch = t.div(period).floor()
  const into = t.sub(stretch.mul(period))
  const at = hash(stretch.add(offset.mul(13))).mul(period - 0.8)
  const twice = hash(stretch.add(offset.mul(13).add(0.5))).greaterThan(0.65)
  const shut = (start: Node<'float'>) => float(1).sub(into.sub(start).sub(blinkLength / 2).abs().div(blinkLength / 2)).clamp().smoothstep(0, 0.6)
  return shut(at).max(shut(at.add(blinkLength + 0.12)).mul(twice.select(float(1), float(0))))
}

/**
 * The inside of a ghost under a sheet, positive within it, in its own units: a round head that widens into a skirt with a rippling hem and two stubby arms, and the inside of its hollow eyes and mouth, which wails on and on; `phase` sets its ripples and its wail apart from other ghosts’.
 * It reaches from about −0.76 at its hem to 0.62 at the top of its head and 0.52 to either side, arms included. Outside, its body’s value is about its distance from the outline, so a glow made of it stays round.
 */
export function ghostShape(point: Node<'vec2'>, phase: Node<'float'> | number, {blink, glance, startle}: GhostExpression) {
  const offset = typeof phase === 'number' ? float(phase) : phase
  const {x, y} = point
  const head = float(0.4).sub(point.sub(vec2(0, 0.22)).length())
  const width = float(0.4).add(float(0.22).sub(y).max(0).mul(0.22))
  const hem = float(-0.7).add(x.mul(16).add(time.mul(5)).add(offset).sin().mul(0.06))
  const sides = width.sub(x.abs())
  const below = y.sub(hem)
  const above = float(0.22).sub(y)
  const within = sides.min(below).min(above)
  // Outside, the distance to the nearest edge or corner rather than the farthest edge, or a glow around it would spike out of its corners.
  const beyond = vec2(sides.negate().max(0), below.negate().max(0).add(above.negate().max(0))).length().negate()
  const skirt = select(within.greaterThan(0), within, beyond)
  const wave = time.mul(3).add(offset).sin().mul(0.06)
  const arms = float(0.09).sub(vec2(x.abs().sub(0.43), y.add(0.06).sub(wave.mul(x.sign()))).length())
  const body = head.max(skirt).max(arms)
  const wail = time.mul(1.7).add(offset.mul(2)).sin().mul(0.5).add(0.5)
  // The eyes glance about, widen when startled and close to a thin slit as they blink.
  const seen = point.sub(vec2(glance.x.mul(x.sign()), glance.y))
  const eyeSize = startle.mul(0.3).add(1)
  const eyes = ellipse(vec2(seen.x.abs(), seen.y.add(blink.mul(0.03))), [0.15, 0.28], [eyeSize.mul(0.07), mix(eyeSize.mul(0.11), float(0.012), blink)])
  const gape = wail.mul(float(1).sub(startle)).add(startle.mul(1.4))
  const mouth = ellipse(point, [0, 0.03], [float(0.07).add(gape.mul(0.02)), float(0.07).add(gape.mul(0.07))])
  return {
    body,
    face: eyes.max(mouth),
  }
}

/** an ellipse’s inside, positive within it, roughly in units of its width */
function ellipse(point: Node<'vec2'>, center: [number, number], [width, height]: [Node<'float'> | number, Node<'float'> | number]) {
  return float(1).sub(point.sub(vec2(...center)).div(vec2(width, height)).length()).mul(width)
}
