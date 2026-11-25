import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_noise_float, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 3. RADIOMETRIC GUILLOCHÉ: Horological Rosettes & Radium Scintillation */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, view, facing, near, intimate} = viewerFrame()
    const tube = uv()
    // Swiss rose-engine barleycorn guilloché equations
    const theta = tube.x.mul(Math.PI * 64)
    const phi = tube.y.mul(Math.PI * 18)
    const waveA = theta.add(phi.mul(3).sin().mul(4)).cos()
    const waveB = theta.mul(2).sub(phi.mul(6)).sin()
    const rosette = waveA.mul(waveB).abs().smoothstep(0.12, 0.7)
    // Dual-metal dial: 18K Rose Gold ribs and dark Ruthenium troughs
    const roseGold = color(hsl.integer(44, 52, 73))
    const ruthenium = color(hsl.integer(312, 12, 12))
    const dialSurface = mix(ruthenium, roseGold, rosette)
    // Radium-226 alpha ionization sparks (stochastic scintillation)
    const tick = time.mul(28).floor()
    // Each tick reseeds compact ionization points, never whole glowing grid cells.
    const alphaSpark = cellularPoints(p.mul(85).add(vec3(0, 0, tick)), 0.025, 0.16, 0.7)
    const vaporTrail = mx_noise_float(p.mul(32).sub(view.mul(0.08))).smoothstep(0.6, 0.85)
    this.colorNode = dialSurface
    this.metalnessNode = rosette.mul(0.3).add(0.68)
    this.roughnessNode = rosette.mul(0.14).add(0.08)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.03
    this.normalNode = proceduralNormal(rosette.mul(0.25), 0.004)
    // Radioactive phosphorescent emissions
    const radiumPhosphor = color(hsl.integer(147, 100, 86.5))
    this.emissiveNode = radiumPhosphor.mul(alphaSpark).mul(6)
      .add(radiumPhosphor.mul(vaporTrail).mul(intimate).mul(1.2))
      .add(roseGold.mul(rosette).mul(facing.pow(3)).mul(0.25))
      .mul(near.mul(0.5).add(0.5))
  }
}
