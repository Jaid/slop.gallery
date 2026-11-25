import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalView, time, uv, vec2, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A standing wave on the bronze, in the Chladni tradition: the plate only moves where the two modes agree, and the sand can only rest there. `note` is the signed displacement of the plate, so its zero set is the figure the sand draws. */
const mode = (tube: Node<'vec2'>, along: number, around: number, drift: Node<'float'>, warp: number) => {
  const bow = tube.y.mul(TAU * around).sin().mul(warp)
  const u = tube.x.add(bow).add(mx_noise_float(tube.mul(vec2(3, 2))).mul(warp * 0.6))
  return u.mul(TAU * along).add(drift).sin().mul(tube.y.mul(TAU * around).add(drift.mul(0.37)).sin())
}

/** Chladni's requiem. An ancient bronze plate, tapped at one point: the note is a standing wave, the sand rides the nodes, and the figure breathes as the tone drifts. Walk around the piece and the pattern slides across the bronze; lean in and the individual grains start to catch the studio. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.72)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
// The note: two modes beating slowly against each other, so the figure never settles for good.
    const drift = time.mul(0.09)
    const note = mode(tube, 5, 3, drift, 0.05).mul(0.74).add(mode(tube, 8, 4, drift.mul(-0.63), 0.04).mul(0.26))
// The strike: a ring of energy running the length of the plate, throwing the sand off the nodes.
    const strike = tube.x.mul(TAU * 2).sub(time.mul(2.1)).sin().mul(0.5).add(0.5).pow(6)
// Planished bronze: shallow dimples from raising, a circular burnish, and the patina of old air.
    const hammer = mx_fractal_noise_float(p.mul(22), 2, 2.1, 0.5).mul(0.5).add(0.5)
    const burnish = mx_noise_float(p.mul(vec3(1.5, 70, 1.5))).abs().pow(0.6)
    const patina = mx_fractal_noise_float(p.mul(6.5), 4, 2.15, 0.55).mul(0.5).add(0.5).smoothstep(0.4, 0.95)
// Sand: a drift of loose grains everywhere, packed into the nodes where the plate is still.
    const grain = mx_noise_float(p.mul(150)).abs().pow(0.35).oneMinus()
    const nodes = opticalLine(note, 0.05).mul(grain.smoothstep(0.08, 0.5).mul(0.9).add(0.1))
    const sand = nodes.add(grain.mul(0.06)).clamp()
    const brass = mix(color(hsl.integer(69, 73, 44)), color(hsl.integer(126, 32, 27)), patina.mul(0.55))
    this.colorNode = mix(brass, color(hsl.integer(88, 52, 92)), sand.mul(0.92)).mul(hammer.mul(0.14).add(0.88))
    this.metalness = 1
    this.roughnessNode = float(0.17).add(burnish.mul(0.1)).add(patina.mul(0.4)).add(sand.mul(0.62)).sub(strike.mul(sand).mul(0.18))
    this.anisotropy = 0.55
// The plate itself is dead flat, so all relief lives in the bronze: dimples, burnish and the sand.
    this.normalNode = proceduralNormal(hammer.mul(0.0009).add(burnish.mul(0.0003)).add(nodes.mul(0.0016)).add(note.mul(0.0004).mul(strike)), 0.8)
    const glint = glints(normalView, 170).mul(sand).mul(near.mul(0.55).add(0.45))
    this.emissiveNode = color(hsl.integer(89, 100, 94.5)).mul(glint).mul(0.5)
      .add(color(hsl.integer(175, 60, 79)).mul(patina).mul(grazing.pow(2.5)).mul(near.mul(0.5).add(0.3)).mul(0.07))
      .add(color(hsl.integer(76, 100, 86)).mul(nodes).mul(strike).mul(intimate.mul(0.4).add(0.2)).mul(0.22))
  }
}
