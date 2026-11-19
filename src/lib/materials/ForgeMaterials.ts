import type {Wall} from '../placement/wallGeometry.ts'

import {forgeVestibule} from '../gallery/forge.ts'
import ForgeBrickMaterial from './ForgeBrickMaterial.ts'
import ForgeStoneMaterial from './ForgeStoneMaterial.ts'

/** The Forge’s masonry materials: flat kiln-fired brick for the main hall’s walls, seamless ring brick for the round vestibule and honed dark bluestone for baseboards, casings, cornices and reveals. Released together. */
export default class ForgeMaterials {
  readonly brick = new ForgeBrickMaterial
  readonly stone = new ForgeStoneMaterial
  readonly vestibuleBrick = new ForgeBrickMaterial({curveRadius: forgeVestibule.radius})

  dispose() {
    this.brick.dispose()
    this.vestibuleBrick.dispose()
    this.stone.dispose()
  }

  /** the brickwork for a Forge wall, flat or curved around the vestibule */
  surface(wall: Wall) {
    return wall.curveRadius ? this.vestibuleBrick : this.brick
  }
}
