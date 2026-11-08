import type {AimHit, EgoSample, EgoTelemetryOptions, Point3} from './types.ts'

const zero = {
  x: 0,
  y: 0,
  z: 0,
}
const finite = (point: Point3) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)

/** Samples a player/controller adapter, never keyboard events, DOM state or a physics engine. */
export default class EgoTelemetry {
  private readonly aimHitIntervalMs: number
  private readonly intervalMs: number
  private readonly maxGap: number
  private nextAimHit = 0
  private nextSample = 0
  private readonly now: () => number
  private previous: {
    position: Point3
    time: number
  } | null = null
  private readonly scale: number

  constructor(private readonly options: EgoTelemetryOptions) {
    this.intervalMs = options.intervalMs ?? 1000
    this.aimHitIntervalMs = options.aimHitIntervalMs ?? 1000
    this.scale = options.metersPerUnit ?? 1
    this.maxGap = options.maxVelocityGapMs ?? Math.max(this.intervalMs * 3, 1000)
    this.now = options.now ?? (() => performance.now())
    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 0 || ![this.aimHitIntervalMs, this.scale, this.maxGap].every(value => Number.isFinite(value) && value > 0)) {
      throw new RangeError('Ego telemetry intervalMs must be nonnegative; aimHitIntervalMs, maxVelocityGapMs and metersPerUnit must be positive.')
    }
  }

  record(sample: EgoSample, time = this.now()) {
    if (!finite(sample.position) || !Number.isFinite(time)) {
      this.previous = null
      return
    }
    const {position, aim} = sample
    let velocity = sample.velocity && finite(sample.velocity) ? sample.velocity : undefined
    const elapsed = this.previous ? time - this.previous.time : 0
    if (!sample.velocity && !sample.discontinuity && this.previous && elapsed > 0 && elapsed <= this.maxGap) {
      velocity = {
        x: (position.x - this.previous.position.x) * 1000 / elapsed,
        y: (position.y - this.previous.position.y) * 1000 / elapsed,
        z: (position.z - this.previous.position.z) * 1000 / elapsed,
      }
    }
    this.previous = {
      position: {...position},
      time,
    }
    // Give every component the same capture timestamp, even if encoding crosses a millisecond.
    const capturedAt = this.options.telemetry.now()
    const metric = (name: string, value: number, unit = '1') => this.options.telemetry.metric(`ego.${name}`, value, {
      unit,
      time: capturedAt,
      attributes: this.options.attributes,
    })
    const vector = (name: string, value: Point3, unit: string, scale: number) => {
      for (const axis of ['x', 'y', 'z'] as const) {
        metric(`${name}.${axis}`, value[axis] * scale, unit)
      }
    }
    vector('position', position, 'm', this.scale)
    metric('velocity.valid', Number(Boolean(velocity)))
    vector('velocity', velocity ?? zero, 'm/s', this.scale)
    metric('speed', velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) * this.scale : 0, 'm/s')
    const length = aim ? Math.hypot(aim.direction.x, aim.direction.y, aim.direction.z) : 0
    const valid = Boolean(aim && finite(aim.origin) && Number.isFinite(length) && length > 0)
    metric('aim.valid', Number(valid))
    const direction = valid && aim ? {
      x: aim.direction.x / length,
      y: aim.direction.y / length,
      z: aim.direction.z / length,
    } : zero
    vector('aim.origin', valid && aim ? aim.origin : zero, 'm', this.scale)
    vector('aim.direction', direction, '1', 1)
    metric('aim.yaw', valid ? Math.atan2(-direction.x, -direction.z) : 0, 'rad')
    metric('aim.pitch', valid ? Math.asin(Math.max(-1, Math.min(1, direction.y))) : 0, 'rad')
  }

  recordAimHit(sample: AimHit | null) {
    const hit = sample && finite(sample.point) && Number.isFinite(sample.distance) && sample.distance >= 0 ? sample : null
    const capturedAt = this.options.telemetry.now()
    const metric = (name: string, value: number, unit = '1') => this.options.telemetry.metric(`ego.aim.${name}`, value, {
      unit,
      time: capturedAt,
      attributes: this.options.attributes,
    })
    metric('hit', Number(Boolean(hit)))
    metric('distance', (hit?.distance ?? 0) * this.scale, 'm')
    for (const axis of ['x', 'y', 'z'] as const) {
      metric(`point.${axis}`, (hit?.point[axis] ?? 0) * this.scale, 'm')
    }
  }

  reset() {
    this.previous = null
    this.nextSample = 0
    this.nextAimHit = 0
  }

  /** Sample motion each due frame; raycast independently at its slower cadence. */
  update() {
    const time = this.now()
    if (time < this.nextSample) {
      return
    }
    this.nextSample = time + this.intervalMs
    const sample = this.options.read()
    if (!sample) {
      this.previous = null
      return
    }
    this.record(sample, time)
    if (time >= this.nextAimHit && this.options.readAimHit) {
      this.nextAimHit = time + this.aimHitIntervalMs
      this.recordAimHit(this.options.readAimHit())
    }
  }
}
