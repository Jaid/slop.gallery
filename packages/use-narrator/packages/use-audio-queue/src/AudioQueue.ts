import type {AudioClock, AudioEntry, AudioHandle, AudioPhase, AudioPlayback, AudioPriority, AudioProgress, AudioPushOptions, AudioQueueOptions, AudioQueueSnapshot, AudioResult, AudioTask} from './types.ts'

type Job<T> = {
  after: number
  before: number
  controller: AbortController
  deadline: number
  detach?: () => void
  handle: AudioHandle
  id: string
  key?: string
  metadata: T
  phase: AudioPhase
  playback?: AudioPlayback
  priority: AudioPriority
  remaining: number
  resolve: (result: AudioResult) => void
  suspended: boolean
  task: AudioTask<T>
  timer?: () => void
  version: number
}
const clock: AudioClock = {
  now: () => performance.now() / 1000,
  schedule: (callback, delaySeconds) => {
    const timer = setTimeout(callback, delaySeconds * 1000)
    return () => clearTimeout(timer)
  },
}
export function seconds(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('Audio timing must be a finite, non-negative number of seconds.')
  }
  return value
}
const priorities = new Set<AudioPriority>(['normal', 'destructive', 'high', 'inject', 'async', 'volatile', 'shy'])

/** One serialized lane, a resumable interruption stack, and explicitly concurrent jobs. */
export default class AudioQueue<T extends object = Record<string, never>> implements Disposable {
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private afterValue: number
  private beforeValue: number
  private readonly clock: AudioClock
  private counter = 0
  private current: Job<T> | undefined
  private depth = 0
  private dirty = false
  private disposed = false
  private flushing = false
  private gapValue: number
  /** when the pause in effect began, by the queue’s clock, or undefined while the queue runs */
  private heldAt: number | undefined
  private interrupted: Array<Job<T>> = []
  private jobs = new Map<string, Job<T>>
  private lastEnd = -Infinity
  private listeners = new Set<() => void>

  private pending: Array<Job<T>> = []

  private snapshot: AudioQueueSnapshot<T> = Object.freeze({
    current: null,
    pending: [],
    interrupted: [],
    concurrent: [],
    idle: true,
    paused: false,
  })
  constructor(options: AudioQueueOptions = {}) {
    this.clock = options.clock ?? clock
    this.gapValue = seconds(options.gap ?? 0)
    this.beforeValue = seconds(options.prependedSilence ?? 0)
    this.afterValue = seconds(options.appendedSilence ?? 0)
  }
  get appendedSilence() {
    return this.afterValue
  }
  set appendedSilence(value: number) {
    this.afterValue = seconds(value)
  }
  get gap() {
    return this.gapValue
  }
  set gap(value: number) {
    this.gapValue = seconds(value)
  }

  /** whether the queue stands still, see {@link pause} */
  get paused() {
    return this.heldAt !== undefined
  }

  get prependedSilence() {
    return this.beforeValue
  }

  set prependedSilence(value: number) {
    this.beforeValue = seconds(value)
  }
  cancel(id: string, reason?: unknown) {
    this.mutate(() => {
      const job = this.jobs.get(id)
      if (job) {
        this.finish(job, {
          status: 'cancelled',
          reason,
        })
      }
    })
  }

  clear(reason?: unknown) {
    this.mutate(() => {
      for (const job of this.jobs.values()) {
        this.finish(job, {
          status: 'cancelled',
          reason,
        })
      }
    })
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.clear('disposed')
    this.listeners.clear()
  }

  has(id: string) {
    return this.jobs.has(id)
  }

  /**
   * Holds the whole queue still until {@link resume}: every sound pauses where it is, silences stop running down, and nothing new starts to sound.
   * Entries can still be pushed, prepared and cancelled meanwhile, and whatever interrupts another does so as usual, just without a sound.
   */
  pause() {
    if (this.paused || this.disposed) {
      return
    }
    this.mutate(() => {
      this.heldAt = this.clock.now()
      for (const job of this.jobs.values()) {
        if (!job.suspended) {
          this.halt(job)
        }
      }
    })
  }

  /** Where an entry’s playback stands, if its playback reports it. Not part of the snapshot, so polling it never notifies subscribers. */
  progress(id: string): AudioProgress | undefined {
    return this.jobs.get(id)?.playback?.progress?.()
  }

  push(task: AudioTask<T>, options: AudioPushOptions<T> = {}): AudioHandle {
    if (this.disposed) {
      throw new Error('Cannot push to a disposed audio queue.')
    }
    const priority = options.priority ?? 'normal'
    if (!priorities.has(priority)) {
      throw new TypeError(`Unknown audio priority: ${priority}`)
    }
    const before = seconds(options.prependedSilence ?? this.prependedSilence)
    const after = seconds(options.appendedSilence ?? this.appendedSilence)
    const existing = options.key === undefined ? undefined : this.jobs.values().find(job => job.key === options.key)
    if (existing) {
      return existing.handle
    }
    const completion = Promise.withResolvers<AudioResult>()
    const id = String(++this.counter)
    const handle: AudioHandle = {
      id,
      finished: completion.promise,
      cancel: reason => this.cancel(id, reason),
    }
    if (options.signal?.aborted) {
      completion.resolve({
        status: 'cancelled',
        reason: options.signal.reason,
      })
      return handle
    }
    // A shy request is never deferred; even another shy/concurrent job makes it busy.
    if (priority === 'shy' && this.jobs.size) {
      completion.resolve({
        status: 'skipped',
        reason: 'busy',
      })
      return handle
    }
    const job: Job<T> = {
      id,
      task,
      metadata: {...options.metadata} as T,
      priority,
      key: options.key,
      handle,
      resolve: completion.resolve,
      controller: new AbortController,
      phase: 'queued',
      suspended: false,
      before,
      after,
      remaining: 0,
      deadline: 0,
      version: 0,
    }
    this.mutate(() => {
      if (priority === 'destructive') {
        // Explicitly destructive means all owned audio, including async and interrupted jobs.
        for (const old of this.jobs.values()) {
          this.finish(old, {
            status: 'cancelled',
            reason: 'destructive',
          })
        }
      } else {
        for (const old of this.jobs.values()) {
          const yieldingShy = old.priority === 'shy'
          const yieldingVolatile = old === this.current && old.priority === 'volatile'
          if (yieldingShy || yieldingVolatile) {
            this.finish(old, {
              status: 'cancelled',
              reason: 'yielded',
            })
          }
        }
      }
      this.jobs.set(id, job)
      if (options.signal) {
        const abort = () => this.cancel(id, options.signal!.reason)
        options.signal.addEventListener('abort', abort, {once: true})
        job.detach = () => options.signal!.removeEventListener('abort', abort)
        if (options.signal.aborted) {
          this.finish(job, {
            status: 'cancelled',
            reason: options.signal.reason,
          })
          return
        }
      }
      if (priority === 'async') {
        this.prepare(job)
      } else if (priority === 'inject') {
        if (this.current) {
          this.suspend(this.current)
        }
        this.current = job
        this.prepare(job)
      } else if (priority === 'high') {
        const index = this.pending.findIndex(queued => queued.priority !== 'high')
        this.pending.splice(index === -1 ? this.pending.length : index, 0, job)
      } else {
        this.pending.push(job)
      }
    })
    return handle
  }

  /** Lets a queue held by {@link pause} go on right where it stood: sounds play on from their position and silences run down the rest of their time, as if no time had passed. */
  resume() {
    if (this.heldAt === undefined) {
      return
    }
    const {heldAt} = this
    this.mutate(() => {
      this.heldAt = undefined
      // The pause doesn’t count toward the gap between sounds either.
      this.lastEnd += this.clock.now() - heldAt
      for (const job of this.jobs.values()) {
        if (!this.active(job)) {
          continue
        }
        if (job.phase === 'before' || job.phase === 'after') {
          this.wait(job)
        } else if (job.phase === 'playing' || job.phase === 'starting') {
          this.play(job)
        }
      }
    })
  }
  [Symbol.dispose]() {
    this.dispose()
  }

  private active(job: Job<T>) {
    return this.alive(job) && !job.suspended
  }

  private alive(job: Job<T>) {
    return this.jobs.get(job.id) === job
  }

  private before(job: Job<T>, duration: number) {
    job.phase = 'before'
    job.remaining = duration
    if (!job.suspended) {
      this.wait(job)
    }
  }
  private ended(job: Job<T>) {
    this.mutate(() => {
      if (!this.alive(job) || job.phase === 'after') {
        return
      }
      if (job.priority !== 'async' && !job.suspended) {
        this.lastEnd = this.soundingUntil()
      }
      job.version++
      job.phase = 'after'
      job.remaining = job.after
      if (!job.suspended) {
        this.wait(job)
      }
    })
  }

  private fail(job: Job<T>, error: unknown) {
    this.mutate(() => {
      if (this.alive(job)) {
        this.finish(job, {
          status: 'failed',
          error,
        })
      }
    })
  }

  private finish(job: Job<T>, result: AudioResult) {
    if (!this.alive(job)) {
      return
    }
    this.jobs.delete(job.id)
    if (this.current === job) {
      if (job.phase === 'playing' || job.phase === 'starting') {
        this.lastEnd = this.soundingUntil()
      }
      this.current = undefined
    }
    this.pending = this.pending.filter(item => item !== job)
    this.interrupted = this.interrupted.filter(item => item !== job)
    job.version++
    job.timer?.()
    job.detach?.()
    job.controller.abort(result)
    try {
      job.playback?.dispose()
    } catch (error) {
      if (result.status === 'completed') {
        result = {
          status: 'failed',
          error,
        }
      }
    }
    job.resolve(result)
    this.dirty = true
  }

  private flush() {
    if (this.flushing) {
      return
    }
    this.flushing = true
    try {
      while (this.dirty) {
        this.dirty = false
        if (!this.current && !this.disposed) {
          const next = this.interrupted.pop() ?? this.pending.shift()
          if (next) {
            this.current = next
            next.suspended = false
            if (next.phase === 'queued') {
              this.prepare(next)
            } else if (next.phase === 'before' || next.phase === 'after') {
              this.wait(next)
            } else if (next.phase === 'playing' || next.phase === 'starting') {
              // Resume at the saved transport position, without prepending silence a second time.
              this.before(next, 0)
            }
          }
        }
        const entry = (job: Job<T>): AudioEntry<T> => Object.freeze({
          id: job.id,
          key: job.key,
          metadata: Object.freeze({...job.metadata}),
          priority: job.priority,
          phase: job.phase,
          phaseEndsAt: !job.suspended && job.timer && (job.phase === 'before' || job.phase === 'after') ? job.deadline : undefined,
          suspended: job.suspended,
        })
        this.snapshot = Object.freeze({
          current: this.current ? entry(this.current) : null,
          pending: Object.freeze(this.pending.map(entry)),
          interrupted: Object.freeze(this.interrupted.map(entry)),
          concurrent: Object.freeze(this.jobs.values().filter(job => job.priority === 'async').map(entry).toArray()),
          idle: this.jobs.size === 0,
          paused: this.paused,
        })
        for (const listener of this.listeners) {
          listener()
        }
      }
    } finally {
      this.flushing = false
    }
  }

  /** Stops a job where it is, keeping what is left of its silence and its playback’s position: its timer no longer runs down, and its sound pauses. */
  private halt(job: Job<T>) {
    job.version++
    if (job.timer) {
      job.remaining = Math.max(0, job.deadline - this.clock.now())
      job.timer()
      job.timer = undefined
    }
    if (job.phase === 'playing' || job.phase === 'starting') {
      try {
        job.playback?.pause()
      } catch (error) {
        this.finish(job, {
          status: 'failed',
          error,
        })
      }
    }
  }

  private mutate(action: () => void) {
    this.depth++
    try {
      action()
      this.dirty = true
    } finally {
      this.depth--
      if (!this.depth) {
        this.flush()
      }
    }
  }

  private play(job: Job<T>) {
    job.phase = 'starting'
    const version = ++job.version
    // eslint-disable-next-line unicorn/prefer-promise-try -- Deferred on purpose; Promise.try would start playback synchronously.
    void Promise.resolve().then(() => {
      if (this.active(job) && job.version === version) {
        return job.playback!.play()
      }
    }).then(() => this.mutate(() => {
      if (this.active(job) && job.version === version && job.phase === 'starting') {
        job.phase = 'playing'
      }
    }), error => {
      // Pausing a pending HTMLMediaElement.play() commonly rejects that *old* start promise.
      if (this.active(job) && job.version === version) {
        this.fail(job, error)
      }
    })
  }

  private prepare(job: Job<T>) {
    job.phase = 'preparing'
    // Run user factories outside a queue mutation; they may synchronously push/cancel other jobs.
    // eslint-disable-next-line unicorn/prefer-promise-try -- Deferred on purpose; Promise.try would run the factory synchronously, inside the mutation.
    void Promise.resolve().then(() => {
      job.controller.signal.throwIfAborted()
      return job.task({
        signal: job.controller.signal,
        update: metadata => this.mutate(() => {
          if (this.alive(job)) {
            job.metadata = {
              ...job.metadata,
              ...metadata,
            }
          }
        }),
      })
    }).then(playback => {
      if (!this.alive(job)) {
        // A provider that ignored cancellation must still release a late-created resource.
        void playback.finished.catch(() => {})
        playback.dispose()
        return
      }
      this.mutate(() => {
        job.playback = playback
        void playback.finished.then(() => this.ended(job), error => this.fail(job, error))
        this.before(job, job.before)
      })
    }).catch(error => this.fail(job, error))
  }

  /** When a sound that stops now fell silent, by the queue’s clock: now, or when the pause in effect began, which silenced it already. */
  private soundingUntil() {
    return this.heldAt ?? this.clock.now()
  }

  private suspend(job: Job<T>) {
    this.current = undefined
    this.interrupted.push(job)
    job.suspended = true
    if (job.phase === 'playing' || job.phase === 'starting') {
      this.lastEnd = this.soundingUntil()
    }
    // A paused queue halted it when the pause began.
    if (!this.paused) {
      this.halt(job)
    }
  }

  private wait(job: Job<T>) {
    // A paused queue keeps what is left of the silence for when it resumes.
    if (!this.active(job) || this.paused) {
      return
    }
    job.timer?.()
    if (job.phase === 'before' && job.priority !== 'async') {
      job.remaining = Math.max(job.remaining, this.lastEnd + this.gap - this.clock.now())
    }
    if (job.remaining <= 0) {
      if (job.phase === 'after') {
        this.finish(job, {status: 'completed'})
      } else {
        this.play(job)
      }
      return
    }
    job.deadline = this.clock.now() + job.remaining
    job.timer = this.clock.schedule(() => this.mutate(() => {
      job.timer = undefined
      job.remaining = 0
      if (!this.active(job)) {
        return
      }
      if (job.phase === 'after') {
        this.finish(job, {status: 'completed'})
      } else {
        this.play(job)
      }
    }), job.remaining)
  }
}
