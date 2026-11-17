import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import KnifeworkOrbMaterial from './KnifeworkOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A lump of heavy paint sculpted with a palette knife, hanging in clear oil. It has a work redone as a bold digital impasto artwork of its own content, every prompt asking for all of the traits it names, and an unseen palette knife slaps thick smears of paint into the air around the portal as the result flips out. */
export default class ImpastoOrb extends PromptOrb {
  readonly adjectives = [
    // craft
    ['detailed', 'richly detailed', 'intricately detailed'],
    ['cohesive', 'unified'],
    // light and color
    ['atmospheric', 'evocative'],
    ['luminous', 'vibrant', 'richly colored'],
    // surface
    'tactile',
    ['thickly layered', 'heavily textured', 'sculptural'],
    // gesture
    'bold',
    ['expressive', 'gestural'],
  ]
  readonly change = 'change it to a high-quality digital impasto artwork while keeping the original content intact. The artwork should be'
  readonly color = '#1fb5ad'
  override readonly conjunction = 'and'
  override readonly effect = 'smears'
  readonly frame = ['impasto', 'palette'] as const
  readonly id = 'impasto'
  readonly mood = 'impasto'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and a digital painter has just loaded a palette knife with thick paint to sculpt it anew.'
  readonly title = 'Impasto Orb'

  createMaterial(options: OrbGlassOptions) {
    return new KnifeworkOrbMaterial(options)
  }
}
