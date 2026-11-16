import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import ImpastoOrbMaterial from './ImpastoOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** Heavy, sculpted palette-knife slabs of oil paint suspended in clear golden medium. It reworks a portrait into a tactile, atmospheric digital impasto artwork while keeping the original content intact, and unseen palette knives fling thick impasto daubs into the air around the portal as the result flips out. */
export default class ImpastoOrb extends PromptOrb {
  readonly adjectives = [
    // craft & detail
    'detailed',
    ['intricately worked', 'meticulously sculpted'],
    // surface & relief
    'tactile',
    ['thickly layered', 'heavily built-up'],
    ['palette-knife textured', 'knife-worked'],
    ['richly ridged', 'deeply relieved'],
    // brushwork & boldness
    'bold',
    ['expressive', 'vigorous'],
    ['gestural', 'viscerally textured'],
    // color & light
    ['chromatically rich', 'deeply pigmented'],
    ['luminous', 'raking-lit'],
    ['chiaroscuro-lit', 'dramatically shaded'],
    // atmosphere & cohesion
    'atmospheric',
    ['cohesive', 'unified'],
    'dimensional',
  ]
  readonly change = 'change it into a high-quality digital impasto artwork while keeping the original content intact, making it'
  readonly color = '#e69f1a'
  override readonly conjunction = 'and'
  override readonly effect = 'daubs'
  readonly frame = ['impasto', 'palette'] as const
  readonly id = 'impasto'
  readonly mood = 'impasto'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and an impasto painter has taken up the palette knife to sculpt it anew in thick relief.'
  readonly title = 'Impasto Orb'

  createMaterial(options: OrbGlassOptions) {
    return new ImpastoOrbMaterial(options)
  }
}
