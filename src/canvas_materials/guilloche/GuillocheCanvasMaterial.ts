import type {CanvasSurface} from '../lib/canvasSurface.ts'
import type {Influence} from '../lib/influence.ts'
import type {MeshPhysicalNodeMaterial} from 'three/webgpu'

import CanvasMaterial from '../base/CanvasMaterial.ts'
import {fades, millimeters} from '../lib/influence.ts'
import paintGuilloche, {groovePitch, waveLength} from './paintGuilloche.ts'

/** Translucent enamel fired over engine-turned silver, whose grooves stretch every highlight across them, so bands of light run over their waves as the lamp moves. */
export default class GuillocheCanvasMaterial extends CanvasMaterial {
  override readonly description = 'Guilloché enamel: the picture as translucent enamel over engine-turned silver, whose waves of grooves send bands of light through its colors as the lamp moves.'
  /** how sharply the engine-turned grooves stretch the silver’s highlights across them, against what they were made with */
  readonly engine = 1
  override readonly scale = 0.8
  /** how much of the silver ground shows through the enamel, from none at 0 to all of it at 1 */
  readonly silver = 0.5
  override readonly strength = 0.7
  override readonly title = 'Guilloché enamel'
  /** how far the grooves swing in their waves, against what they were made with */
  readonly waves = 1.5

  override get influences(): ReadonlyArray<Influence> {
    return [
      {
        base: 'distance',
        description: `grooves, ${millimeters(this.scale * groovePitch)} apart, fade out at ${fades(groovePitch, this.scale)} into the stretched sheen they make`,
      },
      {
        base: 'light',
        description: `the silver stretches every highlight across its grooves, whose waves, ${millimeters(this.scale * waveLength)} long, fold into chevrons, so bands of light run over them as the lamp moves; a glassy enamel mirrors the room over it`,
      },
      {
        base: 'texture',
        description: 'RGB as translucent enamel, deepened where dark, the silver glowing through where light',
      },
    ]
  }

  protected override paint(material: MeshPhysicalNodeMaterial, surface: CanvasSurface) {
    paintGuilloche(material, surface, {
      engine: this.engine,
      scale: this.scale,
      silver: this.silver,
      waves: this.waves,
    })
  }
}
