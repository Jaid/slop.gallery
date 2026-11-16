import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import ImpastoOrbMaterial from './ImpastoOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A sculpture of thick paint strokes turning in clear glass. Unlike the Paint Orb’s broad painting styles, every use asks specifically for digital impasto without changing the work’s content. */
export default class ImpastoOrb extends PromptOrb {
  override readonly adjectiveCounts = [6]
  readonly adjectives = ['high-quality', 'detailed', 'cohesive', 'atmospheric', 'tactile', 'bold']
  readonly change = 'restyle it as a digital impasto artwork while keeping the original content intact. Preserve the subjects, composition and recognizable details; change only the painting technique. Use thick palette-knife strokes, raised paint ridges and sculptural highlights. The result should be'
  readonly color = '#ed9364'
  override readonly conjunction = 'and'
  override readonly effect = 'strokes'
  override readonly frame = 'canvas'
  readonly id = 'impasto'
  readonly mood = 'impasto'
  readonly photo = photo
  readonly premise = 'This picture is being repainted in digital impasto, not reimagined as a different scene.'
  readonly title = 'Impasto Orb'

  createMaterial(options: OrbGlassOptions) {
    return new ImpastoOrbMaterial(options)
  }
}
