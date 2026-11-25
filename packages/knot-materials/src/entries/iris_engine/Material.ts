import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, positionViewDirection, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {enamel, etch, filteredCos, ornamentCell, polarAngle, polarTicks, repeatLine} from '../../candidates/gpt_sol/lib/ornamentAtlas.ts'
import {tubeRay} from '../../lib/atelier.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import data from './data.ts'

/** Layered lenticular wavefronts and thin-film silver, with a separately filtered diffraction grating. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.95)
    this.name = data.id
    const tube = uv()
    const {p, facing, grazing, near, intimate} = viewerFrame()
    const ray = tubeRay()
    const {q, random} = ornamentCell(tube, 18, 2, 117)
    const r = q.length()
    const a = polarAngle(q)
    const dial = enamel(r.sub(0.385))
    const outerRing = etch(r.sub(0.412), 0.004)
    const innerRing = etch(r.sub(0.373), 0.002)
    const centerRing = etch(r.sub(0.075), 0.004)
    const ticks = polarTicks(q, 96, 0.07)
      .mul(enamel(r.sub(0.405))).mul(enamel(float(0.389).sub(r)))
    const structure = outerRing.add(innerRing).add(centerRing).add(ticks.mul(0.7)).clamp()
    const flute = filteredCos(a.mul(12).add(r.mul(8))).mul(0.5).add(0.5)
    const viewSlope = positionViewDirection.dot(tangentView.normalize())
    let optics: Node<'vec3'> = vec3(0)
    let sculpt: Node<'float'> = float(0)
    for (const [i, depth] of [0.014, 0.038, 0.066].entries()) {
      const cell = ornamentCell(tube.sub(ray.mul(depth)), 18, 2, 117)
      const local = cell.q
      const radius = local.length()
      const angle = polarAngle(local)
      const wavefront = radius.mul(29 + i * 6).sub(angle.mul(i % 2 ? -2 : 2))
        .add(time.mul(0.13)).add(cell.random.y.mul(TAU))
      const fringe = filteredCos(wavefront).mul(0.5).add(0.5)
      const iris = enamel(radius.sub(0.35)).mul(enamel(float(0.085).sub(radius)))
      // Representative wavelengths, in nm. Angle changes optical path, rather than arbitrarily rotating RGB hue.
      const path = viewSlope.mul(740).add(radius.mul(1100)).add(fringe.mul(270)).add(i * 143)
      const phase = vec3(1 / 650, 1 / 530, 1 / 460).mul(path).mul(TAU)
      const spectrum = phase.cos().mul(0.5).add(0.5).pow(1.4)
      const crest = fringe.pow(4).mul(iris)
      optics = optics.add(spectrum.mul(crest).mul(0.42 - i * 0.08))
      sculpt = sculpt.add(crest.mul(0.33))
    }
    const diagonal = tube.x.mul(TAU * 8).add(tube.y.mul(TAU * 2)).add(viewSlope.mul(6))
    const ribbon = filteredCos(diagonal).mul(0.5).add(0.5)
    const groovePhase = tube.x.mul(TAU * 1200).add(tube.y.mul(TAU * 132)).add(flute.mul(0.4))
    const microgrooves = filteredCos(groovePhase).mul(0.5).add(0.5)
    const brushed = mx_noise_float(p.mul(110)).mul(0.5).add(0.5)
    const pearl = mix(color(hsl.integer(241, 20, 56)), color(hsl.integer(280, 11, 86)), ribbon.mul(0.4).add(facing.mul(0.25)).add(0.2))
    const tinted = pearl.mul(optics.mul(0.8).add(vec3(0.58, 0.65, 0.7))).add(optics.mul(0.18))
    const centralLens = enamel(r.sub(0.066))
    const lensColor = mix(color(hsl.integer(253, 50, 15)), color(hsl.integer(197, 46, 74)), facing.pow(4))
    const silver = mix(tinted, lensColor, centralLens)
    const alloy = mix(silver, color(hsl.integer(238, 29, 24)), structure.mul(0.7))
    const calibration = repeatLine(tube.x.mul(360), 0.06).mul(etch(q.y.abs().sub(0.458), 0.01)).mul(intimate)
    this.colorNode = alloy.mul(microgrooves.mul(0.025).add(0.98))
      .add(color(hsl.integer(185, 21, 87)).mul(calibration).mul(0.12))
    this.metalnessNode = float(0.7).add(structure.mul(0.16)).sub(centralLens.mul(0.5))
    this.roughnessNode = float(0.24).add(structure.mul(0.05)).sub(sculpt.mul(0.07)).add(brushed.mul(0.015))
    this.clearcoat = 1
    this.clearcoatRoughness = 0.065
    this.iridescence = 0.75
    this.iridescenceNode = dial.mul(flute.mul(0.25).add(0.5)).add(centralLens.mul(0.25)).clamp()
    this.iridescenceIOR = 1.46
    this.iridescenceThicknessNode = r.mul(570).add(flute.mul(120)).add(random.x.mul(70)).add(180)
    this.anisotropy = 0.6
    this.anisotropyNode = vec2(a.cos(), a.sin()).mul(dial.mul(0.4).add(0.15))
    this.normalNode = proceduralNormal(flute.mul(dial).mul(0.00014).add(structure.mul(0.00032))
      .add(microgrooves.mul(0.000006)), 0.55)
    this.clearcoatNormalNode = proceduralNormal(ribbon.mul(0.0002), 0.65)
    this.emissiveNode = optics.mul(dial).mul(near.mul(0.04).add(0.06))
      .add(color(hsl.integer(202, 71, 74)).mul(centerRing).mul(facing.pow(3)).mul(0.05))
      .add(color(hsl.integer(258, 45, 56)).mul(grazing.pow(3)).mul(0.025))
  }
}
