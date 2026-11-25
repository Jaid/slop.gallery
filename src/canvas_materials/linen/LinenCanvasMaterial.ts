import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import paintLinen from './paintLinen.ts'

/** Linen canvas: the paint sinks between warp and weft, which cross over and under each other, and the unbleached threads show through where it lies thin. */
export default class LinenCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Loom linen: paint sunk into a plain weave of warp and weft, with bare, unbleached threads showing through in its shadows.'
  /** how much of the bare threads shows, against what it was made with */
  readonly fibers = 0.7
  /** how deep the weave is, against what it was made with */
  readonly relief = 2
  override readonly scale = 0.5
  /** how strongly the threads catch grazing light */
  readonly sheen = 0.1
  override readonly strength = 0.1
  override readonly title = 'Loom linen'

  protected override paint(material: MeshPhysicalNodeMaterial, {image, position}: CanvasSurface) {
    paintLinen(material, image, position, this)
  }
}
