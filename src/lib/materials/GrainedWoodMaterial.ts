import {attribute, bumpMap, color, float, mix, mx_noise_float, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

export type GrainedWoodColors = {
  /** the heartwood’s darker and lighter figure */
  heartwood: readonly [dark: number, light: number]
  /** the thin latewood lines of the growth rings */
  latewood: number
}

/**
 * Oiled joinery whose grain the geometry lays out piece by piece.
 *
 * Geometry supplies the grain through the `woodGrain` attribute: meters along the fibers, meters across them and a per-piece seed, see {@link withWoodGrain}. Stiles, rails, boards and legs therefore each show their own grain direction, and no two pieces share the same figure.
 */
export default class GrainedWoodMaterial extends MeshStandardNodeMaterial {
  constructor({heartwood: [dark, light], latewood}: GrainedWoodColors, {roughness = 0.42, envMapIntensity = 0.6} = {}) {
    super({
      roughness,
      envMapIntensity,
    })
    const grain = attribute<'vec3'>('woodGrain', 'vec3')
    const along = grain.x
    const across = grain.y
    const seed = grain.z.mul(37)
    // Slow meander of the growth rings, stretched along the fibers.
    const meander = mx_noise_float(vec3(along.mul(0.9), across.mul(4), seed))
    const ringPhase = across.mul(120).add(meander.mul(8))
    // Thin latewood lines fade to their average before they can shimmer.
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(4), float(0.27), ringPhase.fwidth().smoothstep(0.8, 2.4))
    const poreCoordinate = vec3(along.mul(5), across.mul(420), seed.add(11))
    const pores = mix(mx_noise_float(poreCoordinate).mul(0.5).add(0.5), float(0.5), across.mul(420).fwidth().smoothstep(0.6, 2))
    const figure = mx_noise_float(vec3(along.mul(1.6), across.mul(9), seed.add(5))).mul(0.5).add(0.5)
    const tone = mx_noise_float(vec3(seed, seed.mul(0.37), 3.1)).mul(0.12).add(1)
    const heart = mix(color(dark), color(light), figure)
    this.colorNode = mix(heart, color(latewood), rings.mul(0.45)).mul(pores.mul(0.22).add(0.89)).mul(tone)
    this.roughnessNode = pores.mul(0.14).add(rings.mul(0.06)).add(roughness - 0.06)
    this.normalNode = bumpMap(pores.mul(0.6).add(rings.mul(0.4)), float(0.0025))
  }
}
