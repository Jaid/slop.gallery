import type PartyEffect from '../base/PartyEffect.ts'
import type EffectSprites from './EffectSprites.ts'
import type {PartySite} from './partySite.ts'
import type {AudioOutput} from 'procedural-audio'

/** how late after it burst out its sound may still start, in seconds, for whoever only notices then */
const lateness = 0.3

/**
 * One party effect playing at one site: its sprites, standing at the site’s center, and its sound.
 * It is staged before it bursts out, drawing nothing yet, so its pipelines compile meanwhile, and whoever staged it brings it along frame by frame by its own clock, like a fusion’s portal by the seconds since its result flipped out.
 */
export default class PartyShow {
  readonly effect: PartyEffect
  /** what it draws, in the world */
  readonly root: EffectSprites
  readonly site: PartySite
  private sounded = false

  constructor(effect: PartyEffect, site: PartySite) {
    this.effect = effect
    this.site = site
    this.root = effect.createSprites()
    const {center, floor, normal, tangent} = site
    const {uniforms} = this.root
    this.root.position.fromArray(center)
    uniforms.normal.value.fromArray(normal)
    uniforms.tangent.value.fromArray(tangent)
    uniforms.floor.value = floor - center[1]
  }

  dispose() {
    this.root.dispose()
  }

  /** Whether all of it is over `since` seconds after it burst out. */
  over(since: number) {
    return since > this.effect.duration
  }

  /** Brings it to `since` seconds after it burst out, negative while it still waits; `audio` is where it may sound, while the sound is on. */
  update(since: number, audio?: AudioOutput) {
    this.root.uniforms.clock.value = since < 0 ? -1 : since
    if (since < 0 || this.sounded) {
      return
    }
    this.sounded = true
    if (audio && since < lateness) {
      this.effect.sound(audio, this.site)
    }
  }
}
