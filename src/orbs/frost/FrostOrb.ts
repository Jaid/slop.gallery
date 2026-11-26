import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import hsl from 'okhsl'

import PromptOrb from '../base/PromptOrb.ts'
import FrostOrbMaterial from './FrostOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A sculpted 3D glacial snowflake-star turning inside clear icy glass amid a swirling blizzard of cold vapor, orbiting snowflakes and diamond dust. It freezes a portrait in snow, blizzard and hoarfrost, framing it in glacier ice as a blizzard bursts out of the portal. */
export default class FrostOrb extends PromptOrb {
  readonly adjectives = [
    // weather
    ['blizzard-swept', 'snowstorm-battered', 'wind-whipped'],
    ['snow-blanketed', 'snow-buried', 'snow-laden'],
    ['flurry-filled', 'swirling with snowflakes'],
    // frost and rime
    ['frost-rimmed', 'hoarfrost-coated', 'rime-encrusted'],
    ['icicle-draped', 'icicle-fringed'],
    ['flash-frozen', 'ice-encased'],
    // texture
    ['crystalline', 'frost-etched'],
    'glittering with diamond dust',
    // cold and atmosphere
    ['sub-zero', 'frigid', 'glacial'],
    ['snow-misted', 'wreathed in freezing mist'],
    // light and color
    ['ice-blue', 'glacier-tinted'],
    ['arctic-lit', 'alpenglow-frosted'],
    // feeling
    ['wintry', 'deep-winter'],
    'bitterly cold',
  ]
  readonly change = 'transform it with snow, frost and winter weather while keeping the original subject recognizable, making it'
  readonly color = hsl.integer(230, 96, 78)
  override readonly conjunction = 'and'
  override readonly effect = 'blizzard'
  readonly frame = ['frost'] as const
  readonly id = 'frost'
  readonly mood = 'frost'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and a sudden arctic cold front has just swept over it, freezing the scene in winter.'
  readonly title = 'Frost Orb'

  createMaterial(options: OrbGlassOptions) {
    return new FrostOrbMaterial(options)
  }
}
