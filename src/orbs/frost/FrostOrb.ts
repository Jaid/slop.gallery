import type {OrbGlassOptions} from '../base/OrbGlassMaterial.ts'

import hsl from 'okhsl'

import PromptOrb from '../base/PromptOrb.ts'
import BlizzardOrbMaterial from './BlizzardOrbMaterial.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** A whole blizzard sealed in glass around one great frozen snowflake. It lets an arctic storm sweep through a work and leave it buried in snow and ice, and a flurry of snowflakes bursts out of the portal as the result flips out. */
export default class FrostOrb extends PromptOrb {
  readonly adjectives = [
    // snow cover
    ['snow-covered', 'snow-laden'],
    ['drift-piled', 'buried in drifts'],
    'powder-dusted',
    ['snowed-in', 'snowbound'],
    // ice
    ['ice-glazed', 'rime-encrusted'],
    'icicle-fringed',
    ['frozen over', 'locked in ice'],
    'frost-ferned',
    // the storm
    ['blizzard-blasted', 'storm-swept'],
    'wind-whipped',
    'whiteout-hazed',
    ['snowfall-streaked', 'flurry-filled'],
    // cold light
    ['glacier-blue', 'blue-white'],
    'crystalline',
    ['glittering', 'sparkling with frost'],
    // the cold itself
    ['arctic', 'polar'],
    ['subzero', 'bitterly cold'],
    'breath-fogged',
    ['hushed', 'snow-muffled'],
    'wintry',
  ]
  readonly change = 'let an arctic blizzard sweep through it that leaves it'
  readonly color = hsl.integer(224, 92, 79)
  override readonly effect = 'flurry'
  readonly frame = ['acrylic', 'dichroic', 'vitrine'] as const
  readonly id = 'frost'
  readonly mood = 'frost'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and an arctic cold front has just rolled in over it, burying it in a sudden winter storm.'
  readonly title = 'Frost Orb'

  createMaterial(options: OrbGlassOptions) {
    return new BlizzardOrbMaterial(options)
  }
}
