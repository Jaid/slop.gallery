import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import EyeOrbMaterial from './EyeOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A bloodshot eye bleeding into its liquid. It corrupts a work into something disturbing, and the portal spurts blood as the result flips out. */
export default class HorrorOrb extends PromptOrb {
  readonly adjectives = [
    // unease
    ['unsettling', 'disturbing'],
    ['creepy', 'eerie'],
    ['uncanny', 'liminal'],
    'haunting',
    'paranormal',
    // threat
    ['sinister', 'menacing'],
    ['nightmarish', 'dread-filled'],
    'claustrophobic',
    // madness
    ['delirious', 'feverish'],
    ['deranged', 'unhinged'],
    ['distorted', 'twisted'],
    // shock
    'shocking',
    ['macabre', 'morbid'],
    'grotesque',
    // decay
    ['decaying', 'putrid'],
    // blood
    ['gory', 'bloodstained', 'visceral'],
  ]
  readonly change = 'provide traits that make it'
  readonly color = '#a8060f'
  override readonly effect = 'blood'
  readonly frame = ['flesh', 'bleeding', 'butcher', 'infested', 'maw', 'coffin'] as const
  readonly id = 'horror'
  readonly mood = 'horror'
  readonly photo = photo
  readonly premise = 'This picture is in a horror game – suddenly turned into a corrupted version.'
  readonly title = 'Horror Orb'

  createMaterial(options: OrbGlassOptions) {
    return new EyeOrbMaterial(options)
  }
}
