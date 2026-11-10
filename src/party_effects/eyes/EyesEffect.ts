import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyEffect from '../base/PartyEffect.ts'
import {around} from '../lib/partySite.ts'
import playEyeWhispers from './eyeWhispers.ts'
import {shutting, staringEyes} from './flights.ts'
import StaringEyes from './StaringEyes.ts'

/** Eyes open in the dark round their origin as it bursts, darting about to whispers until they all snap round at once to stare at whoever watches, some weeping blood, until they slam shut one after another. */
export default class EyesEffect extends PartyEffect {
  readonly duration = Math.max(...staringEyes.map(({close}) => close)) + shutting.lids + shutting.fading
  readonly id = 'eyes'
  readonly title = 'Staring eyes'

  createSprites() {
    return new StaringEyes(staringEyes)
  }

  /** Every eye with the skin round it as wide as it opens, and the tear of a weeping one, which runs down about its width below it, until it has shut and faded away. */
  extent(_floor: number, since = 0) {
    return staringEyes.filter(eye => since < eye.close + shutting.lids + shutting.fading).flatMap(eye => {
      const [along, up, out] = eye.spot
      const tear: Array<PartyOffset> = eye.weeps ? [[along, up - eye.size, out]] : []
      return [...around(eye.spot, eye.size * 0.7), ...tear]
    })
  }

  sound(audio: AudioOutput, site: PartySite) {
    playEyeWhispers(audio, site, staringEyes)
  }
}
