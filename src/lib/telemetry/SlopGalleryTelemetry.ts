import type {GalleryState, GalleryStore, SlopGalleryTelemetryOptions} from './types.ts'
import type {Attributes, LogLevel, Span, SpanOptions} from 'victoria-browser-client'

import VictoriaClient, {MemoryOutbox} from 'victoria-browser-client'

import world from '#src/worlds/current.ts'

/** More attributes for a `room.changed` event, set by whoever knows what the move switches; the scene lists the lights it turns on and off. */
export const roomChangeDetails: {current: (from: string, to: string) => Attributes} = {current: () => ({})}

const roomTitle = (id: string) => world.roomById(id)?.title ?? id

export default class SlopGalleryTelemetry extends VictoriaClient {
  readonly sessionId: string
  private gameplay: Span | undefined
  private readonly sampleIntervalMs: number
  private session: Span | undefined
  private startup: Span | undefined

  constructor(options: SlopGalleryTelemetryOptions = {}) {
    const {
      endpoints = {},
      environment = 'development',
      resource = {},
      sampleIntervalMs = 5000,
      sessionId,
      version = '0.1.0',
      ...clientOptions
    } = options
    super({
      interval: 1000,
      // Native metrics compact repeated series into arrays; admit enough observations per batch to benefit.
      maxBatchBytes: 256_000,
      maxBatchItems: 4096,
      // Per-frame ego samples exceed the default 2048 items between deliveries at high refresh rates.
      outbox: new MemoryOutbox({maxItems: 32_768}),
      ...clientOptions,
      serviceName: 'slop.gallery',
      endpoints: {
        logs: endpoints.logs ? {
          url: endpoints.logs,
          format: 'victoria-logs',
        } : false,
        metrics: endpoints.metrics ? {
          url: endpoints.metrics,
          format: 'victoria-json',
        } : false,
        traces: endpoints.traces ?? false,
      },
      resource: {
        'service.namespace': 'web',
        'service.version': version,
        world: world.id,
        'deployment.environment.name': environment,
        ...resource,
        ...sessionId ? {'service.instance.id': sessionId} : {},
      },
    })
    const instanceId = this.resource['service.instance.id']
    if (typeof instanceId !== 'string') {
      throw new TypeError('Victoria client did not provide a service instance ID.')
    }
    this.sessionId = instanceId
    this.sampleIntervalMs = sampleIntervalMs
    if (!Number.isSafeInteger(this.sampleIntervalMs) || this.sampleIntervalMs <= 0) {
      throw new RangeError('sampleIntervalMs must be a positive integer.')
    }
  }

  /** Subscribes once per attachment; every timer/listener/span is paired with cleanup. */
  connect(store: GalleryStore, events?: EventTarget) {
    if (this.session) {
      throw new Error('Mount only one gallery telemetry attachment.')
    }
    const initial = store.getState()
    this.session = super.startSpan('gallery.session', {attributes: {room: initial.room}})
    if (!initial.ready) {
      this.startup = super.startSpan('gallery.startup', {parent: this.session})
    }
    if (initial.locked) {
      this.gameplay = super.startSpan('gallery.gameplay', {
        attributes: {room: initial.room},
        parent: this.session,
      })
    }
    this.sample(initial)
    this.event('session.attached', {room: initial.room})
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.locked && !previous.locked) {
        this.gameplay = super.startSpan('gallery.gameplay', {
          attributes: {room: state.room},
          parent: this.session,
        })
      }
      if (state.room !== previous.room) {
        this.event('room.changed', {
          from: previous.room,
          to: state.room,
          ...roomChangeDetails.current(previous.room, state.room),
        }, `Room changed: ${roomTitle(previous.room)} → ${roomTitle(state.room)}`)
      }
      for (const key of ['locked', 'ready'] as const) {
        if (state[key] !== previous[key]) {
          this.event(`${key}.changed`, {value: state[key]})
        }
      }
      if (!state.locked && previous.locked) {
        this.gameplay?.end()
        this.gameplay = undefined
      }
      if (state.ready && !previous.ready) {
        this.startup?.addEvent('gallery.ready')
        this.startup?.end()
        this.startup = undefined
      }
      if (state.revision !== previous.revision) {
        this.event('collection.changed', {portraits: state.portraits.length})
      }
      if (state.narration?.status !== previous.narration?.status || state.narration?.source !== previous.narration?.source) {
        this.event('narration.changed', {
          status: state.narration?.status ?? 'idle',
          source: state.narration?.source ?? 'none',
        })
      }
    })
    const listeners = ['imported', 'fusion', 'item-fusion', 'narrate', 'stop-narration', 'teleport'].map(name => {
      const listener = () => this.event(`${name}.requested`)
      events?.addEventListener(name, listener)
      return () => events?.removeEventListener(name, listener)
    })
    const timer = setInterval(() => this.sample(store.getState()), this.sampleIntervalMs)
    let closed = false
    return () => {
      if (closed) {
        return
      }
      closed = true
      clearInterval(timer)
      unsubscribe()
      for (const remove of listeners) {
        remove()
      }
      this.event('session.detached')
      this.gameplay?.end('unset', {outcome: 'detached'})
      this.startup?.end('unset', {outcome: 'detached'})
      this.session?.end()
      this.gameplay = undefined
      this.startup = undefined
      this.session = undefined
    }
  }

  event(name: string, attributes: Attributes = {}, message = `Gallery event: ${name}`, level: LogLevel = 'info') {
    this.increment('gallery.events', 1, {attributes: {event: name}})
    const parent = this.gameplay ?? this.startup ?? this.session
    const span = parent ?? this.startSpan(`gallery.${name}`, {attributes})
    parent?.addEvent(`gallery.${name}`, attributes)
    this.log(message, {
      level,
      attributes: {
        'event.name': `gallery.${name}`,
        ...attributes,
      },
      context: span,
    })
    if (!parent) {
      span.end()
    }
  }

  getContext() {
    return this.gameplay ?? this.startup ?? this.session
  }

  sample(state: GalleryState) {
    this.metric('gallery.portraits', state.portraits.length)
    for (const flag of ['hung', 'pending', 'fusing', 'imported'] as const) {
      this.metric(`gallery.portraits.${flag}`, state.portraits.filter(portrait => portrait[flag]).length)
    }
    for (const flag of ['ready', 'locked', 'ai'] as const) {
      this.metric(`gallery.${flag}`, Number(state[flag]))
    }
    this.metric('gallery.holding', Number(state.held !== null))
    this.metric('gallery.inspecting', Number(state.inspecting !== null))
    this.metric('gallery.narration.active', Number(state.narration !== null))
    for (const {id: room} of world.rooms) {
      this.metric('gallery.room.active', Number(room === state.room), {attributes: {room}})
    }
  }

  override startSpan(name: string, options: SpanOptions = {}) {
    return super.startSpan(name, {
      ...options,
      parent: options.parent ?? this.getContext(),
    })
  }

  override wrap<T>(name: string, operation: (span: Span) => T, options: SpanOptions = {}): T {
    return super.wrap(name, operation, {
      ...options,
      parent: options.parent ?? this.getContext(),
    })
  }
}
