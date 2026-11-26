import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import {millimeters} from '../lib/influence.ts'
import paintDiamondDust, {grainPitch} from './paintDiamondDust.ts'

/** Crushed glass strewn over a silkscreen print, each grain a facet at a tilt of its own that flashes wherever it mirrors a lamp into the eye. */
export default class DiamondDustCanvasMaterial extends CanvasMaterial {
  /** how many of the places a grain could lie hold one, from none at 0 to all at 1 */
  readonly density = 0.3
  override readonly description = 'Diamond dust: crushed glass strewn over a silkscreen print, each grain a tilted facet that flashes as the light or the eye moves, a little colored by its fire.'
  /** how much each grain splits the light into a color of its own, from white flashes at 0 to fully colored at 1 */
  readonly fire = 0.5
  /** how much the glue the dust sticks to follows the dark ink, from everywhere alike at 0 to only where the ink is darkest at 1 */
  readonly glue = 0.9
  override readonly strength = 0.7
  override readonly title = 'Diamond dust'

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: `grains, ${millimeters(this.scale * grainPitch)} apart, flash one by one while they span a couple of pixels; from afar each flash is one grain standing for all it covers, a little rougher`,
      },
      {
        base: 'light',
        description: 'each grain is a glass facet at a tilt of its own that flashes where it mirrors a lamp or the room into the eye, a little colored by its fire; the ink between them is matte',
      },
      {
        base: 'texture',
        description: 'RGB as matte silkscreen ink, a little milky under the grains; with glue, luminance: the dust clings most to dark ink',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface) {
    paintDiamondDust(material, surface, {
      density: this.density,
      fire: this.fire,
      glue: this.glue,
      scale: this.scale,
    })
  }
}
