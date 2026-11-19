import type {GeofenceState} from '../../src/lib/telemetry/types.ts'

import {expect, test} from 'bun:test'

import {createStore} from 'zustand/vanilla'

import recordGeofenceCrossings from '../../src/lib/telemetry/recordGeofenceCrossings.ts'
import SlopGalleryTelemetry from '../../src/lib/telemetry/SlopGalleryTelemetry.ts'

type Vec3 = readonly [number, number, number]

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
/** A store of the fences a player is in who starts in those given: two rooms, west and east, with a gap between them, and a balcony over the east one. */
const createFences = (...fences: Array<string>) => {
  const store = createStore<GeofenceState>(() => ({
    crossing: null,
    fences,
  }))
  /** Takes the player across into the fences. */
  const cross = (into: Array<string>, position: Vec3, velocity: Vec3) => store.setState({
    crossing: {
      position,
      velocity,
    },
    fences: into,
  })
  return {
    store,
    cross,
  }
}
test('every fence entered and left is logged on its own, with the position, the velocity and the title', async () => {
  const {telemetry, read} = createTelemetry()
  const {store, cross} = createFences('west')
  const stop = recordGeofenceCrossings(telemetry, store, id => (id === 'west' ? 'West Wing' : undefined))
  cross([], [5, 0, 2], [1.5, 0, 0])
  cross(['east'], [7, 0, 2], [1.5, 0, 0])
  cross(['east', 'balcony'], [9, 4, 2.0004], [0.5, 2.34567, -0.0004])
  cross(['east'], [9, 0, 2], [0, -6, 0])
  stop()
  cross(['west'], [2, 0, 2], [0, 0, 0])
  const records = await read()
  expect(records.map(record => [record['event.name'], record['geofence.id'], record._msg])).toEqual([
    ['gallery.geofence.left', 'west', 'Left geofence: West Wing'],
    ['gallery.geofence.entered', 'east', 'Entered geofence: east'],
    ['gallery.geofence.entered', 'balcony', 'Entered geofence: balcony'],
    ['gallery.geofence.left', 'balcony', 'Left geofence: balcony'],
  ])
  // Walking east out of the west wing, then into the east one.
  expect(records[0]).toMatchObject({
    'position.x': 5,
    'velocity.x': 1.5,
    'velocity.y': 0,
    'velocity.z': 0,
  })
  expect(records[2]).toMatchObject({
    'position.x': 9,
    'position.y': 4,
    'position.z': 2,
    'velocity.x': 0.5,
    'velocity.y': 2.346,
    'velocity.z': 0,
  })
  // Dropping out of the balcony.
  expect(records[3]).toMatchObject({'velocity.y': -6})
  await telemetry.shutdown()
})
test('a crossing logs the fences it leaves before those it enters, each in the store’s order', async () => {
  const {telemetry, read} = createTelemetry()
  const {store, cross} = createFences('west', 'cellar')
  recordGeofenceCrossings(telemetry, store)
  // A teleport from the west wing’s cellar onto the balcony, both of whose fences it enters at once.
  cross(['east', 'balcony'], [9, 4, 2], [0, 0, 0])
  const records = await read()
  expect(records.map(record => [record['event.name'], record['geofence.id']])).toEqual([
    ['gallery.geofence.left', 'west'],
    ['gallery.geofence.left', 'cellar'],
    ['gallery.geofence.entered', 'east'],
    ['gallery.geofence.entered', 'balcony'],
  ])
  await telemetry.shutdown()
})
test('the fences the player starts in count silently, again whenever the player starts anew', async () => {
  const {telemetry, read} = createTelemetry()
  const {store, cross} = createFences()
  recordGeofenceCrossings(telemetry, store)
  store.setState({
    crossing: null,
    fences: ['east', 'balcony'],
  })
  cross(['east'], [9, 0, 2], [0, -6, 0])
  store.setState({
    crossing: null,
    fences: ['west'],
  })
  cross([], [5, 0, 2], [1.5, 0, 0])
  const records = await read()
  expect(records.map(record => [record['event.name'], record['geofence.id']])).toEqual([['gallery.geofence.left', 'balcony'], ['gallery.geofence.left', 'west']])
  await telemetry.shutdown()
})
