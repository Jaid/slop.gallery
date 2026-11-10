import type {FusionSpec} from '../../src/lib/gallery/fusion/Fusion.ts'
import type {FusionIngredient} from '../../src/lib/gallery/fusion/FusionRecipe.ts'
import type {FusionTiming} from '../../src/lib/gallery/fusion/timing.ts'

import {afterEach, expect, test} from 'bun:test'

import Fusion from '../../src/lib/gallery/fusion/Fusion.ts'
import {portalFrame} from '../../src/lib/gallery/fusion/portalFrame.ts'
import FusionTrace from '../../src/lib/telemetry/FusionTrace.ts'
import {describeEnvironment} from '../../src/lib/telemetry/recordEnvironment.ts'
import recordStaleChunkReload from '../../src/lib/telemetry/recordStaleChunkReload.ts'
import SlopGalleryTelemetry from '../../src/lib/telemetry/SlopGalleryTelemetry.ts'

type OtlpValue = {
  boolValue?: boolean
  doubleValue?: number
  intValue?: number
  stringValue?: string
}
type OtlpAttribute = {
  key: string
  value: OtlpValue
}
type OtlpSpan = {
  attributes: Array<OtlpAttribute>
  events: Array<{
    attributes: Array<OtlpAttribute>
    name: string
  }>
  name: string
  parentSpanId?: string
  spanId: string
  status: {code: number}
}

const decoder = new TextDecoder
const createTelemetry = () => {
  const requests: Array<{
    body: string
    url: string
  }> = []
  const telemetry = new SlopGalleryTelemetry({
    endpoints: {
      logs: 'https://logs.test/insert/jsonline?_stream_fields=service.name',
      traces: 'https://traces.test/insert/opentelemetry/v1/traces',
    },
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch: async (url: RequestInfo | URL, init: RequestInit) => {
      requests.push({
        url: url instanceof Request ? url.url : url.toString(),
        body: decoder.decode(init.body as Uint8Array),
      })
      return new Response(null, {status: 200})
    },
  })
  const logs = async () => {
    await telemetry.flush()
    return requests.filter(request => request.url.startsWith('https://logs.test')).flatMap(request => request.body.trim().split('\n')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>)
  }
  const spans = async () => {
    await telemetry.flush()
    return requests.filter(request => request.url.startsWith('https://traces.test')).flatMap(request => (JSON.parse(request.body) as {resourceSpans: Array<{scopeSpans: Array<{spans: Array<OtlpSpan>}>}>}).resourceSpans.flatMap(resource => resource.scopeSpans.flatMap(scope => scope.spans)))
  }
  return {
    telemetry,
    logs,
    spans,
  }
}
const value = ({boolValue, doubleValue, intValue, stringValue}: OtlpValue) => boolValue ?? doubleValue ?? intValue ?? stringValue
const attributesOf = (attributes: Array<OtlpAttribute>) => Object.fromEntries(attributes.map(attribute => [attribute.key, value(attribute.value)]))
const stubbedGlobals = new Map<string, PropertyDescriptor | undefined>
/** Stubs a global, or a property of `navigator`, until the test is over. */
const stub = (target: object, key: string, stubbed: unknown) => {
  const id = `${target === navigator ? 'navigator.' : ''}${key}`
  if (!stubbedGlobals.has(id)) {
    stubbedGlobals.set(id, Object.getOwnPropertyDescriptor(target, key))
  }
  Object.defineProperty(target, key, {
    configurable: true,
    value: stubbed,
  })
}
afterEach(() => {
  for (const [id, descriptor] of stubbedGlobals) {
    const [target, key] = id.startsWith('navigator.') ? [navigator, id.slice('navigator.'.length)] : [globalThis, id]
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      Reflect.deleteProperty(target, key)
    }
  }
  stubbedGlobals.clear()
})
test('a reload for a stale chunk is reported once by the page it led to, linked to the session it ended', async () => {
  const storage = new Map<string, string>([['slop-gallery-stale-chunk-report', JSON.stringify({
    at: 1000,
    chunk: '/assets/Forge-abc.js',
    sessionId: 'previousSession',
  })]])
  stub(globalThis, 'sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
  })
  const {telemetry, logs} = createTelemetry()
  recordStaleChunkReload(telemetry, 3500)
  recordStaleChunkReload(telemetry, 4000)
  const records = await logs()
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject({
    'event.name': 'gallery.chunk.stale_reload',
    level: 'warn',
    _msg: 'Reloaded for a stale chunk: /assets/Forge-abc.js',
    'chunk.path': '/assets/Forge-abc.js',
    'reload.delay_ms': 2500,
    'reload.previous_session_id': 'previousSession',
  })
  await telemetry.shutdown()
})
test('the environment names the GPU, the display, the hardware and the browser, without what the browser didn’t report', async () => {
  stub(navigator, 'userAgentData', {
    brands: [{
      brand: 'Not.A/Brand',
      version: '99',
    }, {
      brand: 'Chromium',
      version: '154',
    }, {
      brand: 'Google Chrome',
      version: '154',
    }],
    mobile: false,
    platform: 'Windows',
    getHighEntropyValues: async () => ({
      architecture: 'x86',
      bitness: '64',
      platformVersion: '19.0.0',
      fullVersionList: [{
        brand: 'Chromium',
        version: '154.0.7700.12',
      }, {
        brand: 'Google Chrome',
        version: '154.0.7700.12',
      }, {
        brand: 'Not.A/Brand',
        version: '99.0.0.0',
      }],
    }),
  })
  stub(navigator, 'deviceMemory', 8)
  stub(globalThis, 'devicePixelRatio', 1.25)
  stub(globalThis, 'innerWidth', 1918)
  stub(globalThis, 'innerHeight', 1112)
  stub(globalThis, 'screen', {
    width: 2560,
    height: 1440,
  })
  stub(globalThis, 'matchMedia', (query: string) => ({matches: query === '(color-gamut: srgb)'}))
  const adapter = {
    info: {
      vendor: 'nvidia',
      architecture: 'lovelace',
      device: '',
      description: '',
    },
    features: new Set(['timestamp-query']),
    limits: {maxTextureDimension2D: 16_384},
  } as unknown as GPUAdapter
  const environment = await describeEnvironment(Promise.resolve(adapter))
  expect(environment).toMatchObject({
    'gpu.vendor': 'nvidia',
    'gpu.architecture': 'lovelace',
    'gpu.timestamp_query': true,
    'gpu.max_texture_dimension_2d': 16_384,
    'display.pixel_ratio': 1.25,
    'display.color_gamut': 'srgb',
    'display.hdr': false,
    'screen.width': 2560,
    'screen.height': 1440,
    'viewport.width': 1918,
    'viewport.height': 1112,
    'host.memory_gb': 8,
    'host.arch': 'x86-64',
    'browser.name': 'Google Chrome',
    'browser.version': '154.0.7700.12',
    'browser.mobile': false,
    'os.name': 'Windows',
    'os.version': '19.0.0',
  })
  // Empty adapter info and what the navigator lacks are left out.
  expect(environment).not.toHaveProperty('gpu.device')
  expect(environment).not.toHaveProperty('gpu.description')
  expect(environment).not.toHaveProperty('host.cpu.performance')
})
const brief: FusionTiming = {
  intro: 0.02,
  lull: 0.02,
  image: 0.04,
  minimum: 0.05,
  climax: 0.02,
  afterglow: 0.02,
  fizzle: 0.02,
}
const spec = (partner: FusionSpec['partner']): FusionSpec => ({
  work: {
    id: 'a',
    width: 2,
    height: 1.5,
    position: [0, 1.6, -2.95],
    rotation: 0,
  },
  partner,
  images: [],
  latches: ['charge', 'charge'],
  effects: [],
})
const openFusion = (partner: FusionSpec['partner'] = {
  kind: 'item',
  id: 'prop-orb-horror',
  consumed: true,
}) => new Fusion(spec(partner), {
  frame: portalFrame(spec(partner).work, {
    floor: 0,
    room: 5,
    sides: [3, 3],
  }),
  timing: brief,
})
/** a recipe of ingredients of these kinds, the hung portrait first */
const recipeOf = (kinds: Array<FusionIngredient['kind']>, unchanged = false) => ({
  ingredients: kinds.map((kind, index) => ({
    kind,
    title: `ingredient ${index}`,
    contributions: [],
  })),
  unchanged,
})
test('a fusion is one span from its portal opening to its end, with the model’s request inside', async () => {
  const {telemetry, spans} = createTelemetry()
  const fusion = openFusion()
  const trace = new FusionTrace(telemetry, fusion, {
    recipe: recipeOf(['portrait', 'item']),
    items: [{
      id: 'prop-orb-horror',
      consumed: true,
    }],
    attributes: {
      mode: 'local',
      room: 'lobby',
    },
  })
  await trace.generate(async span => {
    span.setAttributes({width: 1024})
  })
  await fusion.succeed('result')
  fusion.emerge()
  trace.end()
  trace.end()
  fusion.finish()
  const exported = await spans()
  expect(exported.map(span => span.name)).toEqual(['gallery.fusion.generate', 'gallery.fusion'])
  const [generate, parent] = exported
  expect(generate.parentSpanId).toBe(parent.spanId)
  expect(attributesOf(generate.attributes)).toMatchObject({width: 1024})
  expect(parent.status.code).toBe(1)
  expect(attributesOf(parent.attributes)).toMatchObject({
    'fusion.id': fusion.id,
    'fusion.ingredients': 2,
    'fusion.ingredient_kinds': 'portrait,item',
    'fusion.unchanged': false,
    'fusion.items': 'prop-orb-horror',
    'fusion.consumable_items': 'prop-orb-horror',
    mode: 'local',
    room: 'lobby',
    'fusion.outcome': 'succeeded',
    'fusion.outcome_at_s': brief.minimum,
  })
  expect(attributesOf(parent.attributes)['fusion.emerged_at_s']).toBeGreaterThanOrEqual(brief.minimum + brief.climax)
  await telemetry.shutdown()
})
test('jumping into the portal marks the span with the cancellation trigger, and the span ends canceled', async () => {
  const {telemetry, spans} = createTelemetry()
  const fusion = openFusion({
    kind: 'portrait',
    id: 'b',
  })
  const trace = new FusionTrace(telemetry, fusion, {recipe: recipeOf(['portrait', 'portrait'])})
  await Bun.sleep(30)
  expect(fusion.cancel()).toBe(true)
  // The broken-off request rejects with the signal’s reason, which does not make it a failure.
  trace.fail(fusion.signal.reason)
  await fusion.fail()
  trace.end()
  const [span] = await spans()
  expect(span.events.map(event => event.name)).toEqual(['gallery.fusion.cancellation_triggered'])
  const cancellation = attributesOf(span.events[0].attributes)
  expect(cancellation['cancellation.trigger']).toBe('portal_jump')
  expect(cancellation['fusion.elapsed_s']).toBeGreaterThanOrEqual(0.03)
  const attributes = attributesOf(span.attributes)
  expect(attributes).toMatchObject({
    'fusion.ingredient_kinds': 'portrait,portrait',
    'fusion.outcome': 'canceled',
  })
  expect(attributes).not.toHaveProperty('error.type')
  expect(attributes['fusion.canceled_at_s']).toBe(cancellation['fusion.elapsed_s'])
  expect(span.status.code).toBe(1)
  await telemetry.shutdown()
})
test('a fusion that went wrong ends as an error with the error’s type, one that was dropped as aborted and one with nothing contributed as unchanged', async () => {
  const {telemetry, spans} = createTelemetry()
  const failing = openFusion()
  const failed = new FusionTrace(telemetry, failing, {recipe: recipeOf(['portrait', 'item'])})
  failed.fail(new TypeError('the model broke'))
  await failing.fail()
  failed.end()
  const dropping = openFusion()
  const dropped = new FusionTrace(telemetry, dropping, {recipe: recipeOf(['portrait', 'item'])})
  dropping.abort()
  dropped.end()
  const echoing = openFusion()
  const echoed = new FusionTrace(telemetry, echoing, {recipe: recipeOf(['portrait', 'item'], true)})
  await echoing.succeed('own image')
  echoing.emerge()
  echoed.end()
  echoing.finish()
  const exported = await spans()
  expect(exported.map(span => [attributesOf(span.attributes)['fusion.outcome'], span.status.code])).toEqual([
    ['failed', 2],
    ['aborted', 1],
    ['unchanged', 1],
  ])
  expect(attributesOf(exported[0].attributes)['error.type']).toBe('TypeError')
  expect(JSON.stringify(exported)).not.toContain('the model broke')
  await telemetry.shutdown()
})
test('a fusion of up to four ingredients lists every one by its kind and every item, and only the consumable ones as such', async () => {
  const {telemetry, spans} = createTelemetry()
  const fusion = openFusion()
  const trace = new FusionTrace(telemetry, fusion, {
    recipe: recipeOf(['portrait', 'item', 'portrait', 'item']),
    items: [{
      id: 'prop-orb-spook',
      consumed: true,
    }, {
      id: 'prop-pumpkin',
      consumed: false,
    }],
  })
  fusion.abort()
  trace.end()
  const [span] = await spans()
  expect(attributesOf(span.attributes)).toMatchObject({
    'fusion.ingredients': 4,
    'fusion.ingredient_kinds': 'portrait,item,portrait,item',
    'fusion.items': 'prop-orb-spook,prop-pumpkin',
    'fusion.consumable_items': 'prop-orb-spook',
  })
  await telemetry.shutdown()
})
