import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionGeometry, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, line, visibleDetail} from '#src/lib/materials/filters.ts'

import TranslucentLightingModel from '../lib/TranslucentLightingModel.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Volterra alabaster, the gypsum the Etruscans carved their ash urns from and the workshops of Volterra still turn into lamps: soft enough to scratch with a nail and so translucent that light sinks deep into it, milky white clouded with honey, banded where it grew in layers, and crossed by the odd thin vein of amber-brown clay.
 *
 * Light goes far into it, farther than into marble, so its forms glow and shade very softly (`TranslucentLightingModel`), the clearer, honey-colored layers deeper than the milky ones. Rubbed with wax to a soft sheen. The bands are the level sets of a warped field through the whole block, mapped in the meters of its geometry, so they curve on round every edge.
 */
export default class AlabasterStoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.28,
      envMapIntensity: 0.7,
    })
    this.name = 'Volterra alabaster'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('alabasterFootprint')
    const meters = (field: Float) => field.div(field.fwidth().max(1e-7)).mul(footprint)
    // The layers it grew in, wavy and of every thickness, a hand or so apart.
    const warped = p.add(mx_noise_vec3(p.mul(0.7)).mul(0.25)).add(mx_noise_vec3(p.mul(2.3).add(4)).mul(0.05)).toVar('alabasterWarped')
    const layering = warped.y.mul(6.5).add(warped.x.mul(1.2)).add(mx_fractal_noise_float(warped.mul(1.3), 3, 2, 0.5).mul(1.6))
    const band = unit(layering.mul(Math.PI).sin()).toVar('alabasterBand')
    const honey = band.smoothstep(0.5, 0.95).mul(unit(mx_noise_float(warped.mul(1.4).add(9))).smoothstep(0.35, 0.75))
    // Milky clouds drift through the layers.
    const cloud = unit(mx_fractal_noise_float(p.mul(3.2).add(2), 4, 2, 0.5))
    // Thin veins of clay, long and broken.
    const vein = line(meters(mx_noise_float(warped.mul(vec3(1.4, 0.8, 1.1)).add(13)).add(mx_noise_float(p.mul(14)).mul(0.03))), 0.0006).mul(unit(mx_noise_float(p.mul(1.2).add(31))).smoothstep(0.55, 0.8))
    const grain = mix(float(0.5), unit(mx_noise_float(p.mul(700))), visibleDetail(footprint, 0.0015))
    let stone: Node<'vec3'> = mix(color('#f2ede3'), color('#dfcfb2'), cloud.smoothstep(0.3, 0.8))
    stone = mix(stone, color('#cba673'), honey.mul(0.65))
    stone = mix(stone, color('#8c6540'), vein.mul(0.75))
    this.colorNode = stone.mul(grain.sub(0.5).mul(0.03).add(1))
    // Wax lies thicker in the clearer layers.
    this.roughnessNode = float(0.3).sub(honey.mul(0.08)).add(cloud.sub(0.5).mul(0.06)).add(vein.mul(0.1))
    this.normalNode = heightNormal(grain.mul(0.00001).add(mx_noise_float(p.mul(25)).mul(0.00004)).sub(vein.mul(0.00002)))
  }
  override setupLightingModel() {
    return new TranslucentLightingModel(0.85, color('#ffcf9c'))
  }
}
