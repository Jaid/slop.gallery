import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, cos, float, mix, sin, time, vec3} from 'three/tsl'

import {fbm} from '../../candidates/space_bunny/lib/fbm.ts'
import {ridgeBand} from '../../candidates/space_bunny/lib/ridgeBand.ts'
import {proceduralNormal} from '../../candidates/space_bunny/lib/surfaceGradient.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Woven pile. The warp and weft cross at a right angle and the nap is cut along the weft, so the whole surface has one preferred lay direction. That single fact is the entire optical behaviour of velvet: viewed one way the fibre sides face you and scatter, viewed the other way you are looking at their roots. */
function weave(q: Node<'vec3'>, clock: Node<'float'>, density = 150) {
  const warp = q.x.mul(density).add(sin(clock.mul(0.21)).mul(0.9))
  const weft = q.y.mul(density).add(clock.mul(0.05))
  return {
    warp: cos(warp),
    weft: cos(weft),
    diagonal: atan(weft, warp),
  }
}
/** Lay reversal. `lay` is a world-space direction the fibres point, warped wherever the pile was crushed and turning as the cloth settles. The sign of its dot with the eye says which side of every fibre you are looking at, and that is what makes velvet invert as you walk around it. */
function napReveal(crush: Node<'float'>, eye: Node<'vec3'>, wobble: Node<'float'>, settle: Node<'float'>, turn: Node<'float'>) {
  const layAngle = wobble.mul(2.6).add(crush.mul(2.2)).add(settle.mul(2.6)).add(turn)
  const lay = vec3(cos(layAngle), 0, sin(layAngle))
  const toward = lay.dot(eye.normalize())
  return {
    reveal: toward.mul(0.5).add(0.5),
    lay,
  }
}
/** A crushed brocade. The pile is pressed flat along the motif so the gold weft underneath shows through it. The motif is a woven ogee lattice: a product of two cosines, so its own symmetry is the cloth's symmetry. */
function damask(q: Node<'vec3'>, clock: Node<'float'>, scale = 6) {
  const t = clock.mul(0.02)
  const warp = fbm(q.mul(scale * 0.35).add(vec3(t, 0, t.mul(-0.6)))).mul(0.4)
  const ogee = cos(q.x.mul(scale).add(warp.mul(2.4)).cos()).mul(cos(q.y.mul(scale * 0.5).add(warp.mul(1.8)).cos()))
  const motif = ridgeBand(ogee, 0, 0.34).pow(0.7)
  const relief = fbm(q.mul(scale * 4).add(ogee.mul(2)))
  return {
    field: ogee,
    relief,
    damask: motif,
  }
}
/** Fibre tips catching the studio: only resolvable at close range, and always moving. */
function fibreTips(q: Node<'vec3'>, near: Node<'float'>, clock: Node<'float'>) {
  const tips = fbm(q.mul(420).add(vec3(clock.mul(0.12), clock.mul(0.05), 0)), 2)
  return {
    tips,
    glint: tips.smoothstep(0.2, 0.32).mul(near),
  }
}
/** A slow breath through the pile, as if someone had just walked past it. The lay does not return to where it was: velvet keeps the impression of the last hand that touched it, so this term never fully unwinds. */
function settling(q: Node<'vec3'>, clock: Node<'float'>) {
  return fbm(q.mul(1.6).add(vec3(0, clock.mul(0.09), 0)))
    .add(fbm(q.mul(0.6).add(vec3(clock.mul(0.05), 0, 0)), 2).mul(0.5))
}

/** Cut-pile velvet over a gold brocade. Light that lands on the fibre sides scatters back; light that falls between them does not. Because every fibre leans the same way, the same spot on the cloth is bright from one side of the room and almost black from the other — walk around it and it turns its colours over. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const settle = settling(p, time)
    const {warp, weft} = weave(p, time)
    const {damask: motif, field, relief} = damask(p, time)
// `view` points from the camera to the surface, so flipping it gives the direction the eye arrives from.
    const turn = sin(time.mul(0.17)).mul(1.4).add(sin(time.mul(0.06)).mul(0.9))
    const reveal = napReveal(motif, view.negate(), fbm(p.mul(0.9), 2), settle, turn).reveal
    const tips = fibreTips(p, near, time)
// The dyed ground: deep crimson pile, and a gold weft that only shows where the pile has been crushed away.
    const ground = mix(color(hsl.integer(5, 78, 8)), color(hsl.integer(19, 95, 27)), field.mul(0.5).add(0.5).abs().saturate())
    const goldThread = mix(color(hsl.integer(76, 87, 58)), color(hsl.integer(89, 100, 92.6)), relief.mul(0.5).add(0.5))
    this.colorNode = mix(ground, goldThread, motif.mul(0.75)).mul(reveal.mul(0.45).add(0.62))
    this.metalnessNode = motif.mul(0.7)
    this.roughnessNode = float(0.9).sub(motif.mul(0.42))
    this.sheen = 1
    this.sheenColor.set(hsl.integer(9, 100, 61.5))
    this.sheenRoughness = 0.3
    const pileHeight = warp.mul(0.5).add(weft.mul(0.5)).add(tips.tips.mul(0.3).mul(near)).add(motif.mul(0.5)).add(relief.mul(0.2).mul(near))
    this.normalNode = proceduralNormal(pileHeight, 0.0007)
// Grazing angles are where pile velvet is most alive, and the crushed gold thread is the only sparkle.
    this.emissiveNode = color(hsl.integer(9, 100, 62.7)).mul(grazing.pow(1.5)).mul(motif.oneMinus().mul(0.8).add(0.2)).mul(0.6)
      .add(color(hsl.integer(79, 100, 91)).mul(tips.glint).mul(motif).mul(0.55))
      .add(color(hsl.integer(17, 94, 36)).mul(intimate.mul(0.25).add(0.18)).mul(motif.oneMinus()).mul(reveal))
  }
}
