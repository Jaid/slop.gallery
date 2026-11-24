import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {float, luminance, mix, texture, uv, vec3} from 'three/tsl'

import {heightNormal, inside} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** Raised brass foil tracing lines of equal brightness in the print. */
export default class IsogiltCanvasMaterial extends CanvasMaterial {
  readonly bands = 10
  readonly burnish = 0.7
  override readonly description = 'Isogilt: raised brass foil follows the picture’s brightness contours while areas of even tone stay clear.'
  override readonly strength = 0.8
  override readonly title = 'Isogilt'
  readonly width = 0.2

  protected override paint(material: MeshPhysicalNodeMaterial, {footprint, image, map}: CanvasSurface) {
    const tone = luminance(texture(map, uv()).bias(float(2)).rgb).sqrt().toVar('isogiltTone')
    const level = tone.mul(this.bands)
    const distance = level.fract().sub(0.5).abs()
    // A flat patch on a contour is not solid foil. Fade tightly packed contours before they alias into false ones.
    const gradient = tone.fwidth().div(footprint.max(0.00001))
    const resolved = level.fwidth().smoothstep(0.17, 0.48).oneMinus().mul(gradient.smoothstep(0.08, 0.7))
    const halfWidth = this.width * 0.16 + 0.027
    const foil = inside(distance.sub(halfWidth)).mul(resolved).toVar('isogiltFoil')
    const crown = distance.div(halfWidth).clamp().oneMinus().mul(resolved)
    material.colorNode = mix(image.mul(0.94), vec3(0.88, 0.48, 0.115), foil)
    material.normalNode = heightNormal(crown.mul(0.00085))
    material.metalnessNode = foil.mul(0.86)
    material.roughnessNode = mix(float(0.87), float(0.6 - this.burnish * 0.43), foil)
  }
}
