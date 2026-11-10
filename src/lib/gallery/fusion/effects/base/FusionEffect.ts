import type Fusion from '#src/lib/gallery/fusion/Fusion.ts'
import type {PortalOffset} from './portalOffset.ts'
import type {AudioOutput} from 'procedural-audio'
import type {Object3D} from 'three/webgpu'

/** a fusion’s effect as one portal shows it */
export type EffectShow = {
  dispose: () => void
  /** what it draws, in the world */
  root: Object3D
  /** Brings it to `elapsed` seconds into the fusion; `audio` is where it may sound, while the sound is on. */
  update: (elapsed: number, audio?: AudioOutput) => void
}

/**
 * Something a fusion’s portal shows besides its own choreography, which an ingredient contributes, like the ghosts the Spook Orb lets escape as the result flips out.
 * The effect is only the recipe: every portal showing it makes its own {@link EffectShow} as it opens and brings it along frame by frame, so its pipelines compile during the intro instead of when it is due.
 */
export default abstract class FusionEffect {
  /** seconds it goes on after the result flipped out, which keeps the portal open at least that long */
  readonly afterglow: number = 0
  abstract readonly id: string

  /** Where it reaches from `since` seconds after the result flipped out to the end of its show, round a portal whose floor lies `floor` meters below its middle (negative), as points from the portal’s middle, none once it is over: a camera that sees them all sees all of it that is still to come, like the closing shot of a film that keeps it in view. */
  abstract extent(floor: number, since?: number): Array<PortalOffset>

  /** The effect as the portal of `fusion` shows it. */
  abstract show(fusion: Fusion): EffectShow
}
