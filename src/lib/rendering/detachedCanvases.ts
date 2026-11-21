type Listener = () => void

/**
 * The canvases of their own that the page shows besides the world’s, like the studio view of a work up close in the pause menu (see `StudioView`), so the world makes room for them: under the pause menu, its streaming goes back to its regular budget while there is any, which leaves them the display’s rate (see `StreamPace`).
 */
export class DetachedCanvases {
  /** whether any is in the page right now, for `useSyncExternalStore` */
  getSnapshot = () => this.active
  /** Calls `listener` whenever the first comes in or the last goes, returning the unsubscribe function. */
  subscribe = (listener: Listener) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  #holds = 0
  #listeners = new Set<Listener>

  /** whether any is in the page right now */
  get active() {
    return this.#holds > 0
  }

  /** Tells that a canvas is in the page until the returned function is called, which only counts once. */
  hold() {
    if (this.#holds++ === 0) {
      this.#publish()
    }
    let held = true
    return () => {
      if (!held) {
        return
      }
      held = false
      if (--this.#holds === 0) {
        this.#publish()
      }
    }
  }

  #publish() {
    for (const listener of this.#listeners) {
      try {
        listener()
      } catch (error) {
        reportError(error)
      }
    }
  }
}

const detachedCanvases = new DetachedCanvases

export default detachedCanvases
