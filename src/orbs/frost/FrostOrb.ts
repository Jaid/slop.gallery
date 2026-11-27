import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import hsl from 'okhsl'

import PromptOrb from '../base/PromptOrb.ts'
import BlizzardOrbMaterial from './BlizzardOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A snow globe in a blizzard: a great crystal of glowing ice turning in the eye of the storm, snowflakes whirling round it under a faint aurora and settling into a drift. It lets a winter storm sweep over a work, burying it in snow and hoarfrost, and a blizzard of snowflakes bursts out of the portal as the result flips out. */
export default class FrostOrb extends PromptOrb {
  readonly adjectives = [
    // weather
    ['snowbound', 'snow-covered', 'snowed-in'],
    ['blizzard-swept', 'storm-lashed', 'windswept'],
    ['frostbitten', 'frost-rimed', 'hoarfrosted'],
    ['ice-encrusted', 'icicle-hung', 'glazed in ice'],
    'snowdrifted',
    // cold
    ['frozen', 'deep-frozen'],
    ['glacial', 'arctic', 'polar'],
    ['bitterly cold', 'freezing'],
    // light
    ['crystalline', 'glittering'],
    ['moonlit', 'aurora-lit'],
    ['blue-white', 'icy blue'],
    // feeling
    'hushed',
    ['wintry', 'midwinter'],
    'desolate',
    ['magical', 'enchanted'],
  ]
  readonly change = 'let a fierce winter storm sweep over it, covering it in snow, frost and ice, keeping the original subject recognizable, so that it becomes'
  readonly color = hsl.integer(224, 92, 79)
  /** Its traits are all of one winter, so a prompt asks for every one it names. */
  override readonly conjunction = 'and'
  override readonly effect = 'blizzard'
  readonly frame = ['glacier', 'frost'] as const
  readonly id = 'frost'
  readonly mood = 'frost'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and the deepest winter has just descended on it in a howling blizzard.'
  readonly title = 'Frost Orb'

  createMaterial(options: OrbGlassOptions) {
    return new BlizzardOrbMaterial(options)
  }
}
