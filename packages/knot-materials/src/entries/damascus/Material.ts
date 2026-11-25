import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, cos, float, mix, sin, time, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {proceduralNormal} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** The watered pattern of pattern-welded steel. Real damascus is a fold history: the bar is folded, welded, drawn out and folded again, so the layer count survives as a slowly curving ribbon. Reproducing the fold rather than the picture means the bands curve, pool and swirl the way the metal actually did. */
function layerCount(q: Node<'vec3'>, clock: Node<'float'>) { // The bar is still on the wheel: the fold relaxes by a hair between hammer blows.
  const creep = sin(clock.mul(0.13)).mul(0.02)
  const twist = fbm(q.mul(1.15).add(vec3(0, clock.mul(0.012), 0))).mul(2.2)
  const weld = fbm(q.mul(3.4).add(vec3(twist.mul(0.6), 0, 0))).mul(0.9)
// Each pass doubles the layer density, which is exactly what a fold-and-weld cycle does.
  const pass1 = q.y.add(twist).add(weld.mul(1.6)).add(creep)
  const pass2 = pass1.mul(2.1).add(fbm(q.mul(2.2).add(vec3(5.3, 1.9, -4.1)), 2).mul(2.4)).add(creep.mul(2.3))
  return {
    pass1,
    pass2,
    twist,
  }
}
/** The band itself: a hard edge where the acid bite went deeper into the high-carbon layer. */
function waterBand(phase: Node<'float'>, bandWidth = 0.11) {
  return {
    band: ridgeBand(phase.fract().sub(0.5), 0, bandWidth),
    edge: ridgeBand(phase.fract().sub(0.5), 0, bandWidth * 0.32),
  }
}
/** Hammer facets: the forge never left a perfectly flat face. */
function hammerMarks(q: Node<'vec3'>, twist: Node<'float'>, clock: Node<'float'>) {
  return fbm(q.mul(24).add(vec3(twist.mul(1.4), 0, 0)), 2).add(fbm(q.mul(24).add(vec3(clock.mul(0.3), 0, 0)), 2).mul(0.15))
}
/** The polisher's pass: a slow travelling bloom, as if the belt were still moving along the bar. */
function polishing(q: Node<'vec3'>, clock: Node<'float'>) {
  const along = q.y.mul(1.4).add(q.x.mul(0.3))
  const pass = along.sub(clock.mul(0.09)).fract()
  return {
    belt: cos(pass.mul(Math.PI * 2)).mul(0.5).add(0.5).pow(3),
    pass,
  }
}

/** Pattern-welded steel. The two layers differ only in carbon, and the ferric nitrate bath makes the difference legible: the high-carbon line goes matte and dark, the low-carbon line stays a mirror. Because the layers are stacked along a fold direction, the pattern swims when you turn the bar, and it never lines up twice. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.4)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
// Reading the fold through the surface makes the pattern swim with the viewer instead of sitting on it.
    const interior = p.sub(view.mul(0.05))
    const {pass1, pass2, twist} = layerCount(interior, time)
// Two interleaved layer families, so the bar shows both the fine grain and the coarse "topspin".
    const fine = waterBand(pass1.mul(9), 0.13)
    const coarse = waterBand(pass2.mul(4.5), 0.17)
    const pattern = coarse.band.mul(0.6).add(fine.band.mul(0.4))
    const line = coarse.edge.mul(0.55).add(fine.edge.mul(0.45))
// High-carbon steel etches matte and dark; the bright low-carbon line between them stays a true mirror.
    const {belt} = polishing(p, time)
    const etched = mix(color(hsl.integer(261, 11, 14)), color(hsl.integer(264, 8, 6)), pattern).mul(belt.mul(0.35).add(0.8))
    const polished = mix(color(hsl.integer(254, 24, 89)), color(hsl.integer(0, 0, 100)), line).mul(belt.mul(0.5).add(0.8))
    const base = mix(etched, polished, line)
    const oxide = fbm(p.mul(4.2).add(vec3(twist.mul(0.5), 0, 0)))
    const tempered = mix(base, base.mul(color(hsl.integer(53, 100, 74))), oxide.smoothstep(0.08, 0.26).mul(0.4))
    this.colorNode = tempered.mul(facing.oneMinus().mul(0.24).add(0.84))
    this.metalnessNode = mix(float(0.7), float(1), line)
    this.roughnessNode = mix(float(0.4), float(0.03), line).add(pattern.mul(0.06)).add(grazing.mul(0.03))
    this.anisotropy = 0.55
    this.anisotropyRotation = 0
    this.clearcoat = 0
    const marks = hammerMarks(p, twist, time)
    const micro = fbm(p.mul(160), 2)
    const relief = line.mul(-0.5).add(pattern.mul(0.24)).add(marks.mul(0.06).mul(near)).add(micro.mul(0.02).mul(near))
    this.normalNode = proceduralNormal(relief, 0.0006)
// The etched high-carbon layer scatters a little of the room back as a warm haze; nothing else glows.
    const haze = pattern.mul(0.5).add(line.mul(0.5))
    this.emissiveNode = color(hsl.integer(52, 74, 40)).mul(haze).mul(grazing.mul(0.4).add(0.16))
      .add(color(hsl.integer(262, 100, 97.4)).mul(line).mul(intimate.mul(0.3).add(0.3)))
      .add(color(hsl.integer(70, 100, 88.4)).mul(belt).mul(line).mul(0.3))
    this.envMapIntensity = 1.4
  }
}
