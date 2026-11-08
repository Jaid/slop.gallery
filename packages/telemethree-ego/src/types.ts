import type VictoriaClient from 'victoria-browser-client'
import type {Attributes} from 'victoria-browser-client'

export type TelemetryClient = Pick<VictoriaClient, 'metric' | 'now'>

export type Point3 = Readonly<{
  x: number
  y: number
  z: number
}>
export type Aim = {
  direction: Point3
  origin: Point3
}
export type AimHit = {
  distance: number
  point: Point3
}
export type EgoSample = {
  aim?: Aim
  /** Set for a teleport or other discontinuity when deriving velocity from positions. */
  discontinuity?: boolean
  position: Point3
  /** World-space physical velocity in world units per second; preferred over differentiation. */
  velocity?: Point3
}
export type EgoTelemetryOptions = {
  /** Cadence for the expensive aim hit query, independent of frame measurements. */
  aimHitIntervalMs?: number
  attributes?: Attributes
  /** Zero records every update; defaults to 1000 ms. */
  intervalMs?: number
  maxVelocityGapMs?: number
  metersPerUnit?: number
  now?: () => number
  read: () => EgoSample | null
  readAimHit?: () => AimHit | null
  telemetry: TelemetryClient
}
