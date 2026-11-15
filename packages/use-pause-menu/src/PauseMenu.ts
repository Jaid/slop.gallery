import type {PauseMenuOptions, PauseMenuSnapshot, PauseReason} from './types.ts'

/** One page visit and one pointer-lock target, independent of React and any renderer. */
export default class PauseMenu {
  /** Attach from an effect. The returned cleanup owns only this attachment. */
  attach = (target: HTMLElement) => {
    const document = target.ownerDocument
    const window = document.defaultView
    if (!window) {
      throw new Error('PauseMenu requires a target with an active owner window.')
    }
    this.connection?.disconnect()
    this.start()
    const note = (reason: PauseReason) => {
      if (document.pointerLockElement === target || this.snapshot.locked) {
        // Focus loss wins if Escape and blur arrive during the same release.
        if (reason === 'unfocus' || this.reason !== 'unfocus') {
          this.reason = reason
        }
      }
    }
    const change = () => {
      const locked = document.pointerLockElement === target
      let {stage} = this.snapshot
      if (locked) {
        if (!this.snapshot.locked && this.releasedTarget !== target) {
          this.reason = undefined
          this.releasedTarget = undefined
        }
      } else if (this.snapshot.locked) {
        // The API exposes no reason. A focused, connected target with no explicit release is inferred to be the browser’s Escape unlock gesture.
        stage = !document.hasFocus() || document.hidden || !target.isConnected || document.pointerLockElement ? 'unfocus' : this.reason ?? 'pause'
        this.reason = undefined
        this.releasedTarget = undefined
      }
      this.publish({
        locked,
        stage,
      })
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' && !event.repeat) {
        note('pause')
      }
    }
    const blur = () => note('unfocus')
    const visibility = () => {
      if (document.hidden) {
        blur()
      }
    }
    const connection = {
      target,
      disconnect: () => {
        if (this.connection !== connection) {
          return
        }
        this.connection = undefined
        document.removeEventListener('pointerlockchange', change)
        document.removeEventListener('keydown', keydown, true)
        document.removeEventListener('visibilitychange', visibility)
        window.removeEventListener('blur', blur)
        const ownsLock = document.pointerLockElement === target
        this.reason = ownsLock ? 'unfocus' : undefined
        this.releasedTarget = ownsLock ? target : undefined
        if (this.snapshot.locked) {
          this.publish({
            locked: false,
            stage: 'unfocus',
          })
        }
        // Never release another canvas’s lock.
        if (ownsLock) {
          document.exitPointerLock()
        }
      },
    }
    this.connection = connection
    document.addEventListener('pointerlockchange', change)
    document.addEventListener('keydown', keydown, true)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', blur)
    change()
    return connection.disconnect
  }
  /** Call directly from a user gesture. State changes only on pointerlockchange. */
  enter = async (options?: PointerLockOptions) => {
    const connection = this.connection
    if (!connection) {
      throw new Error('Attach a pointer-lock target before entering the game.')
    }
    // Request before the first await so transient user activation is preserved.
    await connection.target.requestPointerLock(options)
    if (this.connection?.target !== connection.target && connection.target.ownerDocument.pointerLockElement === connection.target) {
      // A request can finish after its canvas has been unmounted or replaced.
      connection.target.ownerDocument.exitPointerLock()
    }
  }
  getServerSnapshot = () => this.serverSnapshot
  getSnapshot = () => this.snapshot
  /** Brings the pause menu up: while playing, releases the owned lock as a pause; while a menu is already up, turns it into the pause menu at once. */
  pause = () => {
    if (this.snapshot.locked) {
      this.release('pause')
      return
    }
    this.publish({
      locked: false,
      stage: 'pause',
    })
  }
  /** React 19 callback ref alternative to attach(). */
  ref = (target: HTMLElement | null) => {
    if (target) {
      return this.attach(target)
    }
  }
  /** Explicit application releases default to unfocus; use pause for a pause button. */
  release = (reason: PauseReason = 'unfocus') => {
    const target = this.connection?.target
    if (!target) {
      return
    }
    if (target.ownerDocument.pointerLockElement !== target) {
      return
    }
    const previous = this.reason
    const previousTarget = this.releasedTarget
    this.releasedTarget = target
    this.reason = this.reason === 'unfocus' ? 'unfocus' : reason
    try {
      target.ownerDocument.exitPointerLock()
    } catch (error) {
      this.reason = previous
      this.releasedTarget = previousTarget
      throw error
    }
  }

  /** Resolve saved-game availability after loading storage. Never replace a gameplay pause reason. */
  setGameData = (present: boolean) => {
    this.hasGameData = present
    const {stage, locked} = this.snapshot
    if (!locked && (stage === 'return' || stage === 'reset')) {
      this.publish({
        locked,
        stage: present ? 'return' : 'reset',
      })
    }
  }

  /** Mark this page visit once. Repeated calls and React effect replay are harmless. */
  start = () => {
    if (this.started) {
      return
    }
    this.started = true
    let returning = this.snapshot.stage === 'return' || this.snapshot.stage === 'reset'
    const {storageKey} = this.options
    if (storageKey !== undefined) {
      let storage
      try {
        storage = this.options.storage ? this.options.storage() : globalThis.localStorage
        returning ||= storage?.getItem(storageKey) === 'true'
      } catch {
        // Unavailable storage does not prevent playing.
      }
      try {
        storage?.setItem(storageKey, 'true')
      } catch {
        // A write failure must not discard a successfully read visit.
      }
    }
    let stage: PauseMenuSnapshot['stage'] = 'first'
    if (returning) {
      stage = this.hasGameData === false ? 'reset' : 'return'
    }
    // Resolving the visit never replaces a pause or unfocus reason that is already in effect.
    if (this.snapshot.stage === 'pause' || this.snapshot.stage === 'unfocus') {
      stage = this.snapshot.stage
    }
    this.publish({
      stage,
      locked: this.snapshot.locked,
    })
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private connection: {
    disconnect: () => void
    target: HTMLElement
  } | undefined

  private hasGameData: boolean | undefined

  private readonly listeners = new Set<() => void>
  private reason: PauseReason | undefined

  private releasedTarget: HTMLElement | undefined

  private readonly serverSnapshot: PauseMenuSnapshot

  private snapshot: PauseMenuSnapshot
  private started = false

  constructor(private readonly options: PauseMenuOptions = {}) {
    this.hasGameData = options.hasGameData ?? (options.initialStage === 'reset' ? false : undefined)
    this.snapshot = Object.freeze({
      stage: options.initialStage ?? 'first',
      locked: false,
    })
    this.serverSnapshot = this.snapshot
  }

  private publish(snapshot: PauseMenuSnapshot) {
    if (snapshot.stage === this.snapshot.stage && snapshot.locked === this.snapshot.locked) {
      return
    }
    this.snapshot = Object.freeze(snapshot)
    const listeners = [...this.listeners]
    for (const listener of listeners) {
      listener()
    }
  }
}
