export type HintControl = 'KeyE' | 'KeyV' | 'MouseLeft'

export type HintKey = {
  /** short verb for what the controls do */
  action: string
  /** the action exists on this object but is refused right now, for example a showcased knot */
  blocked?: boolean
  /** alternative controls that trigger the same action */
  controls: ReadonlyArray<HintControl>
}

export type HintContent = {
  /** stable target identity; content changes on the same target update in place without a new delay */
  id: string
  keys: ReadonlyArray<HintKey>
  /** the object’s name, left out for one without, like a work before its flavor text names it */
  title?: string
}

export type HintSnapshot = {
  /** last shown content, retained while hidden so the exit animation keeps its text */
  content: HintContent | null
  visible: boolean
}

type Listener = () => void

const sameKeys = (a: ReadonlyArray<HintKey>, b: ReadonlyArray<HintKey>) => a.length === b.length && a.every((key, index) => key.controls.join() === b[index].controls.join() && key.action === b[index].action && Boolean(key.blocked) === Boolean(b[index].blocked))
const sameContent = (a: HintContent, b: HintContent) => a.id === b.id && a.title === b.title && sameKeys(a.keys, b.keys)

/**
 * Debounces the aimed target into a HUD hint. A target has to stay aimed for `dwell` seconds before its hint appears, so
 * sweeping the view across objects does not flash a hint for each of them. A shown hint survives losing its target for
 * `grace` seconds, so aiming jitter at an object’s edge does not make it blink. While suppressed, for example during zoom,
 * the hint stays hidden but keeps tracking targets, so it reappears without a new dwell once the suppression ends.
 */
export class InteractionHint {
  readonly dwell: number
  getSnapshot = () => this.snapshot
  readonly grace: number
  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private candidate: string | null = null
  private candidateSince = 0
  private readonly listeners = new Set<Listener>
  private lostSince: number | null = null

  private shown: HintContent | null = null

  private snapshot: HintSnapshot = {
    content: null,
    visible: false,
  }

  private suppressed = false

  constructor({dwell = 0.3, grace = 0.15}: {
    dwell?: number
    grace?: number
  } = {}) {
    this.dwell = dwell
    this.grace = grace
  }

  /** Hides the hint without affecting target tracking or the controls themselves. */
  setSuppressed(suppressed: boolean) {
    if (suppressed === this.suppressed) {
      return
    }
    this.suppressed = suppressed
    this.refresh()
  }

  /**
   * Feed the current target once per frame.
   * @param immediate skips both delays, for deliberate states like holding an object or opening a menu
   */
  update(target: HintContent | null, now: number, immediate = false) {
    if (target && this.shown?.id === target.id) {
      this.lostSince = null
      this.candidate = target.id
      if (!sameContent(this.shown, target)) {
        this.show(target)
      }
      return
    }
    if (!target) {
      this.candidate = null
    } else if (this.candidate !== target.id) {
      this.candidate = target.id
      this.candidateSince = now
    }
    if (target && (immediate || now - this.candidateSince >= this.dwell)) {
      this.show(target)
      return
    }
    if (!this.shown) {
      return
    }
    this.lostSince ??= now
    if (immediate || now - this.lostSince >= this.grace) {
      this.hide()
    }
  }

  private hide() {
    this.shown = null
    this.lostSince = null
    this.refresh()
  }

  /** Publishes the current state; a hidden hint keeps its last content for the exit animation. */
  private refresh() {
    const content = this.shown ?? this.snapshot.content
    const visible = this.shown !== null && !this.suppressed
    if (content === this.snapshot.content && visible === this.snapshot.visible) {
      return
    }
    this.snapshot = {
      content,
      visible,
    }
    for (const listener of this.listeners) {
      listener()
    }
  }

  private show(target: HintContent) {
    this.shown = target
    this.lostSince = null
    this.refresh()
  }
}

const interactionHint = new InteractionHint

export default interactionHint
