import hsl from 'okhsl'
import {color, float, max, mix, mx_noise_float, normalGeometry, positionGeometry, select, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from './filters.ts'

/**
 * Dark, oil-stained hand-hewn timber for beams, mantel, furniture frames and the joinery around doors and walls.
 *
 * The grain is solid and mapped in each mesh’s own frame along the horizontal axis that lies in the face, so it turns with rotated furniture: pieces built along x read along x, faces turned toward x read along z. Shallow adze facets ripple across the faces and flatten before they could shimmer.
 */
export default class LodgeTimberMaterial extends MeshStandardNodeMaterial {
  constructor({light = hsl.integer(57, 53, 28), dark = hsl.integer(52, 47, 14)}: {
    dark?: number
    light?: number
  } = {}) {
    super({
      roughness: 0.6,
      envMapIntensity: 0.3,
    })
    const p = positionGeometry
    const n = normalGeometry
    const facesX = n.x.abs().greaterThan(n.z.abs())
    const along = select(facesX, p.z, p.x).toVar('timberAlong')
    const across = select(facesX, p.x, p.z)
    // Rift-sawn grain: nearly straight lines that wander slowly along the piece.
    const meander = mx_noise_float(vec3(along.mul(0.5), p.y.mul(3), across.mul(3))).mul(7)
    const ringPhase = p.y.add(across.mul(0.6)).mul(110).add(meander)
    const rings = mix(ringPhase.sin().mul(0.5).add(0.5).pow(4), float(0.22), ringPhase.fwidth().smoothstep(0.8, 2.4))
    const figure = mx_noise_float(vec3(along.mul(0.8), p.y.mul(7), across.mul(7))).mul(0.5).add(0.5)
    const poreCoordinate = p.y.add(across).mul(420)
    const pores = mix(mx_noise_float(vec3(along.mul(5), poreCoordinate, 3.3)).mul(0.5).add(0.5), float(0.5), poreCoordinate.fwidth().smoothstep(0.6, 2))
    const tone = mx_noise_float(vec3(along.mul(0.15), across.mul(0.15), 9.4)).mul(0.12).add(1)
    const wood = mix(color(dark), color(light), figure)
    this.colorNode = mix(wood, color(dark).mul(0.6), rings.mul(0.5)).mul(pores.mul(0.2).add(0.9)).mul(tone)
    this.roughnessNode = pores.mul(0.12).add(rings.mul(0.06)).add(0.5)
    // Adze facets: broad, shallow scoops along the piece, plus the open pores.
    const footprint = max(along.fwidth(), p.y.fwidth())
    const adzePhase = along.div(0.11).add(mx_noise_float(vec3(along.mul(2), p.y.mul(2), across.mul(2))).mul(1.4))
    const facets = adzePhase.sin().mul(0.0015).mul(visibleDetail(footprint, 0.05))
    this.normalNode = heightNormal(facets.add(pores.mul(0.00015)))
  }
}
