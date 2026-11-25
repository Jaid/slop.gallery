import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, time, vec3} from 'three/tsl'

import {cellularBoundary} from '../../lib/cellularBoundary.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Porcelain repaired with gold. Two scales of Voronoi fracture cut the glaze: broad shard seams flooded with metal, and a hairline crazing that only resolves when the visitor leans in. Celadon pools in the hollows of the glaze, while the gold stays dark until a shard seam turns to mirror the gallery lights toward the eye. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.75)
    this.name = knotData.id
    const {p, facing, grazing, near, objectDistance} = viewerFrame()
    const close = objectDistance.smoothstep(1.5, 4.8).oneMinus()
    const intimate = objectDistance.smoothstep(1.15, 3.1).oneMinus()
// Broad fractures between porcelain shards, and the fine crazing inside each shard.
    const shardField = cellularBoundary(p.mul(3.1).add(vec3(2.7, 8.4, 1.3)))
    const shardAa = shardField.fwidth().max(0.0001)
    const veinCore = shardField.smoothstep(shardAa.mul(0.4), shardAa.mul(1.8).add(0.055)).oneMinus()
    const veinHalo = shardField.smoothstep(0.09, 0.3).oneMinus()
    const crazeField = cellularBoundary(p.mul(12.5).add(vec3(17.9, 3.2, 11.6)))
    const crazeAa = crazeField.fwidth().max(0.0001)
    const crazing = crazeField.smoothstep(crazeAa.mul(0.4), crazeAa.mul(1.5).add(0.032)).oneMinus().mul(intimate)
// Celadon glaze pools where a slow mineral cloud settles; ivory stands on the high ground.
    const poolNoise = mx_fractal_noise_float(p.mul(2.9).add(vec3(6.1, 1.7, 4.4)), 3, 2.05, 0.5).mul(0.5).add(0.5)
    const pool = poolNoise.smoothstep(0.52, 0.82)
    const kilnCloud = mx_noise_float(p.mul(7.5).add(poolNoise.mul(1.6))).mul(0.5).add(0.5)
    const speckleField = mx_noise_float(p.mul(74))
    const speckleResolved = p.mul(74).fwidth().length().smoothstep(0.35, 1.1).oneMinus()
    const speckle = speckleField.smoothstep(0.72, 0.95).mul(speckleResolved).mul(close).mul(0.16)
// The seams sit in shallow grooves; the glaze swells almost imperceptibly between them.
// This relief is kept free of screen-space derivatives so it can drive bump mapping on its own.
    const veinRelief = shardField.smoothstep(0.008, 0.06).oneMinus()
    const crazeRelief = crazeField.smoothstep(0.006, 0.045).oneMinus().mul(intimate)
    const relief = pool.mul(0.00035).sub(veinRelief.mul(0.0016)).sub(crazeRelief.mul(0.00055))
    const porcelainNormal = proceduralNormal(relief, 1.05)
    this.normalNode = porcelainNormal
    this.clearcoatNormalNode = porcelainNormal
    const ivory = color(hsl.integer(87, 45, 84))
    const celadon = color(hsl.integer(175, 46, 66))
    const deepCeladon = color(hsl.integer(180, 57, 39))
    let glaze = mix(ivory, celadon, pool.mul(0.78))
    glaze = mix(glaze, deepCeladon, pool.mul(poolNoise.smoothstep(0.62, 0.9)).mul(0.55))
    glaze = glaze.mul(kilnCloud.mul(0.22).add(0.82)).mul(speckle.oneMinus())
    const antiqueGold = color(hsl.integer(59, 82, 36))
    const brightGold = color(hsl.integer(81, 88, 78))
    const gold = mix(antiqueGold, brightGold, veinCore)
    const goldMask = veinCore.max(crazing.mul(0.72))
    this.colorNode = mix(mix(glaze, antiqueGold.mul(0.72), veinHalo.mul(0.38)), gold, goldMask)
    this.metalnessNode = goldMask.mul(0.96).add(veinHalo.mul(0.25)).clamp()
    this.roughnessNode = mix(mix(float(0.34), float(0.21), pool), float(0.16), goldMask)
    this.clearcoatNode = goldMask.oneMinus().mul(0.62).add(0.08)
    this.clearcoatRoughness = 0.16
    this.iridescenceNode = grazing.mul(pool).mul(0.22)
    this.iridescenceIOR = 1.42
    this.iridescenceThicknessNode = pool.mul(210).add(130)
    this.aoNode = veinHalo.mul(-0.22).add(1).mul(crazing.mul(-0.12).add(1))
// A slow sheen travels along the seams, then each seam flashes hard only at its mirror angle.
    const sweepPhase = p.dot(vec3(2.4, 1.1, 1.8)).add(time.mul(Math.PI)).sin().mul(0.5).add(0.5)
    const sweep = sweepPhase.smoothstep(0.72, 0.98).mul(0.35).add(0.75)
    const mirrorFlash = glints(porcelainNormal, 190)
    this.emissiveNode = brightGold.mul(veinCore).mul(mirrorFlash).mul(sweep).mul(near.mul(1.1).add(0.55)).mul(2.2)
      .add(antiqueGold.mul(crazing).mul(mirrorFlash).mul(0.7))
      .add(color(hsl.integer(175, 40, 80)).mul(pool).mul(grazing.pow(3)).mul(0.045))
      .add(color(hsl.integer(92, 100, 96)).mul(veinCore).mul(facing.pow(6)).mul(0.05))
  }
}
