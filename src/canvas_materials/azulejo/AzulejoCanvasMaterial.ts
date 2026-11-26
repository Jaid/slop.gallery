import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import {fades, millimeters} from '../lib/influence.ts'
import paintAzulejo, {bevel, groutWidth, melt, pitch} from './paintAzulejo.ts'

/** Painted tin-glazed tiles, each tilted and bowed a little its own way, so each mirrors the lamp and the room on its own. */
export default class AzulejoCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Azulejo: the picture painted across glazed tiles set in grout, each tilted and bowed a little by the kiln, so each mirrors the light on its own.'
  /** how glossy the glaze is, from a satin glaze at 0 to glassy at 1 */
  readonly glaze = 0.9
  /** how wide the grout between the tiles is, against what it was made with */
  readonly grout = 0.1
  override readonly strength = 0.5
  override readonly title = 'Azulejo'
  /** how far each tile tilts and bows its own way, against what it was made with */
  readonly warp = 1

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: `grout no narrower than a pixel, but as dark over it as it is wide; the tiles’ rounded edges fade out at ${fades(bevel, this.scale)}`,
      },
      {
        base: 'light',
        description: `tiles ${millimeters(this.scale * pitch)} apart, each tilted and bowed its own way under a glossy glaze, so each catches the lamp and mirrors the room on its own; rounded edges glint, the grout is matte`,
      },
      {
        base: 'texture',
        description: `RGB painted into the glaze, softened over ${millimeters(melt)} and cut by ${millimeters(this.scale * this.grout * groutWidth)} of grout, each tile fired a little warmer or cooler`,
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface) {
    paintAzulejo(material, surface, {
      glaze: this.glaze,
      grout: this.grout,
      scale: this.scale,
      warp: this.warp,
    })
  }
}
