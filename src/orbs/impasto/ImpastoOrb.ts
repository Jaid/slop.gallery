import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import DollopsOrbMaterial from './DollopsOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** Chunky dollops of oil paint adrift in amber oil. It has a work rebuilt as a bold digital impasto without touching its content, every prompt asking for all of the traits it names, and unseen palette knives trowel a flourish of thick slabs of paint into the air around the portal as the result flips out. */
export default class ImpastoOrb extends PromptOrb {
  readonly adjectives = [
    // body
    ['thickly built up', 'heavily loaded'],
    'sculptural',
    ['knife-laid', 'troweled'],
    'richly ridged',
    ['peaked', 'crested'],
    'deeply grooved',
    'broken-edged',
    'relief-like',
    // handling
    'bold',
    ['forceful', 'vigorous'],
    'tactile',
    ['saturated', 'pigment-rich'],
    // image
    'detailed',
    'cohesive',
    'atmospheric',
    ['luminous along its ridges', 'dimensional'],
  ]
  readonly change = 'change it to a high-quality digital impasto artwork while keeping the original content intact: the same subject, composition, poses, faces, colors and lighting, with nothing added, removed or rearranged, every form rebuilt in thick sculptural paint laid on with a palette knife – raised ridges, peaks, grooves and broken edges catching raking light. The impasto should be'
  readonly color = '#f0a832'
  override readonly conjunction = 'and'
  override readonly effect = 'impasto'
  readonly frame = ['palette', 'impressionist'] as const
  readonly id = 'impasto'
  readonly mood = 'impasto'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and a palette knife has just taken it up to rebuild it in thick impasto.'
  readonly title = 'Impasto Orb'

  createMaterial(options: OrbGlassOptions) {
    return new DollopsOrbMaterial(options)
  }
}
