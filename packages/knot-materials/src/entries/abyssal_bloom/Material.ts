import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv} from 'three/tsl'

import {beads} from '../../lib/beads.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Scattered lure organs, each blinking on its own slow clock with a slightly different hue. */
function photophores(position: Node<'vec3'>, clock: Node<'float'>, scale: number, seed: number) {
  const lamp = beads(position.mul(scale), seed)
  const blink = clock.mul(lamp.random.y.mul(2.4).add(0.6)).add(lamp.random.z.mul(TAU)).sin().mul(0.5).add(0.5).pow(7)
  return {
    blink,
    core: lamp.core,
    dome: lamp.cap.mul(lamp.radius),
    hue: lamp.random.x,
    mask: lamp.mask,
  }
}

export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.4)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const tube = uv()
// Three nerve packets circulating the body, each a slow peristaltic swell.
    const travel = tube.x.mul(TAU * 3).sub(time.mul(1.35))
    const packet = travel.cos().mul(0.5).add(0.5)
    const pulse = packet.pow(18)
    const swell = packet.pow(3)
    const organ = photophores(p, time, 13, 4.4)
    const deepOrgan = photophores(p.sub(view.mul(0.4)), time.mul(0.7), 5, 2.1)
// The organ domes are bead-space heights; scaling to world units keeps their slopes sane.
    const height = swell.mul(0.012).add(organ.dome.mul(0.012))
    this.positionNode = positionGeometry.add(normalLocal.mul(swell.mul(0.01)))
    this.normalNode = liquidNormal(float(1), 0.55).add(proceduralNormal(height, 1)).normalize()
    const skin = mix(color(hsl.integer(248, 48, 4)), color(hsl.integer(247, 56, 12)), mx_noise_float(p.mul(8)).mul(0.5).add(0.5))
    const nerveColor = mix(color(hsl.integer(210, 99, 81.9)), color(hsl.integer(342, 100, 64.7)), swell.pow(2))
    const organColor = cosinePalette(organ.hue, [0.15, 0.45, 0.55], [0.2, 0.45, 0.4], [1, 1, 1], [0, 0.25, 0.55])
    const deepColor = color(hsl.integer(40, 99, 68))
    this.colorNode = skin
    this.metalness = 0
    this.roughnessNode = mx_noise_float(p.mul(9)).mul(0.06).add(0.12)
    this.clearcoat = 0.7
    this.clearcoatRoughness = 0.06
    this.transmission = 0.45
    this.thickness = 0.7
    this.ior = 1.34
    this.dispersion = 0.22
    this.attenuationColor.set(hsl.integer(226, 83, 19))
    this.attenuationDistance = 0.8
    this.iridescence = 0.35
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = mx_noise_float(p.mul(6)).mul(180).add(260)
    this.envMapIntensity = 0.45
    this.emissiveNode = nerveColor.mul(pulse).mul(intimate.mul(0.5).add(0.8)).mul(2.4).add(organColor.mul(organ.core).mul(organ.blink).mul(near.mul(0.7).add(0.45)).mul(2)).add(deepColor.mul(deepOrgan.core.mul(0.5).add(deepOrgan.mask.mul(0.12))).mul(intimate.mul(0.8).add(0.3)).mul(0.55)).add(color(hsl.integer(209, 100, 83.7)).mul(grazing.pow(2.6)).mul(0.8))
  }
}
