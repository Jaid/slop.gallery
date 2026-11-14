import type {WorldClock} from '../worldClock.ts'

import worldClock from '../worldClock.ts'

export type FrozenFramesOptions = {
  /** whether something is underway that only further frames bring along, like objects still streaming in or an image dragged over the scene; the frozen world is drawn on while there is, for {@link patience} at most */
  busy?: () => boolean
  /** how to take back a frame asked for with `requestFrame` */
  cancelFrame?: (handle: number) => void
  /** the clock of the world to follow, the page’s own by default */
  clock?: WorldClock
  /** draws a frame of the moment the world froze at, without any time passing in it */
  draw: () => void
  /** the wall clock in ms, which the world’s own stands still against */
  now?: () => number
  /** asks for a callback before the browser paints next */
  requestFrame?: (callback: () => void) => number
  /** stops the frames the world draws by itself, or lets them run again */
  run: (running: boolean) => void
}

/** how long the frozen world is drawn on after something changed how it shows, in ms: long enough for whatever follows the change, like what React commits after it, and for temporal antialiasing to settle */
export const settling = 500
/** how long the frozen world is drawn on at most while something is still underway, in ms, so a load that never ends doesn’t keep a paused game rendering for good */
export const patience = 20_000

/**
 * Stops the frames of a world for as long as its clock is frozen, and draws the frozen moment again whenever {@link refresh} tells that it would show differently now, like on a resized canvas, in another graphics mode or with a new work hung in it.
 * Those frames show the same moment: no time passes in them, so nothing in the world moves, while everything that isn’t a matter of time, like loading, building and aiming, goes on.
 */
export default class FrozenFrames {
  private readonly busy: () => boolean
  private readonly cancelFrame: (handle: number) => void
  private readonly clock: WorldClock
  private connected = false
  /** the frame asked for, while frames of the frozen world are being drawn */
  private frame: number | undefined
  /** whether it stopped the world’s own frames */
  private halted = false
  private readonly now: () => number
  /** whether a change hasn’t been drawn yet, which it is however late the browser paints next, like in a tab that was hidden meanwhile */
  private owed = false
  /** when to stop drawing even with something still underway */
  private patientUntil = 0
  private readonly requestFrame: (callback: () => void) => number
  /** when what last changed has settled */
  private settledAt = 0
  private readonly tick = () => {
    this.frame = undefined
    if (!this.connected || !this.clock.frozen) {
      return
    }
    const now = this.now()
    if (!this.owed && now >= this.settledAt && !(this.busy() && now < this.patientUntil)) {
      return
    }
    this.owed = false
    // Asked for first, so whatever the frame changes that asks to be drawn again only keeps this going.
    this.frame = this.requestFrame(this.tick)
    this.options.draw()
  }

  constructor(private readonly options: FrozenFramesOptions) {
    this.busy = options.busy ?? (() => false)
    this.clock = options.clock ?? worldClock
    this.now = options.now ?? (() => performance.now())
    this.requestFrame = options.requestFrame ?? (callback => requestAnimationFrame(callback))
    this.cancelFrame = options.cancelFrame ?? (handle => cancelAnimationFrame(handle))
  }

  /** whether frames of the frozen world are being drawn right now */
  get drawing() {
    return this.frame !== undefined
  }

  /** Follows the clock from now on: the world’s frames stop as it freezes and run again as it goes on. Returns how to stop following it, which lets the frames run. */
  connect() {
    const follow = () => {
      const {frozen} = this.clock
      this.halt(frozen)
      if (!frozen) {
        this.stop()
        return
      }
      // What was still underway as the world froze, like objects streaming in, finishes behind the menu.
      if (this.busy()) {
        this.refresh()
      }
    }
    this.connected = true
    const unsubscribe = this.clock.subscribe(follow)
    follow()
    return () => {
      unsubscribe()
      this.connected = false
      this.stop()
      this.halt(false)
    }
  }

  /** Tells that the frozen world would show differently now, so it is drawn again until that has settled. Does nothing while the world runs, which draws itself. */
  refresh() {
    if (!this.connected || !this.clock.frozen) {
      return
    }
    const now = this.now()
    this.settledAt = now + settling
    this.patientUntil = now + patience
    this.owed = true
    this.frame ??= this.requestFrame(this.tick)
  }

  /** Stops the world’s own frames or lets them run again, unless they already do. */
  private halt(halted: boolean) {
    if (halted !== this.halted) {
      this.halted = halted
      this.options.run(!halted)
    }
  }

  /** Stops drawing frames of the frozen world. */
  private stop() {
    this.owed = false
    if (this.frame !== undefined) {
      this.cancelFrame(this.frame)
      this.frame = undefined
    }
  }
}
