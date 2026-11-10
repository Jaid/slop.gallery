import type {Node, Texture} from 'three/webgpu'

import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalView, vec3} from 'three/tsl'

import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const crackScale = 6.5
/** Distance from the nearest Voronoi site to the second nearest, sampled in 3D so the crazing never meets a UV seam. Zero along every cell wall. */
const seamField = (q: Node<'vec3'>) => {
  const cells = mx_worley_noise_vec3(q, 1, 0)
  return cells.y.sub(cells.x)
}
/** Crazed celadon glaze mended with maki-e gold: the cracks are cut at true depth and the repaired ones shine. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.9)
    this.name = knotData.id
    const {p, view} = viewerFrame()
    const scaled = p.mul(crackScale)
    const seam = seamField(scaled)
    const seamAa = seam.fwidth().max(0.0005)
    const crackWidth = seamAa.mul(1.5).add(0.035)
    const crack = seam.smoothstep(0.035, crackWidth).oneMinus()
// The dark groove is read a little deeper than the surface, so it slides against the gold as you move.
    const groove = seamField(scaled.sub(view.mul(0.12))).smoothstep(0.035, crackWidth).oneMinus()
// Only some seams were repaired: low-frequency noise picks the mended regions.
    const repaired = mx_noise_float(p.mul(2.2).add(vec3(4.1, 1.7, 9.3))).mul(0.5).add(0.5).smoothstep(0.42, 0.6)
    const gold = crack.mul(repaired)
    const cloud = mx_fractal_noise_float(p.mul(3.1), 4, 2, 0.5).mul(0.5).add(0.5)
    const celadon = mix(color('#0b1310'), color('#1d2c25'), cloud.smoothstep(0.3, 0.75))
    const glaze = mix(celadon, color('#010201'), groove)
    const leaf = color('#d8a64a')
    const sparkle = glints(normalView, 90)
    this.colorNode = mix(glaze, leaf, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.3).add(cloud.mul(0.15)), float(0.18), gold)
    this.clearcoat = 0.8
    this.clearcoatRoughness = 0.05
    const height = gold.mul(0.0022).sub(groove.mul(0.0045)).add(cloud.mul(0.0008))
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = leaf.mul(gold).mul(sparkle).mul(0.9)
  }
}
