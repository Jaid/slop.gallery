import type {OrbGlassOptions} from '#src/lib/materials/orb/base/OrbGlassMaterial.ts'

import {strokesEffect} from '#src/lib/gallery/fusion/effects/index.ts'
import PaintsOrbMaterial from '#src/lib/materials/orb/PaintsOrbMaterial.ts'

import PromptOrb from '../base/PromptOrb.ts'
import photo from './photo.jxl' with {distance: '1', format: 'jxl', maximumLong: '512'}

/** Ribbons of oil paint curling through linseed oil. It has a work painted anew as an artistic painting of its own subject, every prompt asking for all of the traits it names, and unseen brushes paint a flourish of oil strokes into the air around the portal as the result flips out. */
export default class PaintOrb extends PromptOrb {
  readonly adjectives = [
    // craft
    ['skillfully crafted', 'skillfully rendered', 'meticulously crafted'],
    ['refined', 'elegant'],
    'distinctive',
    // color
    ['vibrant', 'chromatically rich'],
    'harmoniously colored',
    // light
    ['luminous', 'radiant'],
    ['dramatically lit', 'softly illuminated'],
    ['tonally nuanced', 'delicately shaded'],
    // surface
    'tactile',
    ['richly textured', 'organically textured'],
    'richly layered',
    ['alive with visible brushwork', 'gestural'],
    'bold',
    'detailed',
    // composition
    ['harmoniously composed', 'well-balanced', 'visually balanced'],
    'cohesive',
    ['dimensional', 'spatially convincing'],
    // feeling
    'expressive',
    'evocative',
    'immersive',
    ['ethereal', 'dreamlike'],
    ['serene', 'contemplative'],
  ]
  readonly change = 'restyle it while keeping the original subject intact. The output should be a beautiful high-quality artistic painting that is'
  readonly color = '#3d5afe'
  override readonly conjunction = 'and'
  override readonly effect = strokesEffect
  readonly frame = ['paint-marbled', 'paint-canvas'] as const
  readonly id = 'paint'
  readonly mood = 'paint'
  readonly photo = photo
  readonly premise = 'This picture is in a game – and a painter has just taken it to the easel to paint it anew.'
  readonly title = 'Paint Orb'

  createMaterial(options: OrbGlassOptions) {
    return new PaintsOrbMaterial(options)
  }
}
