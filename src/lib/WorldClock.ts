/** A monotonic world timeline in milliseconds. Pauses exclude wall time without changing the browser’s clock, network work or UI timers. */
export default class WorldClock {
  now = () => (this.pausedAt ?? this.read()) - this.excluded
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private excluded = 0
  private readonly listeners = new Set<() => void>
  private pausedAt: number | undefined

  constructor(private readonly read = () => performance.now()) {}

  get paused() {
    return this.pausedAt !== undefined
  }

  set paused(value: boolean) {
    if (value === this.paused) {
      return
    }
    const now = this.read()
    if (value) {
      this.pausedAt = now
    } else {
      this.excluded += now - this.pausedAt!
      this.pausedAt = undefined
    }
    const listeners = [...this.listeners]
    for (const listener of listeners) {
      listener()
    }
  }
}
