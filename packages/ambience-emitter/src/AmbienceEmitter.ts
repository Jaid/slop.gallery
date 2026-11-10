import type {AmbienceLoopOptions} from './AmbienceLoop.ts'
import type {Hearing, Position} from 'procedural-audio'

import {absorptionCutoff, hearingPath, hearingShare, openCutoff} from 'procedural-audio'

import AmbienceLoop from './AmbienceLoop.ts'

export type HearOptions = {
  /** whether what changes glides there, by default `true`; otherwise it follows at once, like after the listener jumped somewhere else */
  fading?: boolean
  /** the ID of the room the listener is in, which disables the emitter outside its rooms; left out, the emitter stays as it is */
  room?: string
}
export type AmbienceEmitterOptions = AmbienceLoopOptions & {
  /** full level within `near` meters, fading linearly to silence at `far` */
  hearing: Hearing
  /** where it sounds from, in the listener’s space */
  position: Position
  /** the IDs of the rooms the emitter sounds in, by default everywhere; it is disabled while the listener is anywhere else */
  rooms?: ReadonlyArray<string>
}

/** how far, as a factor, the cutoff of an emitter’s absorption has to move before it is retuned, so a listener standing still schedules nothing */
const retuneStep = 1.01

/**
 * A positional {@link AmbienceLoop}, heard through an HRTF panner at {@link position}, which fades out while the listener is outside its {@link rooms}.
 * The farther away the listener, the more of its highs the air takes before its level fades: a lowpass after the panner closes from all open nearby to a muffled wash at the edge of its hearing.
 */
export default abstract class AmbienceEmitter extends AmbienceLoop {
  readonly hearing: Hearing
  readonly position: Position
  readonly rooms?: ReadonlyArray<string>
  /** the lowpass the air takes the highs through, while the emitter sounds */
  private absorption?: BiquadFilterNode
  /** the cutoff in Hz the absorption was last tuned to, kept for the next start */
  private cutoff = openCutoff
  private inside = true

  constructor({hearing, position, rooms, ...options}: AmbienceEmitterOptions) {
    super(options)
    this.position = position
    this.hearing = hearing
    this.rooms = rooms
  }

  /** Hears the emitter from `listener`: the farther away, the more muffled, and disabled while the listener’s `room` is none of its rooms. Call it whenever the listener moved, like every frame. */
  hear(listener: Position, {fading = true, room}: HearOptions = {}) {
    if (room !== undefined) {
      this.setListenerRoom(room, fading)
    }
    const cutoff = absorptionCutoff(hearingShare(this.position, listener, this.hearing))
    if (Math.max(cutoff / this.cutoff, this.cutoff / cutoff) < retuneStep) {
      return
    }
    this.cutoff = cutoff
    this.absorption?.frequency.setTargetAtTime(cutoff, this.absorption.context.currentTime, fading ? 0.05 : 0)
  }

  /** Whether `room` is one the emitter stands in. */
  isInside(room: string) {
    return !this.rooms || this.rooms.includes(room)
  }

  protected override route(level: GainNode, context: BaseAudioContext) {
    const {absorption, panner} = hearingPath(context, this.position, this.hearing, this.cutoff)
    this.absorption = absorption
    level.connect(panner)
    return absorption
  }

  /** Disables the emitter while the listener is outside its rooms, fading it out and in again, or without `fading` at once. */
  setListenerRoom(room: string, fading = true) {
    const inside = this.isInside(room)
    if (inside === this.inside) {
      return
    }
    this.inside = inside
    this.setLevel(inside ? 1 : 0, fading ? undefined : 0)
  }

  override stop(fade?: number) {
    super.stop(fade)
    this.absorption = undefined
  }

  /** How loud the emitter reaches a listener at `listener`, in `room` if given, 0–1, before {@link gain}; 0 while disabled there. */
  strengthAt(listener: Position, room?: string) {
    if (room !== undefined && !this.isInside(room)) {
      return 0
    }
    return 1 - hearingShare(this.position, listener, this.hearing)
  }
}
