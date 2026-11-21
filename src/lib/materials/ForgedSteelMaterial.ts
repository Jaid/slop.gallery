import type {Texture} from 'three/webgpu'

import {attribute, color, float, max, mix, mx_fractal_noise_float, mx_noise_float, positionLocal, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {steelReflectance} from './BrushedMetalMaterial.ts'
import {heightNormal, visibleDetail} from './filters.ts'

/**
 * Hand-forged steel, dulled by age: blotches of dark patina over a metal that was polished once, with the faint dents of the hammer.
 *
 * Geometry tells it where the steel is, through the `steelMask` attribute: how far a point lies in a hole through the steel, like a slit in a visor, which shows only the dark inside instead, and how freshly honed or polished it is, like the bevel of an edge, which keeps it bright and free of patina. All of it is mapped in local meters, so it stays put on a carried thing.
 *
 * It borrows the environment it reflects, which it never disposes.
 */
export default class ForgedSteelMaterial extends MeshStandardNodeMaterial {
  constructor({environment, patina = 0.6}: {
    environment?: Texture
    /** how much of the steel the dark patina takes, from none to the most */
    patina?: number
  } = {}) {
    super({
      envMap: environment ?? null,
      envMapIntensity: 0.55,
      metalness: 1,
      roughness: 0.3,
    })
    this.name = 'Forged steel'
    const mask = attribute<'vec2'>('steelMask', 'vec2')
    const hole = mask.x
    const polish = mask.y
    const position = positionLocal
    // broad, cloudy blotches with ragged edges, like the patina on the cleaver of a butcher who never oiled it
    const cloud = mx_fractal_noise_float(position.mul(26), 4, 2.1, 0.5).mul(0.5).add(0.5)
    const blotches = cloud.smoothstep(float(0.76).sub(patina * 0.32), float(0.9).sub(patina * 0.26)).mul(float(1).sub(polish)).toVar('steelBlotches')
    const freckles = mx_noise_float(position.mul(310)).smoothstep(0.55, 0.8).mul(float(1).sub(polish)).mul(patina)
    const footprint = max(position.x.fwidth(), position.y.fwidth())
    const dents = mx_noise_float(position.mul(55)).mul(visibleDetail(footprint, 0.02))
    const steel = vec3(...steelReflectance).mul(float(0.9).add(polish.mul(0.12)))
    const dull = mix(steel, color('#3a3d40'), blotches.mul(0.6).add(freckles.mul(0.3)))
    this.colorNode = mix(dull, color('#060505'), hole)
    this.metalnessNode = float(1).sub(hole)
    this.roughnessNode = mix(float(0.3).sub(polish.mul(0.14)).add(blotches.mul(0.3)).add(freckles.mul(0.1)), float(0.95), hole)
    this.normalNode = heightNormal(dents.mul(0.00012).mul(float(1).sub(polish)))
  }
}
