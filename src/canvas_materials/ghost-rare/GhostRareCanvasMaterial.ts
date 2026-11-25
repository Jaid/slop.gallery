import type {FoilSurface} from '../base/FoilCanvasMaterial.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {luminance, mix, texture, uv, vec2, vec3} from 'three/tsl'

import FoilCanvasMaterial from '../base/FoilCanvasMaterial.ts'

/** A latent image in a pearl laminate: the key reveals the registered print, with a displaced blue and rose rim on the ghost. */
export default class GhostRareCanvasMaterial extends FoilCanvasMaterial {
  override readonly description = 'Ghost rare: a pearl-gray latent image with blue and rose relief gives way to the original colors where the lamp is reflected.'
  readonly relief = 1
  override readonly strength = 0.8
  override readonly title = 'Ghost rare'
  readonly veil = 0.9
  readonly window = 1

  protected override coat(material: MeshPhysicalNodeMaterial, {facing, half, image, luminance: tone, map, position, uvPerMeter}: FoilSurface) {
    const delta = position.x.mul(0.58).add(position.y.mul(0.18)).sub(half.x.mul(1.65)).add(half.y.mul(0.36))
    const reveal = delta.abs().div(this.window * 0.47 + 0.08).smoothstep(0.06, 1).oneMinus().mul(facing)
    const hidden = reveal.oneMinus().mul(this.veil)
    const offset = half.xy.mul(0.012).add(vec2(0.0008, 0.0004)).mul(this.relief).mul(uvPerMeter)
    // Over a patch 2 mm wide, or two pixels from afar.
    const area = uvPerMeter.mul(0.002).max(uv().fwidth().mul(2))
    const shoulder = (sign: number) => luminance(texture(map, uv().add(offset.mul(sign)).clamp()).grad(vec2(area.x, 0), vec2(0, area.y)).rgb).sqrt()
    const edge = shoulder(1).sub(shoulder(-1)).mul(2.25).clamp(-1, 1)
    const pearl = vec3(0.64, 0.71, 0.79).mul(tone.sqrt().mul(0.38).add(0.47))
    const rim = vec3(0.06, 0.48, 0.95).mul(edge.max(0)).add(vec3(0.95, 0.22, 0.44).mul(edge.negate().max(0)))
    material.colorNode = mix(image, pearl.add(rim), hidden)
    material.metalnessNode = hidden.mul(0.24)
    material.roughnessNode = hidden.mul(-0.18).add(0.53)
    material.iridescenceNode = hidden.mul(0.3)
    material.clearcoat = 0.24
    material.clearcoatRoughness = 0.28
  }
}
