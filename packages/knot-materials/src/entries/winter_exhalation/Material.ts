import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, time, uv, vec2, vec3} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, turn} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

function dendrite(tube: Node<'vec2'>, columns: number, rows: number, seed: number, intimate: Node<'float'>) {
  const {q, random, grid} = ornamentCell(tube, columns, rows, seed)
  const drift = vec2(time.mul(0.13).add(random.x.mul(TAU)).sin(), time.mul(0.11).add(random.y.mul(TAU)).cos()).mul(0.009)
  const local = turn(q.sub(random.xy.sub(0.5).mul(0.18)).add(drift), random.z.mul(TAU))
  const size = random.y.mul(0.2).add(0.8)
  const r = local.length().div(size)
  const a = polarAngle(local)
  // Fold into the nearest of six radial arms. All side branches are mirrored inside the sector.
  const sectorAngle = a.add(Math.PI / 6).mod(Math.PI / 3).add(Math.PI / 3).mod(Math.PI / 3).sub(Math.PI / 6)
  const folded = vec2(sectorAngle.cos().mul(r), sectorAngle.sin().mul(r).abs())
  const x = folded.x
  const y = folded.y
  const tip = enamel(x.sub(0.325))
  let frost = etch(y, 0.0047).mul(tip)
  let fine: Node<'float'> = float(0)
  for (const origin of [0.085, 0.145, 0.205, 0.265]) {
    const delta = x.sub(origin)
    const span = enamel(delta.negate()).mul(enamel(delta.sub(0.058)))
    const branch = etch(y.sub(delta.mul(0.86)), 0.0032).mul(span)
    frost = frost.add(branch)
    const secondary = etch(y.sub(delta.mul(0.86)).sub(delta.mul(70).sin().abs().mul(0.011)), 0.0013)
      .mul(span).mul(intimate)
    fine = fine.add(secondary)
  }
  const starHeart = etch(r.sub(0.038), 0.003)
  const frostGate = random.x.smoothstep(0.18, 0.28)
  const resolve = grid.fwidth().length().smoothstep(0.3, 1.3).oneMinus()
  return frost.add(fine.mul(0.55)).add(starHeart).clamp().mul(frostGate).mul(resolve)
}

/** Dendritic ice suspended below a rippled, partially frosted surface; no screen-space sprites. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.65)
    this.name = data.id
    const tube = uv()
    const ray = tubeRay()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const deep = dendrite(tube.sub(ray.mul(0.083)), 26, 3, 103, intimate)
    const middle = dendrite(tube.sub(ray.mul(0.042)), 21, 3, 73, intimate)
    const shallow = dendrite(tube.sub(ray.mul(0.012)), 18, 2, 41, intimate)
    const iceVeil = mx_noise_float(p.mul(9)).mul(0.5).add(0.5)
    const frostVeil = iceVeil.smoothstep(0.57, 0.8).mul(grazing.mul(0.38).add(0.3))
    const ripple = mx_noise_float(p.mul(vec3(12, 19, 8))).mul(0.5).add(0.5)
    const deepFlow = mx_noise_float(p.sub(view.mul(0.13)).mul(10).add(vec3(time.mul(0.035), 0, 0)))
    const caustic = filteredCos(deepFlow.mul(18).add(p.y.mul(11))).mul(0.5).add(0.5)
    const bubbleCell = ornamentCell(tube.sub(ray.mul(0.06)), 60, 7, 123)
    const bubbleLocal = bubbleCell.q.sub(bubbleCell.random.xy.sub(0.5).mul(0.45))
    const bubbleRadius = bubbleCell.random.x.mul(0.04).add(0.045)
    const bubbleDistance = bubbleLocal.length()
    const bubbleRing = etch(bubbleDistance.sub(bubbleRadius), 0.009)
    const bubbleCap = enamel(bubbleDistance.sub(bubbleRadius))
    const bubbleGate = bubbleCell.random.z.smoothstep(0.75, 0.83)
      .mul(bubbleCell.grid.fwidth().length().smoothstep(0.25, 0.95).oneMinus())
    const bubbles = bubbleRing.mul(bubbleGate)
    const bubbleShadow = bubbleCap.mul(bubbleGate)
    const grain = mx_noise_float(p.mul(100)).mul(0.5).add(0.5)
    const body = mix(color(hsl.integer(223, 87, 39)), color(hsl.integer(209, 45, 72)), ripple.mul(0.45).add(grazing.mul(0.35)))
    const icy = mix(body, color(hsl.integer(181, 25, 90)), frostVeil)
    this.colorNode = icy.mul(bubbleShadow.mul(-0.14).add(1))
      .add(color(hsl.integer(168, 34, 93.5)).mul(shallow).mul(0.19))
    this.metalness = 0
    this.ior = 1.31
    this.transmission = 0.72
    this.transmissionNode = float(0.72).sub(frostVeil.mul(0.43)).sub(shallow.mul(0.17)).clamp(0.2, 0.72)
    this.thickness = 0.24
    this.attenuationColor.set(hsl.integer(215, 63, 73))
    this.attenuationDistance = 0.48
    this.dispersion = 0.018
    this.roughnessNode = float(0.12).add(frostVeil.mul(0.31)).add(shallow.mul(0.05))
    this.clearcoat = 1
    this.clearcoatRoughnessNode = float(0.065).add(frostVeil.mul(0.18))
    this.normalNode = proceduralNormal(ripple.mul(0.0007).add(shallow.mul(0.00016))
      .add(grain.mul(frostVeil).mul(0.000065)), 0.7)
    this.clearcoatNormalNode = proceduralNormal(ripple.mul(0.0007), 0.65)
    const frostLight = color(hsl.integer(229, 54, 74)).mul(deep).mul(0.37)
      .add(color(hsl.integer(225, 52, 86)).mul(middle).mul(0.55))
      .add(color(hsl.integer(161, 100, 98.3)).mul(shallow).mul(0.74))
    this.emissiveNode = frostLight.mul(facing.mul(0.4).add(0.6)).mul(near.mul(0.18).add(0.82))
      .add(color(hsl.integer(215, 84, 64)).mul(caustic.pow(3)).mul(0.13).mul(frostVeil.oneMinus()))
      .add(color(hsl.integer(193, 55, 91.4)).mul(bubbles).mul(0.32))
  }
}
