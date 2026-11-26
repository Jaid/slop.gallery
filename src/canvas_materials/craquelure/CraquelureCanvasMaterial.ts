import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import {fades, millimeters} from '../lib/influence.ts'
import paintCraquelure, {islandSize} from './paintCraquelure.ts'

/** Aged oil paint under yellowed varnish, broken into cupped islands a few millimeters across with grime in the cracks between them. */
export default class CraquelureCanvasMaterial extends CanvasMaterial {
  /** how wide the cracks are, against what they were made with */
  readonly cracks = 2
  /** how far the islands curl up at their edges and tilt, against what they were made with */
  readonly cupping = 1
  override readonly description = 'Craquelure: aged oil paint broken into cupped islands that each catch the light on their own, grime in the cracks, under yellowed varnish.'
  override readonly scale = 0.5
  override readonly strength = 0.5
  override readonly title = 'Craquelure'
  /** how far the varnish has yellowed, from clear at 0 to deep amber at 1 */
  readonly varnish = 0

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: `cracks no narrower than a pixel, but as dark over it as they are wide; the islands’ tilts fade out at ${fades(islandSize, this.scale)}`,
      },
      {
        base: 'light',
        description: `islands about ${millimeters(this.scale * islandSize)} across curl up at their edges and tilt their own ways, so each catches the lamp on its own, under a glossy varnish; the cracks are matte`,
      },
      {
        base: 'texture',
        description: 'RGB under yellowed varnish; the grime in the cracks darkens light paint and lightens black',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface) {
    paintCraquelure(material, surface, {
      cracks: this.cracks,
      cupping: this.cupping,
      scale: this.scale,
      varnish: this.varnish,
    })
  }
}
