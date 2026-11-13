import type {ThreeStatisticsOptions} from '../ThreeStatistics.ts'
import type {TelemetryClient} from '../types.ts'
import type {Scene, WebGPURenderer} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {useEffect, useRef} from 'react'

import ThreeStatistics from '../ThreeStatistics.ts'
import {useTelemetry} from './context.tsx'

/** Whether the application stopped its frames on purpose, like a paused game: `getSnapshot` tells so, and `subscribe` calls back whenever that changes, returning how to unsubscribe. The shape `useSyncExternalStore` takes. */
export type FramePauses = {
  getSnapshot: () => boolean
  subscribe: (listener: () => void) => () => void
}
export type ThreeTelemetryOptions = ThreeStatisticsOptions & {
  /** Frames drawn during such a pause aren’t sampled, and neither the pause nor the frames within it count as frame time, so a paused game leaves no stall behind, like a hidden page. Keep it stable. */
  pauses?: FramePauses
  telemetry?: TelemetryClient
}

/** Collect from the WebGPU Canvas after all render passes. */
export default function useThreeTelemetry(options: ThreeTelemetryOptions = {}) {
  const {telemetry, intervalMs, maxSamples, gpuIntervalMs, hitchThresholdMs, hitchCooldownMs, pauses} = options
  const latest = useRef(options)
  latest.current = options
  const client = useTelemetry(telemetry)
  const collector = useRef<ThreeStatistics | null>(null)
  const stop = useRef<(() => void) | null>(null)
  const scene = useRef<Scene | null>(null)
  const renderer = useRef<WebGPURenderer | null>(null)
  const previousFrame = useRef<number | null>(null)
  useEffect(() => {
    const reset = () => {
      collector.current?.reset()
      previousFrame.current = null
    }
    document.addEventListener('visibilitychange', reset)
    // As a pause begins and as it ends, before the first frame after it.
    const unsubscribe = pauses?.subscribe(reset)
    return () => {
      document.removeEventListener('visibilitychange', reset)
      unsubscribe?.()
      stop.current?.()
      stop.current = null
      collector.current = null
      previousFrame.current = null
    }
  }, [client, intervalMs, maxSamples, gpuIntervalMs, hitchThresholdMs, hitchCooldownMs, pauses])
  const sampling = () => document.visibilityState !== 'hidden' && !pauses?.getSnapshot()
  useFrame(state => {
    if (!collector.current || renderer.current !== state.renderer || scene.current !== state.scene) {
      stop.current?.()
      collector.current = new ThreeStatistics(client, state.renderer, state.scene, {
        intervalMs,
        maxSamples,
        gpuIntervalMs,
        hitchThresholdMs,
        hitchCooldownMs,
        getAttributes: () => ({
          ...latest.current.attributes,
          ...latest.current.getAttributes?.(),
        }),
        getTraceContext: () => latest.current.getTraceContext?.(),
        getHitchAttributes: () => latest.current.getHitchAttributes?.() ?? {},
        describePass: (passScene, camera, target) => latest.current.describePass?.(passScene, camera, target),
      })
      stop.current = collector.current.connect()
      renderer.current = state.renderer
      scene.current = state.scene
    }
    if (sampling()) {
      collector.current.beginFrame()
    }
  }, {phase: 'start'})
  useFrame(() => {
    if (sampling()) {
        // Fiber clamps simulation delta. Use wall-clock frame intervals so stalls remain visible.
      const now = performance.now()
      const delta = previousFrame.current === null ? 0 : (now - previousFrame.current) / 1000
      previousFrame.current = now
      collector.current?.endFrame(delta)
    }
  }, {phase: 'finish'})
  return client
}
