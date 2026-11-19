import type {SloperatorState} from '../../src/lib/telemetry/types.ts'

import {expect, test} from 'bun:test'

import {createStore} from 'zustand/vanilla'

import recordSloperatorSights from '../../src/lib/telemetry/recordSloperatorSights.ts'
import SlopGalleryTelemetry from '../../src/lib/telemetry/SlopGalleryTelemetry.ts'

const decoder = new TextDecoder
const createTelemetry = () => {
  const bodies: Array<string> = []
  const telemetry = new SlopGalleryTelemetry({
    endpoints: {logs: 'https://logs.test/insert/jsonline?_stream_fields=service.name'},
    baseUrl: 'http://gallery.test/',
    interval: false,
    fetch: async (_url, init) => {
      bodies.push(decoder.decode(init.body as Uint8Array))
      return new Response(null, {status: 200})
    },
  })
  const read = async () => {
    await telemetry.flush()
    return bodies.flatMap(body => body.trim().split('\n')).filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>)
  }
  return {
    telemetry,
    read,
  }
}
test('every sight caught of the Sloperator is logged once, with its sight, its distance and where the eye was', async () => {
  const {telemetry, read} = createTelemetry()
  const store = createStore<SloperatorState & {slopped: ReadonlyArray<string>}>(() => ({
    sighted: [],
    slopped: [],
  }))
  const stop = recordSloperatorSights(telemetry, store)
  const armchair = {
    sight: 'lodge_armchair',
    distance: 4.88249,
    position: [-17.86, -3.38, -32.7854] as const,
  }
  const ottoman = {
    sight: 'salon_ottoman',
    distance: 27.5,
    position: [-13.4, 1.62, -0.0004] as const,
  }
  store.setState({sighted: [armchair]})
  // Another sight leaves the first one as it is, and so does leaving the first one’s fence, which only moves it over.
  store.setState({sighted: [armchair, ottoman]})
  store.setState({
    sighted: [ottoman],
    slopped: ['lodge_armchair'],
  })
  stop()
  store.setState({sighted: [ottoman, armchair]})
  const rows = await read()
  const events = rows.filter(row => row['event.name'] === 'gallery.sloperator_sight')
  expect(events).toHaveLength(2)
  expect(events[0]).toMatchObject({
    _msg: 'Caught sight of the Sloperator: lodge_armchair',
    level: 'info',
    'sight.id': 'lodge_armchair',
    'sight.distance': 4.882,
    'position.x': -17.86,
    'position.y': -3.38,
    'position.z': -32.785,
  })
  expect(events[1]).toMatchObject({
    _msg: 'Caught sight of the Sloperator: salon_ottoman',
    'sight.id': 'salon_ottoman',
    'sight.distance': 27.5,
    'position.x': -13.4,
    'position.y': 1.62,
    'position.z': 0,
  })
})
