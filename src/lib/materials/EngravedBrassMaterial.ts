import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, luminance, mix, mx_noise_float, normalGeometry, positionLocal, texture, vec2, vec3} from 'three/tsl'

import engravedPlate from '../gallery/engravedPlate.ts'
import MaterialOutputsNode from '../rendering/MaterialOutputsNode.ts'
import BrassMaterial, {brassColor} from './BrassMaterial.ts'
import {heightNormal, visibleDetail} from './filters.ts'

/** how far apart the streaks of the brushing run, across the plate’s length */
const streaks = 1 / 1500

/**
 * Brushed brass engraved like a plaque, for a plate made by `EngravedPlate`, centered on its local origin with its face toward +z. `lettering`, white where the graver cut, spans the face; the cuts are filled with black wax, matte and not metal, and their walls catch the light along every letter.
 * The brushing and the cuts’ walls fade before they could shimmer, so from afar only the black lettering on satin brass remains.
 */
export default class EngravedBrassMaterial extends BrassMaterial {
  constructor(lettering: Texture) {
    super()
    this.name = 'Engraved brass'
    const [width, height] = engravedPlate.size
    const p = positionLocal
    const face = normalGeometry.z.smoothstep(0.5, 0.9)
    const cut = texture(lettering, p.xy.div(vec2(width, height)).add(0.5)).r.mul(face).toVar('engravedCut')
    const footprint = p.x.fwidth().max(p.y.fwidth())
    const brushed = mx_noise_float(vec3(p.x.mul(20), p.y.div(streaks), p.z.mul(20))).mul(visibleDetail(footprint, streaks))
    const reflectance = mix(color(brassColor), color(hsl.integer(73, 18, 9)), cut)
    const metalness = cut.oneMinus()
    // Satin rather than polished, so the floor it faces mirrors in it only as a soft glow behind the lettering.
    const roughness = mix(float(0.38).add(brushed.mul(0.06)), float(0.65), cut)
    this.colorNode = reflectance
    this.metalnessNode = metalness
    this.roughnessNode = roughness
    this.normalNode = heightNormal(cut.mul(-engravedPlate.depth).mul(visibleDetail(footprint, 0.002)))
    // The screen-space reflections weigh what they add by metalness alone, which would mirror the terrazzo’s chips over the lettering as brightly as in gold; they get brass’ dimmer reflectance instead, and none in the cuts.
    this.mrtNode = new MaterialOutputsNode({metalrough: vec2(luminance(reflectance).mul(metalness), roughness)})
  }
}
