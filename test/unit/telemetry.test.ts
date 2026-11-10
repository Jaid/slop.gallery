import type {GalleryState} from '../../src/lib/telemetry/types.ts'

import {expect, test} from 'bun:test'

import EgoTelemetry from 'telemethree-ego'
import {createStore} from 'zustand/vanilla'

import SlopGalleryTelemetry from '../../src/lib/telemetry/SlopGalleryTelemetry.ts'
import slopGallery from '../../src/worlds/gallery/index.ts'

type RequestRecord = {
  body: string
  headers: Headers
  url: string
}
type OtlpAttribute = {
  key: string
  value: {
    boolValue?: boolean
    doubleValue?: number
    intValue?: number
    stringValue?: string
  }
}
type OtlpSpan = {
  attributes: Array<OtlpAttribute>
  events: Array<{name: string}>
  name: string
  parentSpanId?: string
  spanId: string
  traceId: string
}
type OtlpTraces = {resourceSpans?: Array<{scopeSpans: Array<{spans: Array<OtlpSpan>}>}>}

const endpoints = {
  logs: 'https://logs.test/insert/jsonline?_stream_fields=service.name',
  metrics: 'https://metrics.test/api/v1/import',
  traces: 'https://traces.test/insert/opentelemetry/v1/traces',
}
const decoder = new TextDecoder
const bodyText = (body: BodyInit | null | undefined) => {
  if (typeof body === 'string') {
    return body
  }
  if (body instanceof Uint8Array) {
    return decoder.decode(body)
  }
  return ''
}
const requestUrl = (url: RequestInfo | URL) => {
  if (url instanceof Request) {
    return url.url
  }
  return url.toString()
}
const capture = () => {
  const requests: Array<RequestRecord> = []
  const fetch = (async (url, init) => {
    requests.push({
      url: requestUrl(url),
      body: bodyText(init?.body),
      headers: new Headers(init?.headers),
    })
    return new Response(null, {status: requestUrl(url).includes('/api/v1/import') ? 204 : 200})
  }) as typeof globalThis.fetch
  return {
    requests,
    fetch,
  }
}
const traceSpans = (requests: ReadonlyArray<RequestRecord>) => requests.filter(request => request.url.endsWith('/traces')).flatMap(request => {
  const body = JSON.parse(request.body) as OtlpTraces
  return body.resourceSpans?.flatMap(resource => resource.scopeSpans.flatMap(scope => scope.spans)) ?? []
})
const initial: GalleryState = {
  portraits: [{hung: true}],
  room: 'lobby',
  ready: false,
  locked: false,
  held: null,
  inspecting: null,
  ai: false,
  narration: null,
  revision: 0,
}
test('per-frame player metrics survive a high-refresh delivery interval with aligned timestamps', async () => {
  const {requests, fetch} = capture()
  let time = 1000
  const telemetry = new SlopGalleryTelemetry({
    endpoints: {metrics: endpoints.metrics},
    interval: false,
    fetch,
    now: () => time,
  })
  const ego = new EgoTelemetry({
    telemetry,
    intervalMs: 0,
    now: () => time,
    read: () => ({
      position: {
        x: time,
        y: 2,
        z: 3,
      },
      velocity: {
        x: 4,
        y: 5,
        z: 6,
      },
      aim: {
        origin: {
          x: time,
          y: 3.6,
          z: 3,
        },
        direction: {
          x: -1,
          y: 0,
          z: 0,
        },
      },
    }),
  })
  const timestamps = Array.from({length: 480}, (_, frame) => {
    time = 1000 + frame * 1000 / 480
    ego.update()
    return Math.trunc(time)
  })
  expect(telemetry.status().signals.metrics.dropped).toBe(0)
  expect(requests).toHaveLength(0)
  await telemetry.flush({throwOnPending: true})
  const samples = new Map<string, Array<[number, number]>>
  for (const request of requests) {
    for (const line of request.body.trim().split('\n')) {
      const record = JSON.parse(line) as {
        metric: {__name__: string}
        timestamps: Array<number>
        values: Array<number>
      }
      const name = record.metric.__name__
      const series = samples.get(name) ?? []
      series.push(...record.timestamps.map((timestamp, index) => [timestamp, record.values[index]] as [number, number]))
      samples.set(name, series)
    }
  }
  expect(samples.size).toBeGreaterThan(0)
  for (const series of samples.values()) {
    expect(series.map(([timestamp]) => timestamp)).toEqual(timestamps)
  }
  expect(samples.get('ego.position.x')?.at(-1)?.[1]).toBe(time)
  expect(samples.get('ego.velocity.z')?.at(-1)?.[1]).toBe(6)
  expect(samples.get('ego.aim.yaw')?.at(-1)?.[1]).toBe(Math.PI / 2)
  expect(requests.length).toBeLessThan(20)
  await telemetry.shutdown()
})
test('gallery adapters record bounded state and lifecycle data without private gallery contents', async () => {
  const {requests, fetch} = capture()
  const telemetry = new SlopGalleryTelemetry({
    sessionId: 'test-session',
    endpoints,
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch,
  })
  const store = createStore(() => ({
    ...initial,
    apiKey: 'secret-key',
    portraits: [{
      hung: true,
      title: 'private artwork',
      source: 'private image',
    }],
  }))
  const events = new EventTarget
  const stop = telemetry.connect(store, events)
  store.setState({
    room: 'sienna',
    ready: true,
  })
  events.dispatchEvent(new CustomEvent('fusion', {detail: ['private-first-id', 'private-second-id']}))
  telemetry.sample(store.getState())
  stop()
  stop()
  await telemetry.flush()
  const records = requests.map(request => request.body).join('\n')
  expect(records).toContain('gallery.room.changed')
  expect(records).toContain('gallery.fusion.requested')
  expect(records).not.toContain('secret-key')
  expect(records).not.toContain('private artwork')
  expect(records).not.toContain('private-first-id')
  expect(telemetry.resource).toMatchObject({
    'service.name': 'slop.gallery',
    'service.namespace': 'web',
    world: 'gallery',
    'service.instance.id': 'test-session',
  })
  const metricBodies = requests.filter(request => request.url === endpoints.metrics).flatMap(request => request.body.trim().split('\n').filter(Boolean)).map(line => JSON.parse(line) as {
    metric: Record<string, string>
    values: Array<number>
  })
  const roomMetrics = metricBodies.filter(metric => Reflect.get(metric.metric, '__name__') === 'gallery.room.active').slice(-slopGallery.rooms.length)
  expect(Object.fromEntries(roomMetrics.map(metric => [metric.metric.room, metric.values.at(-1)]))).toEqual(Object.fromEntries(slopGallery.rooms.map(room => [room.id, Number(room.id === 'sienna')])))
  const count = requests.length
  store.setState({locked: true})
  events.dispatchEvent(new Event('fusion'))
  await telemetry.flush()
  expect(requests).toHaveLength(count)
  await telemetry.shutdown()
})
test('gallery telemetry sends native Victoria logs/metrics and OTLP traces straight to the configured backends', async () => {
  const {requests, fetch} = capture()
  const telemetry = new SlopGalleryTelemetry({
    endpoints,
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch,
    now: () => 1234.5,
  })
  expect(telemetry.sessionId).toMatch(/^[0-9A-Za-z]{15}$/u)
  telemetry.metric('ego.position.x', 4.2, {
    unit: 'm',
    attributes: {room: 'sienna'},
  })
  telemetry.event('verification')
  await telemetry.flush()
  expect(requests.map(item => item.url).toSorted()).toEqual([endpoints.logs, endpoints.metrics, endpoints.traces])
  const [logsRequest, metricsRequest, tracesRequest] = requests.toSorted((a, b) => a.url.localeCompare(b.url))
  const metric = JSON.parse(metricsRequest.body.trim().split('\n')[0]) as unknown
  expect(metric).toMatchObject({
    metric: {
      __name__: 'ego.position.x',
      room: 'sienna',
      'service.name': 'slop.gallery',
      world: 'gallery',
    },
    values: [4.2],
    timestamps: [1234],
  })
  expect(JSON.parse(logsRequest.body.trim().split('\n')[0]) as unknown).toMatchObject({
    _msg: 'Gallery event: verification',
    'service.name': 'slop.gallery',
    world: 'gallery',
  })
  expect(JSON.parse(tracesRequest.body)).toHaveProperty('resourceSpans')
  expect(metricsRequest.headers.get('content-type')).toContain('application')
  await telemetry.shutdown()
})
test('signals without an ingestion endpoint are not sent', async () => {
  const {requests, fetch} = capture()
  const telemetry = new SlopGalleryTelemetry({
    endpoints: {metrics: endpoints.metrics},
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch,
  })
  telemetry.metric('ego.position.x', 1)
  telemetry.event('verification')
  await telemetry.flush()
  expect(requests.map(item => item.url)).toEqual([endpoints.metrics])
  await telemetry.shutdown()
})
test('startup, gameplay and operations share a session trace with state changes as events', async () => {
  const {requests, fetch} = capture()
  const telemetry = new SlopGalleryTelemetry({
    endpoints,
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch,
  })
  const store = createStore(() => initial)
  const stop = telemetry.connect(store)
  expect(() => telemetry.connect(store)).toThrow('one gallery telemetry')
  await telemetry.wrap('three.init', async () => {})
  store.setState({ready: true})
  store.setState({locked: true})
  const gameplay = telemetry.getContext()!
  store.setState({room: 'sienna'})
  await telemetry.wrap('gallery.fusion', async () => {})
  store.setState({locked: false})
  stop()
  await telemetry.flush()
  const traces = traceSpans(requests)
  const session = traces.find(trace => trace.name === 'gallery.session')!
  const startup = traces.find(trace => trace.name === 'gallery.startup')!
  const play = traces.find(trace => trace.name === 'gallery.gameplay')!
  expect(traces.every(trace => trace.traceId === session.traceId)).toBe(true)
  expect(play.parentSpanId).toBe(session.spanId)
  expect(startup.parentSpanId).toBe(session.spanId)
  expect(traces.find(trace => trace.name === 'three.init')?.parentSpanId).toBe(startup.spanId)
  expect(traces.find(trace => trace.name === 'gallery.fusion')?.parentSpanId).toBe(gameplay.spanId)
  expect(play.events.some(event => event.name === 'gallery.room.changed')).toBe(true)
  expect(traces.some(trace => trace.name === 'gallery.room.changed')).toBe(false)
  expect(telemetry.getContext()).toBeUndefined()
  const detach = telemetry.connect(store)
  expect(telemetry.getContext()?.traceId).not.toBe(session.traceId)
  detach()
  await telemetry.shutdown()
})
