import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalBands} from '../../lib/opticalBands.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Tahitian nacre is nearly black until broad subsurface terraces meet the eye at a favorable angle. Its low-frequency layers have no crackle geometry: the hard outer luster floats over a soft inner sea-glass glow. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.62)
    this.name = knotData.id
    const {p, view, facing, grazing, near} = viewerFrame()
    const inner = p.sub(view.mul(0.072))
    const drift = vec3(time.mul(0.006), time.mul(-0.004), 0)
    const cloud = mx_fractal_noise_float(inner.mul(2.4).add(drift), 3, 2.03, 0.52).mul(0.5).add(0.5)
    const grain = mx_noise_float(inner.mul(9.2)).mul(0.5).add(0.5)
    const growthAxis = vec3(0.47, 0.72, -0.51).normalize()
    const growthPhase = inner.dot(growthAxis).mul(16).add(cloud.mul(4.1)).add(grain.mul(0.38))
    const growth = opticalBands(growthPhase).mul(0.7).add(opticalBands(growthPhase.mul(0.44).add(4.2)).mul(0.3))
    const lobe = view.dot(growthAxis).abs().smoothstep(0.25, 0.93).pow(2.2)
    const midAngle = grazing.oneMinus().mul(grazing.sub(0.12).smoothstep(0, 0.5)).clamp().mul(2)
    const seaGlass = lobe.mul(growth.mul(0.47).add(0.53)).mul(midAngle.mul(0.75).add(0.25))
    const rose = grazing.pow(1.85).mul(cloud.mul(0.36).add(0.28))
    const shimmer = seaGlass.add(rose.mul(0.7)).mul(facing.mul(0.12).add(0.88)).clamp()
    const abyss = mix(color(hsl.integer(234, 100, 1)), color(hsl.integer(218, 60, 7)), cloud.mul(0.1).add(grain.mul(0.018)).clamp())
    const nacre = mix(color(hsl.integer(187, 98, 61)), color(hsl.integer(352, 71, 60)), rose.div(seaGlass.add(rose).add(0.0001)).clamp())
    this.colorNode = mix(abyss, nacre, shimmer.mul(0.98))
    this.metalness = 0
    this.roughnessNode = float(0.18).sub(shimmer.mul(0.07)).add(grain.mul(0.014)).clamp(0.07, 0.24)
    this.ior = 1.58
    this.clearcoat = 1
    this.clearcoatRoughness = 0.028
    this.iridescence = 0.62
    this.iridescenceIOR = 1.56
    this.iridescenceNode = shimmer.mul(0.68)
    this.iridescenceThicknessNode = growth.mul(46).add(405)
    const pearlNormal = proceduralNormal(growth.mul(0.12).add(cloud.mul(0.035)), 0.00025)
    this.normalNode = pearlNormal
    this.clearcoatNormalNode = pearlNormal
    this.emissiveNode = nacre.mul(shimmer).mul(near.mul(0.28).add(0.06))
  }
}
