import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import hsl from 'okhsl'

import PromptOrb from '../base/PromptOrb.ts'
import FrostOrbMaterial from './FrostOrbMaterial.ts'
import frostPrint from './frostPrint.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

export default class FrostOrb extends PromptOrb {
  readonly adjectives = [
    ['windswept', 'lashed by spindrift'],
    ['snow-laden', 'buried in powder'],
    'rimmed with hoarfrost',
    'etched with ice ferns',
    ['glazed with clear ice', 'silvered with rime'],
    'veiled in blowing snow',
    ['lit by polar twilight', 'blue in the snow shadows'],
    'sparkling with diamond dust',
    'still at the eye of the storm',
  ]
  readonly change = 'bring a blizzard through the picture. Keep the subject, pose and composition recognizable. Build wind-packed snow on exposed surfaces and grow frost crystals along their contours rather than just tinting the image blue. Make the scene'
  readonly color = hsl.integer(218, 88, 82)
  override readonly conjunction = 'and'
  override readonly effect = 'flurry'
  override readonly frame = 'acrylic'
  readonly id = 'frost'
  readonly mood = 'frost'
  readonly photo = photo
  readonly premise = 'The first snow crystal has landed inside this picture. A whole winter follows it.'
  readonly title = 'Frost Orb'

  createMaterial(options: OrbGlassOptions) {
    return new FrostOrbMaterial(options)
  }

  override ingredient(seed: number) {
    return {
      ...super.ingredient(seed),
      finishTint: (paper: OffscreenCanvasRenderingContext2D) => frostPrint(paper, seed),
    }
  }
}
