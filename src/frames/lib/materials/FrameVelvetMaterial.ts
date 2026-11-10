import {color, float, max, mix, mx_noise_float, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'

import {frameSurface} from './frameAttributes.ts'

/** a velvet’s colors, as sRGB hex: the pile where it stands, where it is crushed flat and the glow at grazing angles */
export type FrameVelvet = {
  crushed: string
  pile: string
  sheen: string
}

export const oxblood: FrameVelvet = {
  pile: '#4a040e',
  crushed: '#86101f',
  sheen: '#d4243c',
}

/**
 * Velvet for the liners, slips and upholstery of frames: pile brushed along each member, crushed lighter in drifting patches, with a soft sheen at grazing angles instead of a highlight. The nap fades to its average before it could shimmer.
 */
export default class FrameVelvetMaterial extends MeshPhysicalNodeMaterial {
  constructor(velvet: FrameVelvet = oxblood) {
    super({
      roughness: 0.85,
      sheen: 1,
      sheenRoughness: 0.4,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    const patches = mx_noise_float(vec3(surface.along.mul(9), surface.across.mul(14), surface.member.mul(3))).mul(0.5).add(0.5).smoothstep(0.35, 0.75)
    const nap = mx_noise_float(vec3(surface.along.mul(30), surface.across.mul(900), surface.member)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.002))
    const hollow = surface.cavity.smoothstep(0, 0.8)
    this.colorNode = mix(color(velvet.pile), color(velvet.crushed), patches.mul(0.6).add(nap.mul(0.25))).mul(float(1).sub(hollow.mul(0.35)))
    this.sheenNode = color(velvet.sheen).mul(patches.mul(0.5).add(0.5))
    this.roughnessNode = float(0.9).sub(patches.mul(0.15))
    this.normalNode = heightNormal(nap.mul(0.00008))
  }
}
