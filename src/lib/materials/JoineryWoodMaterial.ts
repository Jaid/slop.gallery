import hsl from 'okhsl'
import {color, float, hash, mix, modelWorldMatrix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec3, vec4} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

export type JoineryWoodOptions = {
  colors?: {
    dark: number
    light: number
    ring: number
  }
  /** the mesh’s local axis the fibers run along, such as a wall’s length or a beam’s span */
  grain?: 'x' | 'y' | 'z'
  roughness?: number
  seed?: number
}

const walnut = {
  dark: hsl.integer(46, 49, 13),
  light: hsl.integer(52, 54, 28),
  ring: hsl.integer(51, 46, 8),
}
const axes = {
  x: vec4(1, 0, 0, 0),
  y: vec4(0, 1, 0, 0),
  z: vec4(0, 0, 1, 0),
}

/**
 * Satin-varnished dark wood for paneling, moldings and beams, without any texture or grain attribute.
 *
 * The fibers run along one local axis of each mesh, so a material shared by every wall lines the grain up with whichever wall it is on. The figure is mapped in world space, so neighbors never repeat each other, and each mesh gets its own tone from its position. Rings and pores fade to their average before they could shimmer.
 */
export default class JoineryWoodMaterial extends MeshStandardNodeMaterial {
  constructor({colors = walnut, grain = 'x', roughness = 0.46, seed = 0}: JoineryWoodOptions = {}) {
    super({
      roughness,
      envMapIntensity: 0.7,
    })
    const fiber = modelWorldMatrix.mul(axes[grain]).xyz.normalize().toVar('joineryFiber')
    const n = normalWorldGeometry
    // Across the fibers, within the face; end grain falls back to a level direction so it still shows rings.
    const crossing = n.cross(fiber)
    const endGrain = crossing.length().lessThan(0.3)
    const across = select(endGrain, n.cross(vec3(0, 1, 0)).add(vec3(0.0001, 0, 0)).normalize(), crossing.normalize())
    const along = positionWorld.dot(fiber).toVar('joineryAlong')
    const depth = positionWorld.dot(across).toVar('joineryAcross')
    // Every mesh is its own piece of timber.
    const origin = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz
    const piece = hash(origin.x.mul(7.31).add(origin.y.mul(3.17)).add(origin.z.mul(5.93)).abs().mul(97).floor().add(10_007 + seed * 7919))
    const pieceSeed = piece.mul(91).add(seed)
    const footprint = along.fwidth().max(depth.fwidth()).toVar('joineryFootprint')
    const meander = mx_noise_float(vec3(along.mul(0.6), depth.mul(4), pieceSeed)).mul(6).add(mx_noise_float(vec3(along.mul(3), depth.mul(14), pieceSeed.add(3))).mul(1.2))
    const ringPhase = depth.mul(95).add(meander).toVar('joineryRings')
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(4), float(0.2), ringPhase.fwidth().smoothstep(0.8, 2.4))
    const porePhase = depth.mul(420)
    const pores = mix(mx_noise_float(vec3(along.mul(5), porePhase, pieceSeed.add(11))).mul(0.5).add(0.5), float(0.5), porePhase.fwidth().smoothstep(0.6, 2))
    const figure = mx_noise_float(vec3(along.mul(1.2), depth.mul(8), pieceSeed.add(5))).mul(0.5).add(0.5)
    const tone = piece.mul(0.08).add(0.96)
    const timber = mix(color(colors.dark), color(colors.light), figure.mul(0.85).add(piece.mul(0.15)))
    this.colorNode = mix(timber, color(colors.ring), rings.mul(0.5)).mul(pores.mul(0.2).add(0.9)).mul(tone)
    this.roughnessNode = float(roughness).add(pores.mul(0.1)).sub(rings.mul(0.05))
    this.normalNode = heightNormal(pores.mul(0.00012).add(rings.mul(0.00008)).mul(visibleDetail(footprint, 0.004)))
  }
}
