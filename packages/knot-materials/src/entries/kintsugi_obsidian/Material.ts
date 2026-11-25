import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, mx_worley_noise_vec2, normalViewGeometry, time, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import BaseKnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Shattered volcanic glass mended with gold. Molten light travels the seams; at grazing angles the conchoidal fracture planes inside the black glass surface like smoke. */
export default class extends BaseKnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view, grazing, rim, near} = viewerFrame()
    const shards = p.mul(5.5).add(mx_noise_float(p.mul(2)).mul(0.25))
    const worley = mx_worley_noise_vec2(shards, 1)
    const edgeDist = worley.y.sqrt().sub(worley.x.sqrt())
    const seamWidth = mx_noise_float(p.mul(4.5).add(3.3)).mul(0.5).add(0.5).mul(0.06).add(0.012)
    const seamFoot = edgeDist.fwidth().mul(1.2)
    const seam = edgeDist.smoothstep(seamWidth, seamWidth.add(seamFoot).add(0.01)).oneMinus()
    const seamCore = edgeDist.smoothstep(seamWidth.mul(0.4), seamWidth.mul(0.4).add(seamFoot)).oneMinus()
    const fine = mx_worley_noise_vec2(p.mul(13).add(vec3(5.1, 2.2, 7.7)), 1)
    const fineEdge = fine.y.sqrt().sub(fine.x.sqrt())
    const hairlineCrack = fineEdge.smoothstep(0, fineEdge.fwidth().mul(1.5).add(0.008)).oneMinus().mul(seam.oneMinus()).mul(mx_noise_float(p.mul(3).add(8)).smoothstep(0.05, 0.4))
    const inner = p.sub(view.mul(0.06))
    const conchoid = inner.dot(vec3(3.1, 7.4, -2.2)).mul(9).add(mx_noise_float(inner.mul(4)).mul(6)).sin()
    const planes = conchoid.abs().smoothstep(0, conchoid.fwidth().mul(2).add(0.08)).oneMinus().mul(grazing.pow(1.5)).mul(near)
    const smoke = mx_fractal_noise_float(inner.mul(3), 3, 2, 0.5).mul(0.5).add(0.5)
    const flowPhase = mx_noise_float(p.mul(1.8)).mul(7).add(p.y.mul(5)).sub(time.mul(0.8))
    const flow = flowPhase.sin().mul(0.5).add(0.5).pow(8)
    const goldBase = mix(color(hsl.integer(68, 84, 56)), color(hsl.integer(87, 100, 87.8)), seamCore)
    const obsidian = mix(color(hsl.integer(298, 26, 3.6)), color(hsl.integer(288, 24, 12)), smoke.mul(grazing).mul(0.6))
    this.colorNode = mix(obsidian, goldBase, seam)
    this.metalnessNode = seam
    this.roughnessNode = float(0.04).mix(0.3, seam).add(hairlineCrack.mul(0.2))
    this.clearcoatNode = seam.oneMinus()
    this.clearcoatRoughness = 0.02
    this.iridescence = 1
    this.iridescenceNode = grazing.pow(2).mul(seam.oneMinus()).mul(0.35)
    this.iridescenceIOR = 1.3
    this.iridescenceThicknessNode = smoke.mul(300).add(250)
    this.normalNode = proceduralNormal(seam.add(seamCore.mul(0.5)).sub(hairlineCrack.mul(0.6)).add(mx_noise_float(p.mul(40)).mul(0.03)), 0.0016)
    const seamGlint = glints(normalViewGeometry.add(mx_noise_vec3(p.mul(60)).mul(0.08)).normalize(), 50)
    this.emissiveNode = color(hsl.integer(72, 100, 79.1)).mul(seam).mul(flow).mul(near.mul(0.7).add(0.3)).mul(1.4)
      .add(goldBase.mul(seam).mul(seamGlint).mul(0.4))
      .add(color(hsl.integer(262, 39, 85)).mul(planes).mul(0.35))
      .add(color(hsl.integer(0, 0, 100)).mul(hairlineCrack).mul(glints(normalViewGeometry, 30)).mul(0.25))
      .add(color(hsl.integer(57, 67, 22)).mul(rim).mul(0.1))
  }
}
