import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import hsl from 'okhsl'
import {color, luminance, mix, mx_noise_float, positionLocal, vec2} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import MaterialOutputsNode from '../rendering/MaterialOutputsNode.ts'
import {heightNormal} from './filters.ts'

/**
 * Cast gunmetal, like an antique crystal ball stand: dark, slightly bluish gray metal, rubbed brighter in places and dulled to near black in others, with the faint grain of its casting.
 *
 * Wholly metal, without a diffuse color: lamps as yellow as the chandeliers’ candles would turn any diffuse gray olive. All it shows is its reflection, of a softly lit studio like the gold’s instead of the gallery’s dim, olive-tinted environment, dark gray but for the softboxes’ streaks and the glints of the lamps.
 * Its variation follows local meters, so it stays put on an instanced or carried object.
 */
export default class GunmetalMaterial extends MeshStandardNodeMaterial {
  private readonly studio = new StudioEnvironment

  constructor() {
    super({
      metalness: 1,
      roughness: 0.42,
      envMapIntensity: 1,
    })
    this.envMap = this.studio
    const rubbed = mx_noise_float(positionLocal.mul(9)).mul(0.5).add(0.5).smoothstep(0.3, 0.85)
    const grain = mx_noise_float(positionLocal.mul(260))
    const reflectance = mix(color(hsl.integer(261, 12, 13)), color(hsl.integer(262, 11, 29)), rubbed.mul(0.7))
    this.colorNode = reflectance
    const roughness = rubbed.mul(-0.1).add(grain.mul(0.03)).add(0.44)
    this.roughnessNode = roughness
    this.normalNode = heightNormal(grain.mul(0.00008))
    // The screen-space reflections weigh what they add by metalness alone, which would mirror the bright pedestal and the candles in it as brightly as in gold; they get its dim reflectance instead.
    this.mrtNode = new MaterialOutputsNode({metalrough: vec2(luminance(reflectance), roughness)})
  }

  override dispose() {
    this.studio.dispose()
    super.dispose()
  }
}
