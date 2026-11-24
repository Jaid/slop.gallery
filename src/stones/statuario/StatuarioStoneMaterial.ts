import type {MarbleStyle} from '#src/lib/materials/marble/marble.ts'
import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_noise_float, positionGeometry} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'
import {solidMarble} from '#src/lib/materials/marble/solidMarble.ts'

import TranslucentLightingModel from './TranslucentLightingModel.ts'

const unit = (node: Node<'float'>) => node.mul(0.5).add(0.5)

/** Statuario: the whitest Carrara, barely clouded, with a few thin, soft gray veins. */
export const statuario: MarbleStyle = {
  base: '#f4f2ed',
  cloud: '#dedad2',
  halo: '#cdc8bf',
  haloStrength: 0.4,
  thread: '#a29e97',
  threadStrength: 0.45,
  vein: '#99958e',
  veinWidth: 0.0015,
  web: 0,
}

/**
 * Statuario, the whitest of the marbles of Carrara, which Michelangelo went up into the Apuan Alps to choose his blocks from: an even white with a breath of ivory, clouded so faintly that it reads as one body, and crossed here and there by a thin gray vein that softens into the stone round it.
 *
 * Its calcite is saccharoidal, a sugar of crystals under a millimeter across, which catch the light one by one up close. Light goes a little way into it before it comes back out, so its forms shade softly into their shadows and its edges glow (`TranslucentLightingModel`). Rubbed to a satin finish, as a carver leaves a figure, not polished to a mirror.
 *
 * The veins are sheets through the solid block (`solidMarble`), mapped in the meters of its geometry, so they run on unbroken over every edge, chip and carved turn.
 */
export default class StatuarioStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.3,
      envMapIntensity: 0.8,
    })
    this.name = 'Statuario marble'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('statuarioFootprint')
    const marble = solidMarble({
      bedding: [0.5, 1, 0.3],
      footprint,
      position: p,
      scale: 2.6,
      seed: 5,
      style: statuario,
    })
    // The sugar: crystals catching the light here and there, close up only.
    const glint = unit(mx_noise_float(p.mul(2600))).smoothstep(0.8, 0.92).mul(visibleDetail(footprint, 0.0005))
    const sugar = mix(float(0.5), unit(mx_noise_float(p.mul(900).add(5))), visibleDetail(footprint, 0.0012))
    // The rubbing leaves broad, faint differences of sheen.
    const rubbed = unit(mx_noise_float(p.mul(3.1).add(11)))
    this.colorNode = marble.color.mul(float(1).add(sugar.sub(0.5).mul(0.04)).add(glint.mul(0.04)))
    this.roughnessNode = float(0.26).add(rubbed.mul(0.08)).add(marble.vein.mul(0.05)).sub(glint.mul(0.14))
    this.normalNode = heightNormal(sugar.mul(0.000012).add(mx_noise_float(p.mul(38)).mul(0.00004)))
  }
  override setupLightingModel() {
    return new TranslucentLightingModel(0.45, color('#ffdcc4'))
  }
}
