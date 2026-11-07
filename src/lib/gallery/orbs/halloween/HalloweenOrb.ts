import type {OrbGlassOptions} from '#src/lib/materials/orb/base/OrbGlassMaterial.ts'

import {batsEffect} from '#src/lib/gallery/fusion/effects/index.ts'
import BatsOrbMaterial from '#src/lib/materials/orb/BatsOrbMaterial.ts'
import {halloweenMood} from '#src/lib/moods/index.ts'

import PromptOrb from '../base/PromptOrb.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** Bats circling a harvest moon in orange haze. It dresses a work up for Halloween, festive rather than frightening, and its bats burst out of the portal as the result flips out. */
export default class HalloweenOrb extends PromptOrb {
  readonly adjectives = [
    // mood
    ['festive', 'party-ready'],
    ['cheerful', 'playful'],
    'cozy',
    ['whimsical', 'spooky-cute'],
    'mischievous',
    // season
    ['autumnal', 'harvest-themed'],
    'orange-and-black',
    // light
    ['candlelit', 'lantern-lit'],
    'moonlit',
    'misty',
    // decoration
    'cobwebbed',
    'pumpkin-filled',
    'bat-garlanded',
    'candy-strewn',
    // costumes
    ['costumed', 'trick-or-treat-ready'],
    'witchy',
  ]
  readonly change = 'add casual Halloween decoration that makes it'
  readonly color = '#ff7b1c'
  override readonly effect = batsEffect
  readonly frame = ['halloween-lantern', 'halloween-ossuary', 'halloween-coffin'] as const
  readonly id = 'halloween'
  readonly mood = halloweenMood
  readonly photo = photo
  readonly premise = 'This picture is in a game – and tonight is Halloween, so it gets dressed up for the holiday.'
  readonly title = 'Halloween Orb'

  createMaterial(options: OrbGlassOptions) {
    return new BatsOrbMaterial(options)
  }
}
