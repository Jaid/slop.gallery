import type EffectSprites from '../lib/EffectSprites.ts'
import type {PartyOffset, PartySite} from '../lib/partySite.ts'
import type {AudioOutput} from 'procedural-audio'

import PartyShow from '../lib/PartyShow.ts'

/**
 * A special effect that bursts out of a point in the world: sprites the GPU animates by the seconds since then, and a sound that plays once at that moment, like the ghosts that escape a fusion’s portal as the result flips out, or the alchemy machine’s cannon as it shoots an orb of a new flavor.
 * It belongs to nothing: an orb names one by its id to contribute it to its fusion, and anything else can spawn one anywhere, see `spawnPartyEffect`.
 * The effect is only the recipe: whoever shows it makes a {@link PartyShow} of it with {@link stage}, ahead of time where it can, so its pipelines compile before it is due.
 */
export default abstract class PartyEffect {
  /** seconds it goes on after it burst out, which keeps a fusion’s portal open at least that long */
  abstract readonly duration: number
  /** also the name of its folder */
  abstract readonly id: string
  abstract readonly title: string

  /** The sprites one show of it draws, still hidden. */
  abstract createSprites(): EffectSprites

  /** Where it reaches from `since` seconds after it burst out to the end of its show, at a site whose floor lies `floor` meters below its center (negative), as points from that center, none once it is over: a camera that sees them all sees all of it that is still to come, like the closing shot of a film that keeps it in view. */
  abstract extent(floor: number, since?: number): Array<PartyOffset>

  /** Plays the sound of it bursting out at `site`, from now on. */
  abstract sound(audio: AudioOutput, site: PartySite): void

  /** A show of it at `site`, which draws nothing until it is told that it burst out. */
  stage(site: PartySite) {
    return new PartyShow(this, site)
  }
}
