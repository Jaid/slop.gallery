import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import hsl from 'okhsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

/** polished brass’ reflectance */
export const brassColor = hsl.integer(78, 63, 64)

/**
 * Polished brass, wholly metal: without a diffuse color, the lamps’ yellow light cannot flatten it into ochre paint. All it shows is its reflection, of a softly lit studio like the gold’s instead of the gallery’s dim, olive-tinted environment, tinted by brass’ deeper, browner reflectance.
 */
export default class BrassMaterial extends MeshStandardNodeMaterial {
  private readonly studio = new StudioEnvironment

  constructor() {
    super({
      color: brassColor,
      metalness: 1,
      roughness: 0.24,
      envMapIntensity: 0.45,
    })
    this.name = 'Polished brass'
    this.envMap = this.studio
  }

  override dispose() {
    this.studio.dispose()
    super.dispose()
  }
}
