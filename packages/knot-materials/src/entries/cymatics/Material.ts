import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, time, uv, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {proceduralNormal} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The standing-wave field of a square Chladni plate: a product of two cosine modes minus their exchange. The nodal set is the zero set of that expression, so a band around zero is where the sand collects. */
const mode = (x: Node<'float'>, y: Node<'float'>, xMode: number, yMode: number) => x.mul(Math.PI * xMode).cos().mul(y.mul(Math.PI * yMode).cos())
  .sub(x.mul(Math.PI * yMode).cos().mul(y.mul(Math.PI * xMode).cos()))
/** Blend of two modes, so the figure dissolves and re-forms as the tone glides instead of snapping. */
function modeBlend(tube: Node<'vec2'>, clock: Node<'float'>, span = 6) {
  const x = tube.x.mul(span)
  const y = tube.y.mul(span)
  const a = mode(x, y, 1, 3)
  const b = mode(x.add(0.31), y.add(0.17), 3, 2)
  const glide = clock.mul(0.19).fract().smoothstep(0, 1)
  return a.mul(glide).add(b.mul(glide.oneMinus()))
}
/** Nodal lines, plus a finer halo of loose grains that only resolves when the camera is close. */
function nodalFigure(field: Node<'float'>, width: number) {
  return {
    lines: ridgeBand(field, 0, width),
    sand: ridgeBand(field, 0, width * 2.6),
    haze: field.abs().clamp(0, 1),
  }
}
/** Anisotropic brushed steel: the plate keeps the direction of the last polish forever. */
function brushing(q: Node<'vec3'>, clock: Node<'float'>, axis: number) {
  return {
    streak: q.mul(vec3(axis, 190, axis)).add(vec3(clock.mul(0.012), 0, clock.mul(0.007))),
    grain: q.mul(vec3(1.6, 330, 1.6)),
  }
}

/** Cymatics. A steel plate clamped at its centre and bowed at the rim: the sand has nowhere to be except the nodes. Sweep past and the figure is already a different animal, because the tone never stops climbing. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const field = modeBlend(tube, time, 3)
    const {lines, sand, haze} = nodalFigure(field, 0.075)
    const {streak, grain} = brushing(p, time, 2.4)
// Fine quartz grains: only drawn where the sand is thick enough to hold them, and only up close.
    const grainField = fbm(p.mul(300), 2)
    const grains = grainField.smoothstep(0.14, 0.24).mul(sand).mul(near)
// The plate is blued steel, warmed slightly where the bow has been dragging.
    const heat = fbm(tube.x.mul(0.6).add(vec3(time.mul(0.02), 0, 0)), 2)
    const steel = mix(color(hsl.integer(256, 14, 8)), color(hsl.integer(258, 19, 15)), heat.mul(0.5).add(0.5))
    const sandColor = mix(color(hsl.integer(82, 50, 49)), color(hsl.integer(86, 100, 94.6)), grainField.mul(0.5).add(0.5))
    const coverage = sand.mul(0.96).add(grains.mul(0.5)).clamp(0, 1)
    this.colorNode = mix(steel, sandColor, coverage).mul(haze.mul(0.24).add(0.86))
    this.metalnessNode = sand.oneMinus().mul(0.92).add(grains.mul(0.4))
    this.roughnessNode = mix(float(0.14), float(0.8), sand).add(grains.mul(0.2)).add(grazing.mul(0.05))
    this.anisotropy = 0.75
    this.anisotropyRotation = 0
    this.clearcoat = 0.4
    this.clearcoatRoughness = 0.07
    const relief = lines.mul(-0.4).add(sand.mul(0.35)).add(grains.mul(0.6).mul(near))
      .add(fbm(streak, 2).mul(0.05)).add(fbm(grain, 1).mul(0.014).mul(near))
    this.normalNode = proceduralNormal(relief, 0.0004)
// The plate rings: a faint standing shimmer in the antinodes, brightest when you are close enough to hear it.
    const antinode = haze.oneMinus()
    const ring = antinode.mul(antinode).mul(intimate.mul(0.6).add(0.4))
    this.emissiveNode = color(hsl.integer(83, 53, 70)).mul(ring).mul(0.22)
      .add(color(hsl.integer(91, 100, 95.5)).mul(grains).mul(0.45))
      .add(color(hsl.integer(70, 64, 35)).mul(sand).mul(0.06))
  }
}
