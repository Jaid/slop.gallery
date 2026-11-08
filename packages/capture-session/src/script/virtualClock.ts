export type VirtualClock = {
  /** freezes performance.now() and requestAnimationFrame(); from now on, time only moves through step() */
  start: () => void
  /** advances the frozen clock, a hair further than asked unless by 0, and runs the animation frame callbacks that were queued until then */
  step: (seconds: number) => void
}

declare global {
  var virtualClock: VirtualClock | undefined
}

/**
 * Page init script that lets an offline renderer own the engine clock, so animation deltas stay exact however slow each frame renders.
 * Until start(), everything runs on the wall clock. It must stay self-contained: Puppeteer serializes it into the page.
 */
export const installVirtualClock = () => {
  /**
   * How much further than asked every step goes, in ms: a nanosecond, microseconds over a whole film.
   * Adding up frame durations like 16.666… ms rounds, which leaves the clock short of the frame’s moment about half the time, so a deadline falling exactly on a frame, like a fusion’s, would wait a whole frame longer; this outweighs that rounding.
   */
  const overshoot = 1e-6
  const realNow = performance.now.bind(performance)
  const realRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis)
  let frozen = false
  let now = 0
  let nextId = 1
  let pumping = false
  let queue = new Map<number, FrameRequestCallback>
  const flush = (timestamp: number) => {
    const callbacks = queue
    queue = new Map
    for (const callback of callbacks.values()) {
      try {
        callback(timestamp)
      } catch (error) {
        reportError(error)
      }
    }
  }
  const pump = (timestamp: number) => {
    pumping = false
    if (!frozen) {
      flush(timestamp)
    }
  }
  Object.defineProperty(performance, 'now', {
    configurable: true,
    value: () => (frozen ? now : realNow()),
  })
  globalThis.requestAnimationFrame = callback => {
    const id = nextId++
    queue.set(id, callback)
    if (!frozen && !pumping) {
      pumping = true
      realRequestAnimationFrame(pump)
    }
    return id
  }
  globalThis.cancelAnimationFrame = id => {
    queue.delete(id)
  }
  globalThis.virtualClock = {
    start: () => {
      if (!frozen) {
        now = realNow()
        frozen = true
      }
    },
    step: seconds => {
      if (!frozen) {
        throw new Error('Start the virtual clock before stepping it.')
      }
      now += seconds * 1000 + (seconds > 0 ? overshoot : 0)
      flush(now)
    },
  }
}
