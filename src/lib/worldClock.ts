type Listener = () => void

/**
 * The clock of the world, which stands still while the world is frozen: under the pause menu of the Escape key, which stops everything in the world at once, its frames, its physics, its animations and its sound, until the player resumes. The menu of a lost focus, like the one the Windows key or switching the tab brings up, leaves the world running.
 * {@link now} tells its time, which whatever plays along a timeline of its own, like a fusion, a party effect and every shader’s `time`, reads instead of `performance.now()`, so it goes on after a freeze right where it stood.
 * {@link freeze} holds it still, and {@link subscribe} tells whatever has to stop and go on with it by itself, like the frame loop and the sound engine.
 */
export class WorldClock {
  /** whether the world is frozen right now, for `useSyncExternalStore` */
  getSnapshot = () => this.frozen
  /** Calls `listener` whenever the world freezes or goes on, returning the unsubscribe function. */
  subscribe = (listener: Listener) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  /** when the freeze in effect began, by `performance.now()` */
  #frozenAt = 0
  /** how many callers hold the world frozen */
  #holds = 0
  #listeners = new Set<Listener>
  /** how long the world has been frozen in total before the freeze in effect, in ms */
  #lost = 0

  /** whether the world is frozen right now */
  get frozen() {
    return this.#holds > 0
  }

  /**
   * Freezes the world until the returned function is called, which only counts once. The world goes on once nobody holds it frozen anymore.
   */
  freeze() {
    if (this.#holds++ === 0) {
      this.#frozenAt = performance.now()
      this.#publish()
    }
    let held = true
    return () => {
      if (!held) {
        return
      }
      held = false
      if (--this.#holds === 0) {
        this.#lost += performance.now() - this.#frozenAt
        this.#publish()
      }
    }
  }

  /** The world’s time in ms: `performance.now()` without the time the world was frozen, so it stands still during a freeze. Like `performance.now()`, it only tells how far two moments are apart. */
  now() {
    return (this.frozen ? this.#frozenAt : performance.now()) - this.#lost
  }

  #publish() {
    for (const listener of this.#listeners) {
      // One that fails must not keep the rest of the world from freezing or going on.
      try {
        listener()
      } catch (error) {
        reportError(error)
      }
    }
  }
}

const worldClock = new WorldClock

export default worldClock
