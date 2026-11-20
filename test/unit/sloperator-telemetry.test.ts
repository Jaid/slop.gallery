import type {SloperatorState} from '../../src/lib/telemetry/types.ts'

import {expect, test} from 'bun:test'

import {createStore} from 'zustand/vanilla'

import recordSloperatorSights from '../../src/lib/telemetry/recordSloperatorSights.ts'
import recordSloperatorSpawns from '../../src/lib/telemetry/recordSloperatorSpawns.ts'
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
test('every sight caught of the Sloperator is logged once, with its sight, how he sat or stood, his distance and where the eye was', async () => {
  const {telemetry, read} = createTelemetry()
  const store = createStore<SloperatorState & {slopped: ReadonlyArray<string>}>(() => ({
    sighted: [],
    slopped: [],
    spawns: {},
  }))
  const stop = recordSloperatorSights(telemetry, store)
  const armchair = {
    sight: 'lodge_east_armchair',
    pose: 'sit_armchair',
    distance: 4.88249,
    position: [-17.86, -3.38, -32.7854] as const,
  }
  const ottoman = {
    sight: 'salon_ottoman',
    pose: 'stand',
    distance: 27.5,
    position: [-13.4, 1.62, -0.0004] as const,
  }
  store.setState({sighted: [armchair]})
  // Another sight leaves the first one as it is, and so does leaving the first one’s fence, which only moves it over.
  store.setState({sighted: [armchair, ottoman]})
  store.setState({
    sighted: [ottoman],
    slopped: ['lodge_east_armchair'],
  })
  stop()
  store.setState({sighted: [ottoman, armchair]})
  const rows = await read()
  const events = rows.filter(row => row['event.name'] === 'gallery.sloperator_sight')
  expect(events).toHaveLength(2)
  expect(events[0]).toMatchObject({
    _msg: 'Caught sight of the Sloperator: lodge_east_armchair',
    level: 'info',
    'sight.id': 'lodge_east_armchair',
    'sight.pose': 'sit_armchair',
    'sight.distance': 4.882,
    'position.x': -17.86,
    'position.y': -3.38,
    'position.z': -32.785,
  })
  expect(events[1]).toMatchObject({
    _msg: 'Caught sight of the Sloperator: salon_ottoman',
    'sight.id': 'salon_ottoman',
    'sight.pose': 'stand',
    'sight.distance': 27.5,
    'position.x': -13.4,
    'position.y': 1.62,
    'position.z': 0,
  })
})
test('every time the player enters a fence of the Sloperator’s, whether he turns up is logged once, with how his seat was found and, where he turns up, his pose and where he is', async () => {
  const {telemetry, read} = createTelemetry()
  const store = createStore<SloperatorState>(() => ({
    sighted: [],
    spawns: {},
  }))
  const stop = recordSloperatorSpawns(telemetry, store)
  const seated = {
    detection: 'moved',
    placement: {
      pose: 'sit',
      position: [4.13449, -0.0000001, -10.99351] as const,
      yaw: 3 * Math.PI / 2 + 0.035,
    },
    result: 'success',
  }
  const blocked = {
    detection: 'blocked',
    result: 'failure',
  }
  store.setState({spawns: {lobby_east_bench: seated}})
  // Another sight leaves the first one as it is, and so does a sighting.
  store.setState({spawns: {
    lobby_east_bench: seated,
    salon_ottoman: blocked,
  }})
  store.setState({sighted: [{
    distance: 9,
    pose: 'sit',
    position: [0, 0, 0],
    sight: 'lobby_east_bench',
  }]})
  // Leaving the fences forgets them; entering one anew asks again.
  store.setState({spawns: {}})
  const standing = {
    detection: 'missing',
    placement: {
      pose: 'stand',
      position: [14, 0, -20.44] as const,
      yaw: Math.PI,
    },
    result: 'success',
  }
  store.setState({spawns: {salon_ottoman: standing}})
  // At a sight without a seat, he stands on his spot, with no seat to find.
  store.setState({spawns: {
    exhibition_glass: {
      detection: 'none',
      placement: {
        pose: 'stand',
        position: [-1.4412, -10.6799, -11.4348] as const,
        yaw: 0.86,
      },
      result: 'success',
    },
    salon_ottoman: standing,
  }})
  stop()
  store.setState({spawns: {lobby_east_bench: seated}})
  const rows = await read()
  const events = rows.filter(row => row['event.name'] === 'gallery.sloperator_spawn')
  expect(events).toHaveLength(4)
  expect(events[0]).toMatchObject({
    _msg: 'Spawned the Sloperator at lobby_east_bench: sit, his seat moved',
    level: 'info',
    'sight.id': 'lobby_east_bench',
    'spawn.result': 'success',
    'spawn.furniture_detection': 'moved',
    'spawn.pose': 'sit',
    'spawn.x': 4.134,
    'spawn.y': 0,
    'spawn.z': -10.994,
    'spawn.yaw': -1.536,
  })
  expect(events[1]).toMatchObject({
    _msg: 'Kept the Sloperator away from salon_ottoman: blocked',
    'sight.id': 'salon_ottoman',
    'spawn.result': 'failure',
    'spawn.furniture_detection': 'blocked',
  })
  expect(Object.keys(events[1]).filter(key => key.startsWith('spawn.')).toSorted()).toEqual(['spawn.furniture_detection', 'spawn.result'])
  expect(events[2]).toMatchObject({
    'sight.id': 'salon_ottoman',
    'spawn.result': 'success',
    'spawn.furniture_detection': 'missing',
    'spawn.pose': 'stand',
    'spawn.x': 14,
    'spawn.z': -20.44,
    'spawn.yaw': 3.142,
  })
  expect(events[3]).toMatchObject({
    _msg: 'Spawned the Sloperator at exhibition_glass: stand',
    'sight.id': 'exhibition_glass',
    'spawn.result': 'success',
    'spawn.furniture_detection': 'none',
    'spawn.pose': 'stand',
    'spawn.x': -1.441,
    'spawn.y': -10.68,
    'spawn.z': -11.435,
    'spawn.yaw': 0.86,
  })
})
