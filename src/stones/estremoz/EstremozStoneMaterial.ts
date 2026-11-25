import type {MarbleStyle} from '#src/lib/materials/marble/marble.ts'
import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_noise_float, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'
import {solidMarble} from '#src/lib/materials/marble/solidMarble.ts'

import TranslucentLightingModel from '../lib/TranslucentLightingModel.ts'

const unit = (node: Node<'float'>) => node.mul(0.5).add(0.5)

/** Estremoz rosa: a pale shell pink clouded with salmon, veined in soft gray-green. */
export const estremozRosa: MarbleStyle = {
  base: '#e9cbbd',
  cloud: '#d39887',
  halo: '#c9a497',
  haloStrength: 0.45,
  thread: '#8f938a',
  threadStrength: 0.5,
  vein: '#7b8478',
  veinWidth: 0.0018,
  web: 0,
}

/**
 * Rosa Portogallo, the pink marble of Estremoz in the Alentejo, which Portugal’s palaces and the Romans of Lusitania before them were dressed in: a pale shell pink, clouded with deeper salmon and rose that drift through it in broad, soft streams, threaded with a few thin gray-green veins. Its calcite is coarser than Carrara’s and glints more, and light goes into it a little way, so it warms where its forms turn away (`TranslucentLightingModel`). Rubbed to a satin finish.
 *
 * The clouds and veins are sheets through the solid block (`solidMarble`), mapped in the meters of its geometry, so they run on unbroken over every edge.
 */
export default class EstremozStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.26,
      envMapIntensity: 0.8,
    })
    this.name = 'Estremoz pink marble'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('estremozFootprint')
    const marble = solidMarble({
      bedding: [0.2, 1, 0.6],
      footprint,
      position: p,
      scale: 1.8,
      seed: 11,
      style: estremozRosa,
    })
    // Broad streams of rose drifting along the bedding, deeper than the marble’s own clouds.
    const stream = unit(mx_noise_float(p.mul(1.1).add(p.y.mul(1.6)).add(23))).smoothstep(0.45, 0.8)
    const glint = unit(mx_noise_float(p.mul(1800))).smoothstep(0.78, 0.9).mul(visibleDetail(footprint, 0.0007))
    const sugar = mix(float(0.5), unit(mx_noise_float(p.mul(600).add(5))), visibleDetail(footprint, 0.0018))
    const mottle = unit(mx_noise_float(p.mul(9).add(3)))
    const stone = mix(marble.color, color('#c27c6c'), stream.mul(0.6)).mul(mottle.sub(0.5).mul(0.08).add(1))
    this.colorNode = stone.mul(float(1).add(sugar.sub(0.5).mul(0.05)).add(glint.mul(0.05)))
    this.roughnessNode = float(0.24).add(unit(mx_noise_float(p.mul(3).add(7))).mul(0.06)).add(marble.vein.mul(0.05)).sub(glint.mul(0.14))
    this.normalNode = heightNormal(sugar.mul(0.000014).add(mx_noise_float(p.mul(36)).mul(0.00004)))
  }
  override setupLightingModel() {
    return new TranslucentLightingModel(0.35, color('#ffc8b4'))
  }
}
