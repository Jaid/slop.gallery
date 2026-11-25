import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, positionGeometry, vec2} from 'three/tsl'

import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.08)
    this.name = knotData.id
    this.envMapIntensity = 1.08
    const {view, facing, grazing, near, intimate} = viewerFrame()
    const q = positionGeometry.mul(vec2(12, 2))
    const broadWarp = q.x.mul(TAU * 0.31).add(q.y.mul(TAU * 0.17)).sin().mul(0.24)
    const crystalGate = q.x.mul(TAU * 0.47).add(q.y.mul(TAU * 0.29)).sin().mul(0.5).add(0.5)
    const crystalShape = q.x.mul(TAU * 0.83).sub(q.y.mul(TAU * 0.61)).sin().abs().smoothstep(0.12, 0.42).oneMinus()
    const crystal = crystalGate.smoothstep(0.34, 0.58).mul(crystalShape)
    const seamWave = q.x.mul(TAU * 1.7).add(q.y.mul(TAU * 1.1)).add(broadWarp.mul(5.2)).sin().abs()
    const seam = float(1).sub(seamWave.smoothstep(0.025, 0.13))
    const parallax = view.mul(0.13)
    const lamellaPoint = q.add(vec2(parallax.x, parallax.y)).add(broadWarp)
    const lineA = lamellaPoint.x.mul(1.8).add(lamellaPoint.y.mul(0.52)).mul(TAU * 3.6).sin().abs()
    const lineB = lamellaPoint.x.mul(-0.7).add(lamellaPoint.y.mul(1.55)).mul(TAU * 4.3).sin().abs()
    const lineC = lamellaPoint.x.mul(1.15).add(lamellaPoint.y.mul(1.25)).mul(TAU * 5.2).sin().abs()
    const lamellaFootprint = lineA.fwidth().max(lineB.fwidth()).max(lineC.fwidth()).max(0.0003)
    const lamellaA = float(1).sub(lineA.smoothstep(0.035, 0.11)).mul(lamellaFootprint.smoothstep(0.7, 2.1).oneMinus())
    const lamellaB = float(1).sub(lineB.smoothstep(0.04, 0.12)).mul(lamellaFootprint.smoothstep(0.7, 2.1).oneMinus())
    const lamellaC = float(1).sub(lineC.smoothstep(0.032, 0.1)).mul(lamellaFootprint.smoothstep(0.7, 2.1).oneMinus())
    const lamella = lamellaA.max(lamellaB).max(lamellaC).mul(crystal)
    const iron = color(hsl.integer(222, 6, 51)).mul(crystalGate.mul(0.12).add(0.88))
    const olivine = mix(color(hsl.integer(138, 64, 32)), color(hsl.integer(72, 73, 63)), broadWarp.add(0.5))
    const crystalColor = olivine.mul(lamella.mul(-0.24).add(1)).mul(crystalShape.mul(0.16).add(0.84))
    const oxide = color(hsl.integer(43, 50, 28)).mul(seam.mul(0.5).add(broadWarp.mul(0.22).add(0.04)))
    let body = mix(iron, crystalColor, crystal)
    body = mix(body, oxide, seam.mul(0.38))
    this.colorNode = body
    this.metalnessNode = float(0.94).sub(crystal.mul(0.82)).add(lamella.mul(0.88)).sub(seam.mul(0.22))
    this.roughnessNode = float(0.24).sub(crystal.mul(0.1)).sub(lamella.mul(0.075)).add(seam.mul(0.22)).add(grazing.mul(0.025)).clamp(0.07, 0.55)
    this.clearcoat = 0.18
    this.clearcoatRoughness = 0.18
    this.iridescenceNode = seam.mul(0.1).add(grazing.mul(0.05))
    this.iridescenceThicknessNode = facing.mul(150).add(180)
    const relief = crystal.mul(0.0038).add(lamella.mul(0.0012)).sub(seam.mul(0.0015))
    this.normalNode = proceduralNormal(relief.mul(3), 0.55)
    this.clearcoatNormalNode = this.normalNode
    this.aoNode = float(1).sub(seam.mul(0.48)).sub(crystal.mul(0.08))
    this.emissiveNode = color(hsl.integer(228, 100, 96)).mul(lamella).mul(near.mul(0.32).add(0.1)).add(color(hsl.integer(70, 66, 69)).mul(crystal).mul(0.045))
      .add(color(hsl.integer(70, 66, 69)).mul(crystal).mul(grazing.pow(2)).mul(intimate.mul(0.045)))
      .add(color(hsl.integer(207, 32, 77)).mul(seam).mul(0.012))
  }
}
