import type {EgoTelemetryOptions} from '../types.ts'

import {useFrame} from '@react-three/fiber'
import {useEffect, useRef} from 'react'

import EgoTelemetry from '../EgoTelemetry.ts'

export default function useEgoTelemetry(options: EgoTelemetryOptions) {
  const read = useRef(options.read)
  read.current = options.read
  const readAimHit = useRef(options.readAimHit)
  readAimHit.current = options.readAimHit
  const collector = useRef<EgoTelemetry | null>(null)
  const {telemetry, intervalMs, aimHitIntervalMs, metersPerUnit, maxVelocityGapMs, attributes, now} = options
  useEffect(() => {
    const instance = new EgoTelemetry({
      telemetry,
      intervalMs,
      aimHitIntervalMs,
      metersPerUnit,
      maxVelocityGapMs,
      attributes,
      now,
      read: () => read.current(),
      readAimHit: () => readAimHit.current?.() ?? null,
    })
    collector.current = instance
    const reset = () => instance.reset()
    document.addEventListener('visibilitychange', reset)
    return () => {
      document.removeEventListener('visibilitychange', reset)
      collector.current = null
    }
  }, [telemetry, intervalMs, aimHitIntervalMs, metersPerUnit, maxVelocityGapMs, attributes, now])
  useFrame(() => {
    if (document.visibilityState !== 'hidden') {
      collector.current?.update()
    }
  }, {phase: 'finish'})
}
