import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import {fades} from '../lib/influence.ts'
import paintRag from './paintRag.ts'

/** Cold-pressed cotton rag paper: the ink settles into the tooth’s tiny hollows while flecks of cotton on its crests keep their light. */
export default class RagCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Cold-press rag: cotton paper whose tooth holds the ink in its hollows while flecks of cotton on its crests stay pale.'
  /** how much the cotton on the crests shows, against what it was made with */
  readonly flecks = 1
  override readonly scale = 0.2
  /** how crisply the tooth’s crests break into its hollows, from the soft felt it was made with at 0 to edges as narrow as the pixels can draw at 1 */
  readonly sharpness = 0.5
  override readonly strength = 0.8
  override readonly title = 'Cold-press rag'
  /** how deep the paper’s tooth is, against what it was made with */
  readonly tooth = 2
  protected override readonly weight = 0.63

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: `tooth and flecks fade out at ${fades(0.008, this.scale)}; slopes read across the pixel footprint, no edge narrower than a pixel`,
      },
      {
        base: 'light',
        description: 'tooth relief, almost fully matte',
      },
      {
        base: 'texture',
        description: 'RGB, darker in the hollows, pale cotton flecks on the crests',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, {fine, footprint, image, position}: CanvasSurface) {
    paintRag(material, image, position, footprint, fine, {
      flecks: this.flecks,
      scale: this.scale,
      sharpness: this.sharpness,
      tooth: this.tooth,
    })
  }
}
