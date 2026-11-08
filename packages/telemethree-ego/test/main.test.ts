import type {EgoSample} from '../src/main.ts'
import type {Attributes, MetricOptions} from 'victoria-browser-client'

import {expect, test} from 'bun:test'

import VictoriaClient from 'victoria-browser-client'

import EgoTelemetry from '../src/main.ts'

type Metric = {
  attributes: Attributes
  name: string
  time?: number
  value: number
}
class TestClient extends VictoriaClient {
  static fixture() {
    const telemetry = new TestClient
    return {
      telemetry,
      metrics: telemetry.metrics,
      values: () => Object.fromEntries(telemetry.metrics.map(metric => [metric.name, metric.value])),
    }
  }
  readonly metrics: Array<Metric> = []
  constructor() {
    let time = 0
    super({
      serviceName: 'telemethree-ego-test',
      endpoint: 'http://localhost:4318',
      interval: false,
      now: () => time++,
    })
  }
  override metric(name: string, value: number, options: MetricOptions = {}) {
    this.metrics.push({
      name,
      value,
      time: options.time,
      attributes: {...options.attributes},
    })
    return true
  }
}
test('world-space position, physical velocity and normalized aim are numeric metrics, not labels', () => {
  const {telemetry, metrics, values} = TestClient.fixture()
  const ego = new EgoTelemetry({
    telemetry,
    metersPerUnit: 0.01,
    read: () => null,
  })
  ego.record({
    position: {
      x: 100,
      y: 200,
      z: 300,
    },
    velocity: {
      x: 300,
      y: 400,
      z: 0,
    },
    aim: {
      origin: {
        x: 100,
        y: 200,
        z: 300,
      },
      direction: {
        x: 0,
        y: 0,
        z: -3,
      },
    },
  })
  const captureTimes = new Set(metrics.map(metric => metric.time))
  expect(captureTimes.size).toBe(1)
  ego.recordAimHit({
    point: {
      x: 100,
      y: 200,
      z: 100,
    },
    distance: 200,
  })
  expect(values()).toMatchObject({
    'ego.position.x': 1,
    'ego.velocity.x': 3,
    'ego.speed': 5,
    'ego.aim.direction.z': -1,
    'ego.aim.distance': 2,
    'ego.aim.hit': 1,
  })
  expect(metrics.every(metric => Object.keys(metric.attributes).length === 0)).toBe(true)
})
test('derived velocity copies mutable positions and resets across teleports and suspension', () => {
  const {telemetry, values} = TestClient.fixture()
  const position = {
    x: 0,
    y: 0,
    z: 0,
  }
  const ego = new EgoTelemetry({
    telemetry,
    read: () => null,
  })
  ego.record({position}, 0)
  position.x = 2
  ego.record({position}, 1000)
  expect(values()['ego.velocity.x']).toBe(2)
  ego.record({
    position: {
      x: 50,
      y: 0,
      z: 0,
    },
    discontinuity: true,
  }, 2000)
  expect(values()['ego.velocity.valid']).toBe(0)
  ego.record({position}, 60_000)
  expect(values()['ego.velocity.valid']).toBe(0)
  ego.reset()
  ego.record({position}, 61_000)
  expect(values()['ego.velocity.valid']).toBe(0)
})
test('sampling gates expensive sources and clears absent aim without stale hit values', () => {
  const {telemetry, values} = TestClient.fixture()
  let now = 0
  let reads = 0
  let hitReads = 0
  let hit = true
  const sample: EgoSample = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    aim: {
      origin: {
        x: 0,
        y: 0,
        z: 0,
      },
      direction: {
        x: 0,
        y: 0,
        z: -1,
      },
    },
  }
  const ego = new EgoTelemetry({
    telemetry,
    now: () => now,
    read: () => {
      reads++
      return sample
    },
    readAimHit: () => {
      hitReads++
      return hit ? {
        point: {
          x: 0,
          y: 0,
          z: -4,
        },
        distance: 4,
      } : null
    },
  })
  ego.update()
  ego.update()
  now = 999
  ego.update()
  expect(reads).toBe(1)
  expect(values()['ego.aim.distance']).toBe(4)
  sample.aim = undefined
  hit = false
  now = 1000
  ego.update()
  expect(values()).toMatchObject({
    'ego.aim.valid': 0,
    'ego.aim.hit': 0,
    'ego.aim.distance': 0,
    'ego.aim.point.z': 0,
  })
  expect(reads).toBe(2)
  expect(hitReads).toBe(2)
  expect(() => new EgoTelemetry({
    telemetry,
    intervalMs: -1,
    read: () => null,
  })).toThrow()
})
test('every-frame sampling preserves motion and viewing angles while raycasts stay at one Hz', () => {
  const {telemetry, metrics, values} = TestClient.fixture()
  let now = 0
  let hitReads = 0
  const ego = new EgoTelemetry({
    telemetry,
    intervalMs: 0,
    now: () => now,
    read: () => ({
      position: {
        x: now / 1000,
        y: 0,
        z: 0,
      },
      aim: {
        origin: {
          x: now / 1000,
          y: 1.6,
          z: 0,
        },
        direction: {
          x: -Math.cos(0.3),
          y: Math.sin(0.3),
          z: 0,
        },
      },
    }),
    readAimHit: () => {
      hitReads++
      return null
    },
  })
  for (let frame = 0; frame <= 240; frame++) {
    now = frame * 1000 / 240
    ego.update()
  }
  expect(metrics.filter(metric => metric.name === 'ego.position.x')).toHaveLength(241)
  expect(metrics.filter(metric => metric.name === 'ego.aim.yaw')).toHaveLength(241)
  expect(hitReads).toBe(2)
  expect(values()['ego.velocity.x']).toBeCloseTo(1)
  expect(values()['ego.aim.yaw']).toBeCloseTo(Math.PI / 2)
  expect(values()['ego.aim.pitch']).toBeCloseTo(0.3)
  ego.reset()
  now += 1
  ego.update()
  expect(values()['ego.velocity.valid']).toBe(0)
  expect(hitReads).toBe(3)
})
