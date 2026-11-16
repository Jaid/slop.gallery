import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import PaintsOrbMaterial from '../paint/PaintsOrbMaterial.ts'
import photo from '../paint/photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A thick, tactile painting gesture: it builds the portrait back up in layered digital impasto without losing the original subject. */
export default class ImpastoOrb extends PromptOrb {
  readonly adjectives = [
    ['layered', 'textured'],
    ['luminous', 'radiant'],
    ['bold', 'dramatic'],
    ['cohesive', 'unified'],
    ['atmospheric', 'moody'],
    ['detailed', 'meticulously rendered'],
    ['vivid', 'rich'],
  ]
  readonly change = 'change to a high-quality detailed cohesive atmospheric tactile bold digital impasto artwork while keeping the original content intact'
  readonly color = '#7da8ff'
  override readonly conjunction = 'and'
  override readonly effect = 'strokes'
  readonly frame = ['canvas', 'marbled'] as const
  readonly id = 'impasto'
  override readonly mood = 'paint'
  readonly photo = photo
  readonly premise = 'This picture is in a painter’s studio – the artist is building it up in thick, tactile layers of digital paint.'
  readonly title = 'Impasto Orb'

  createMaterial(options: OrbGlassOptions) {
    return new PaintsOrbMaterial(options)
  }
}
