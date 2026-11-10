import type {PortraitFrameId} from '#src/frames/lib/frameParameter.ts'
import type {PartyEffect} from '#src/party_effects/index.ts'
import type {Portrait, Vec3} from '../types.ts'
import type {IngredientLatch} from './FusionRecipe.ts'
import type {PortalFrame} from './portalFrame.ts'
import type {FusionTiming} from './timing.ts'

import {fusionTiming, nextTurn} from './timing.ts'

/** the ingredient thrown into the hung portrait */
export type FusionPartner = {
  /** for an item, whether a success uses it up, like an orb, instead of spitting it back out */
  consumed?: boolean
  id: string
  /** a loose portrait, which the result replaces along with the hung one; or an item, which the portal spits back out unless it is consumed */
  kind: 'item' | 'portrait'
  /** for an item, whether it is a glass orb, which is much smaller than a portrait */
  orb?: boolean
  /** for an item a success uses up, the prop id of what it leaves of the item (see `FusionRemains`), which the portal holds hidden in its middle and spits out after the result */
  remains?: string
}
/** where and how hard what was thrown struck the hung portrait, which opened the fusion */
export type FusionImpact = {
  /** where the middle of what was thrown was as they met, in the world */
  center: Vec3
  /** how fast the thrown one was moving, in m/s */
  speed: number
}
export type FusionSpec = {
  /** the swirl’s color, like an orb’s glow; the portal’s own otherwise */
  color?: string
  /** the party effects the portal shows besides its own choreography as the result flips out, as the ingredients contributed them */
  effects: ReadonlyArray<PartyEffect>
  /** the images the portal shows of the ingredients in turn, the hung portrait’s first; more can surface later, like a prop’s photograph; an ingredient with nothing to show, like the Transparent Orb, shows nothing */
  images: Array<Blob | string>
  /** the strike that opened it, unless it was opened otherwise, like by a test */
  impact?: FusionImpact
  /** how the intro’s ember latches each ingredient on, the hung portrait first, one for each of the fusion’s 2–4 ingredients, which it yanks in on a beat of its own */
  latches: ReadonlyArray<IngredientLatch>
  partner: FusionPartner
  /** the hung portrait, the fusion’s first ingredient, which the portal opens in front of and the result replaces */
  work: Pick<Portrait, 'frame' | 'height' | 'id' | 'position' | 'rotation' | 'width'>
}
export type FusionOutcome = {
  /** seconds into the fusion that the climax or the fizzle starts, or that the fusion was aborted */
  at: number
  kind: 'abort' | 'failure' | 'success'
}
/** an image kept ready to show until released */
export type ImageHold = {
  ready: Promise<unknown>
  release: () => void
}
export type FusionOptions = {
  frame: PortalFrame
  /** Keeps the result ready to show from before the climax until the fusion closes, so the result flips out already decoded. */
  hold?: (image: Blob | string) => ImageHold
  /** Called once when the fusion is over and its portal closed. */
  onClose?: (fusion: Fusion) => void
  timing?: FusionTiming
}

/** how long a wait sleeps at most before it looks at the clock again, in ms; a frozen or throttled clock must not oversleep the timeline */
const poll = 100
let opened = 0

/**
 * A fusion as the gallery shows it: a portal opens in front of the hung portrait with its intro, which brings the portrait and what was thrown into it into orbit around it, while the portal shows their images in turn.
 * The director tells it how the fusion went and waits for its timeline: a result never shows before {@link FusionTiming.minimum} and flips out after the climax, while a failure only waits for the intro and hands everything back after the fizzle.
 * Its own clock is `performance.now()`, which the renderer and the virtual clock of the film script follow too.
 */
export default class Fusion {
  /** seconds into the fusion that the player broke it off, by jumping into its portal */
  canceledAt?: number
  /** whether the portal has closed and the fusion is over */
  closed = false
  /** seconds into the fusion that the result flipped out of the portal */
  emergedAt?: number
  readonly frame: PortalFrame
  /** unique among the fusions of the page */
  readonly id = ++opened
  outcome?: FusionOutcome
  /** the fused image, once it is in, or the hung portrait’s own where nothing was contributed to fuse it with */
  result?: Blob | string
  /** the frame the result will wear, or the default frame for none, which the director rolls as the portal opens, so the portal has it ready by the time the result flips out */
  resultFrame?: PortraitFrameId
  /** aborted once the player breaks the fusion off, which makes the image model give up */
  readonly signal: AbortSignal
  readonly spec: FusionSpec
  readonly startedAt = performance.now()
  readonly timing: FusionTiming
  private readonly canceller = new AbortController
  private readonly hold?: FusionOptions['hold']
  private readonly holds: Array<ImageHold> = []
  private readonly onClose?: FusionOptions['onClose']
  /** resolves when the fusion closes, which wakes every wait */
  private readonly over = Promise.withResolvers<void>()

  constructor(spec: FusionSpec, {frame, hold, onClose, timing = fusionTiming}: FusionOptions) {
    this.spec = spec
    this.signal = this.canceller.signal
    this.frame = frame
    this.timing = timing
    this.hold = hold
    this.onClose = onClose
  }

  /** seconds the portal stays open after the result flipped out: its own afterglow, or longer while an effect goes on */
  get afterglow() {
    return Math.max(this.timing.afterglow, ...this.spec.effects.map(effect => effect.duration))
  }

  /** Ends the fusion right away, wherever it is: everything snaps back, and the portal closes. Does nothing once it is over. */
  abort() {
    if (this.closed) {
      return
    }
    this.outcome ??= {
      kind: 'abort',
      at: this.elapsed(),
    }
    this.close()
  }

  /** Adds an image the portal shows from its next turn on. */
  addImage(image: Blob | string) {
    if (!this.closed) {
      this.spec.images.push(image)
    }
  }

  /**
   * Breaks the fusion off while it still brews, as the player does by jumping into its portal: the portal recoils at once, {@link signal} tells the image model to give up, and the fusion fails like one that went wrong as the next turn of the images begins, no sooner than the end of its intro.
   * A result that came in early, like one made locally without AI, which is ready at once, only shows once its climax begins, so until then it still brews as far as the player can tell, and breaking it off drops the result.
   * Returns whether it broke off, which it no longer does once the climax or the fizzle has begun.
   */
  cancel() {
    if (!this.brewing()) {
      return false
    }
    const elapsed = this.elapsed()
    this.canceledAt = elapsed
    this.canceller.abort(new DOMException('The player broke the fusion off.', 'AbortError'))
    this.failAt(nextTurn(elapsed, this.timing)).catch(() => this.close())
    return true
  }

  /** seconds since the fusion started */
  elapsed(now = performance.now()) {
    return (now - this.startedAt) / 1000
  }

  /** Marks the result as committed: it flips out of the portal now, which closes after its {@link afterglow}. */
  emerge() {
    if (this.closed || this.outcome?.kind !== 'success' || this.emergedAt !== undefined) {
      return
    }
    const emergedAt = Math.max(this.elapsed(), this.outcome.at + this.timing.climax)
    this.emergedAt = emergedAt
    this.closeAt(emergedAt + this.afterglow).catch(() => this.close())
  }

  /** Shows the failure, no sooner than the end of the intro, as it need not wait for the minimum: the portal fizzles out, the hung portrait flies back to its wall and what was thrown into it is spat out. Resolves once all of it is back, also when the fusion was already failing, like one the player broke off. */
  async fail() {
    if (this.outcome?.kind === 'failure') {
      await this.over.promise
      return
    }
    if (this.settled()) {
      return
    }
    await this.failAt(Math.max(this.elapsed(), this.timing.intro))
  }

  /** Ends the fusion once its director is done with it. One whose result flipped out keeps glowing until its afterglow is over; any other is aborted. */
  finish() {
    if (this.emergedAt === undefined) {
      this.abort()
    }
  }

  /** Where the result starts its flight: at the portal’s middle, facing the room like the hung portrait did, thrown straight up with a forward flip. */
  launch(): Required<Pick<Portrait, 'position' | 'rotation' | 'spin' | 'velocity'>> {
    const {center, normal, tangent} = this.frame
    return {
      position: [...center],
      rotation: this.spec.work.rotation,
      velocity: [normal[0] * 0.55, 4.6, normal[2] * 0.55],
      // Around the wall’s horizontal, the top tips toward the room; a little yaw keeps the flip from looking mechanical.
      spin: [tangent[0] * 7, 1.3, tangent[2] * 7],
    }
  }

  /** Shows the result, no sooner than the minimum and once it is ready to show: the satellites spiral into the portal, which shows the result. Resolves when the result is due to flip out; the director then commits it and calls {@link emerge}. */
  async succeed(result: Blob | string) {
    if (this.settled()) {
      return
    }
    this.result = result
    if (this.hold) {
      const hold = this.hold(result)
      this.holds.push(hold)
      await hold.ready.catch(() => {})
      // It may have been aborted meanwhile.
      if (this.settled()) {
        return
      }
    }
    const at = Math.max(this.elapsed(), this.timing.minimum)
    this.outcome = {
      kind: 'success',
      at,
    }
    await this.reach(at + this.timing.climax)
  }

  /** whether the fusion still brews as the player sees it: open and without an outcome, or with a success whose climax is yet to begin */
  private brewing() {
    const {closed, outcome} = this
    return !closed && (outcome === undefined || outcome.kind === 'success' && this.elapsed() < outcome.at)
  }

  private close() {
    if (this.closed) {
      return
    }
    this.closed = true
    for (const hold of this.holds.splice(0)) {
      hold.release()
    }
    this.over.resolve()
    this.onClose?.(this)
  }

  private async closeAt(seconds: number) {
    await this.reach(seconds)
    this.close()
  }

  /** Fails `at` seconds into the fusion and closes once it fizzled out. */
  private async failAt(at: number) {
    this.outcome = {
      kind: 'failure',
      at,
    }
    await this.closeAt(at + this.timing.fizzle)
  }

  /** Resolves once the fusion is `seconds` old or over. */
  private async reach(seconds: number) {
    while (!this.closed && this.elapsed() < seconds) {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([this.over.promise, new Promise(resolve => {
        timer = setTimeout(resolve, Math.min(poll, Math.max(1, (seconds - this.elapsed()) * 1000)))
      })])
      clearTimeout(timer)
    }
  }

  /** whether the fusion is over or its outcome is set */
  private settled() {
    return this.closed || this.outcome !== undefined
  }
}
