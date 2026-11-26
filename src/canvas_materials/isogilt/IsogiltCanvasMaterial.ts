import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial, Node} from 'three/webgpu'

import {float, luminance, mix, texture, uv, vec2, vec3} from 'three/tsl'

import {heightNormal, inside} from '#src/lib/materials/filters.ts'

import CanvasMaterial from '../base/CanvasMaterial.ts'

/** how far around a point the foil reads the picture’s tone, in meters, so its contours follow the same shapes on a work of any size and resolution */
const blur = 0.004
/** how many meters half the foil is wide for each unit of its width setting, as it was tuned where the tone climbs 5 per meter, typical of the pictures */
const widthScale = 0.02
/** how much of the space between two contours the foil fills at most, where they crowd too closely for its full width */
const crowded = 0.2

/** Raised brass foil tracing lines of equal brightness in the print. */
export default class IsogiltCanvasMaterial extends CanvasMaterial {
  readonly bands = 10
  readonly burnish = 0.7
  override readonly description = 'Isogilt: raised brass foil follows the picture’s brightness contours while areas of even tone stay clear.'
  override readonly strength = 0.8
  override readonly title = 'Isogilt'
  readonly width = 0.2

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: 'tone averaged over 4 mm or two pixels, whichever is wider; contours fade where they crowd within a pixel',
      },
      {
        base: 'light',
        description: 'raised, burnished brass foil',
      },
      {
        base: 'texture',
        description: 'luminance over 4 mm: contours of equal tone, the foil as wide in meters wherever it runs, none where the tone is even',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, {image, map, uvPerMeter}: CanvasSurface) {
    // The tone over a patch as wide as `blur`, or two pixels from afar, and its slope per meter across twice that.
    const area = uvPerMeter.mul(blur).max(uv().fwidth().mul(2))
    const tone = (at: Node<'vec2'>) => luminance(texture(map, at.clamp()).grad(vec2(area.x, 0), vec2(0, area.y)).rgb).sqrt()
    const dx = vec2(uvPerMeter.x.mul(blur), 0)
    const dy = vec2(0, uvPerMeter.y.mul(blur))
    const slope = vec2(tone(uv().add(dx)).sub(tone(uv().sub(dx))), tone(uv().add(dy)).sub(tone(uv().sub(dy)))).length().div(2 * blur).toVar('isogiltSlope')
    const level = tone(uv()).mul(this.bands)
    const distance = level.fract().sub(0.5).abs()
    // A flat patch on a contour is not solid foil. Fade tightly packed contours before they alias into false ones.
    const resolved = level.fwidth().smoothstep(0.17, 0.48).oneMinus().mul(slope.smoothstep(0.08, 0.7))
    // The foil is as wide in meters wherever it runs, in steps of tone as far as the tone climbs across that width.
    const halfWidth = slope.mul(this.bands * (this.width * 0.16 + 0.027) * widthScale).min(crowded).max(0.00001).toVar('isogiltHalfWidth')
    const foil = inside(distance.sub(halfWidth)).mul(resolved).toVar('isogiltFoil')
    const crown = distance.div(halfWidth).clamp().oneMinus().mul(resolved)
    material.colorNode = mix(image.mul(0.94), vec3(0.88, 0.48, 0.115), foil)
    material.normalNode = heightNormal(crown.mul(0.00085))
    material.metalnessNode = foil.mul(0.86)
    material.roughnessNode = mix(float(0.87), float(0.6 - this.burnish * 0.43), foil)
  }
}
