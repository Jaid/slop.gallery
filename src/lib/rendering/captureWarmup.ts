import {CaptureWarmup} from 'capture-session'
import {useSyncExternalStore} from 'react'

import {viewTuning} from '../worldTuning/ViewTuningModule.ts'
import {readWarmupScale} from './scale.ts'

/** The page’s capture warmup: with `?warmup_scale`, the canvas renders at that scale until a headless capture ends it through the `end_warmup` WebMCP tool. */
export const captureWarmup = new CaptureWarmup({warmupScale: readWarmupScale()})

/** The scale the canvas renders at right now: the permalink’s or the world tuning’s, or the warmup scale while warming. */
export const getRenderScale = () => captureWarmup.scale(viewTuning.get().renderScale)

/** {@link getRenderScale}, following the world tuning and the end of the warmup. */
export function useRenderScale() {
  const scale = viewTuning.useValues(state => state.renderScale)
  // Derived from the snapshot itself, so the React Compiler doesn’t keep a scale memoized from before the warmup ended.
  const warming = useSyncExternalStore(captureWarmup.subscribe, captureWarmup.getSnapshot, captureWarmup.getSnapshot)
  return warming ? captureWarmup.scale(scale) : scale
}
