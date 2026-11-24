import type {TuningValues} from '../worldTuning/index.ts'
import type WorldTuning from '../worldTuning/WorldTuning.ts'
import type SlopGalleryTelemetry from './SlopGalleryTelemetry.ts'
import type {Attributes, Span} from 'victoria-browser-client'

import {lastTuningSource} from '../worldTuning/base/TuningModule.ts'
import worldTuning from '../worldTuning/index.ts'
import {useWorldTuningPanel} from '../worldTuning/panel.ts'

type Context = () => Attributes
type Snapshot = Record<string, TuningValues>

/** how long the values have to stay put before a change counts as settled, so a slider drag logs once instead of once per step */
const settleMs = 300
/** frames right after a settled change that the steady statistics leave out, since they carry rebuilds like the pipeline’s and shader compilation */
const warmupMs = 500
const flatten = (snapshot: Snapshot, prefix: string): Attributes => Object.fromEntries(Object.entries(snapshot).flatMap(([module, values]) => Object.entries(values).map(([key, value]) => [`${prefix}${module}.${key}`, value])))
const percentile = (sorted: Array<number>, fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0
const round = (value: number) => Math.round(value * 1000) / 1000

/** Frame time statistics of a stretch of frame durations in milliseconds. */
export function summarizeFrames(durations: Array<number>, prefix: string): Attributes {
  if (durations.length === 0) {
    return {[`${prefix}.count`]: 0}
  }
  const sorted = durations.toSorted((a, b) => a - b)
  const total = durations.reduce((sum, duration) => sum + duration, 0)
  return {
    [`${prefix}.count`]: durations.length,
    [`${prefix}.fps`]: round(1000 * durations.length / total),
    [`${prefix}.mean_ms`]: round(total / durations.length),
    [`${prefix}.p50_ms`]: round(percentile(sorted, 0.5)),
    [`${prefix}.p95_ms`]: round(percentile(sorted, 0.95)),
    [`${prefix}.p99_ms`]: round(percentile(sorted, 0.99)),
    [`${prefix}.max_ms`]: round(sorted.at(-1)!),
  }
}

/**
 * Records what the world tuning changes and what that does to performance. Every settled change of any value, by the panel, a key, a WebMCP tool or the code, shown or hidden, logs a `gallery.world_tuning.changed` event with the values it changed as `module.key`, each from and to, and what changed them.
 * While the panel shows, each stretch between two changes becomes a `gallery.world_tuning.segment` span with every value plus the frame times measured during it, its warm-up after a change, with rebuilds and shader compilation, apart from the steady frames. Frame times come from `requestAnimationFrame`, which only runs while the panel shows.
 */
export function attachWorldTuningTelemetry(telemetry: SlopGalleryTelemetry, getContext: Context, tuning: WorldTuning = worldTuning, panel = useWorldTuningPanel) {
  let settled: Snapshot = tuning.values()
  let segment: {
    frames: Array<number>
    span: Span
    start: number
    warmup: Array<number>
  } | undefined
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  let frame: number | undefined
  let previousFrame: number | undefined
  const endSegment = (outcome: string) => {
    if (!segment) {
      return
    }
    segment.span.end('ok', {
      outcome,
      'segment.duration_ms': Math.round(performance.now() - segment.start),
      ...summarizeFrames(segment.warmup, 'frames.warmup'),
      ...summarizeFrames(segment.frames, 'frames.steady'),
    })
    segment = undefined
  }
  const startSegment = () => {
    segment = {
      frames: [],
      span: telemetry.startSpan('gallery.world_tuning.segment', {attributes: {
        ...getContext(),
        ...flatten(settled, 'world_tuning.'),
      }}),
      start: performance.now(),
      warmup: [],
    }
  }
  const tick = (time: number) => {
    if (segment && previousFrame !== undefined) {
      const bucket = time - segment.start < warmupMs ? segment.warmup : segment.frames
      bucket.push(time - previousFrame)
    }
    previousFrame = time
    frame = requestAnimationFrame(tick)
  }
  const measure = () => {
    startSegment()
    previousFrame = undefined
    frame = requestAnimationFrame(tick)
  }
  const settle = () => {
    settleTimer = undefined
    const next = tuning.values()
    const changed = Object.entries(next).flatMap(([module, values]) => Object.entries(values).filter(([key, value]) => value !== settled[module][key]).map(([key, value]) => ({
      from: settled[module][key],
      key,
      module,
      to: value,
    })))
    if (changed.length === 0) {
      return
    }
    const {open} = panel.getState()
    endSegment('changed')
    telemetry.event('world_tuning.changed', {
      ...getContext(),
      changed: changed.map(({key, module}) => `${module}.${key}`).join(','),
      modules: [...new Set(changed.map(({module}) => module))].join(','),
      source: lastTuningSource.current,
      rebuilt: changed.some(({key, module}) => tuning.module(module)?.rebuilds(key) ?? false),
      'panel.open': open,
      ...Object.fromEntries(changed.flatMap(({from, key, module, to}) => [[`from.${module}.${key}`, from], [`to.${module}.${key}`, to]])),
    }, `World tuning: ${changed.map(({from, key, module, to}) => `${module}.${key} ${String(from)} → ${String(to)}`).join(', ')}`)
    settled = next
    if (open) {
      startSegment()
    }
  }
  const unsubscribeValues = tuning.subscribe(() => {
    // Frames during the drag belong to no settled state.
    endSegment('changing')
    clearTimeout(settleTimer)
    settleTimer = setTimeout(settle, settleMs)
  })
  const unsubscribePanel = panel.subscribe((state, previous) => {
    if (state.open === previous.open) {
      return
    }
    endSegment(state.open ? 'opened' : 'closed')
    telemetry.event(state.open ? 'world_tuning.opened' : 'world_tuning.closed', getContext())
    if (state.open) {
      measure()
    } else if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
  })
  // `?world_tuning` opens the panel with the page.
  if (panel.getState().open) {
    telemetry.event('world_tuning.opened', getContext())
    measure()
  }
  return () => {
    unsubscribeValues()
    unsubscribePanel()
    clearTimeout(settleTimer)
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
    }
    endSegment('detached')
  }
}
