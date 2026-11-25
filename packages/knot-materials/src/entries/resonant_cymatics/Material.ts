import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, tangentView, time, uv, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** 2. RESONANT CYMATICS: Chladni Nodal Acoustics on Polished Obsidian */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {p, rim, near, intimate} = viewerFrame()
    const tube = uv()
    // Acoustic 2D standing-wave Chladni equation on the torus tube
    const u = tube.x.mul(Math.PI * 16)
    const v = tube.y.mul(Math.PI * 6)
    // Harmonic mode transitions
    const modeA = u.mul(3).cos().mul(v.mul(5).cos()).sub(u.mul(5).cos().mul(v.mul(3).cos()))
    const modeB = u.mul(4).cos().mul(v.mul(2).cos()).sub(u.mul(2).cos().mul(v.mul(4).cos()))
    const resonanceShift = time.mul(0.4).sin().mul(0.5).add(0.5)
    const chladni = mix(modeA, modeB, resonanceShift)
    // Luminescent quantum dust trapped strictly along nodal lines (where amplitude = 0)
    const nodalBand = chladni.abs().smoothstep(0.02, 0.14).oneMinus()
    const dustParticles = cellularPoints(p.mul(64).add(vec3(0, time.mul(0.2), 0)), 0.06, 0.22, 0.2).mul(nodalBand)
    // Obsidian ultrasonic micro-vibrations
    const vibrationRipples = chladni.mul(24).sin().mul(0.08)
    const obsidianNormal = proceduralNormal(vibrationRipples, 0.003)
    const phosphorColor = mix(color(hsl.integer(151, 95, 81)), color(hsl.integer(202, 100, 85)), resonanceShift)
    this.colorNode = color(hsl.integer(254, 19, 4))
    this.metalness = 0.12
    this.roughness = 0.035
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.normalNode = obsidianNormal
    // Anisotropic acoustic shear around the tube
    this.anisotropy = 0.85
    this.anisotropyNode = tangentView.xy
    this.emissiveNode = phosphorColor.mul(dustParticles).mul(4.5).mul(intimate.mul(0.7).add(0.5))
      .add(color(hsl.integer(186, 95, 55)).mul(nodalBand).mul(0.7))
      .add(color(hsl.integer(184, 100, 88)).mul(rim).mul(0.2))
      .mul(near.mul(0.5).add(0.5))
  }
}
