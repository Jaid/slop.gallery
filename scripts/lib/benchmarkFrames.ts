import type {Page} from 'puppeteer-core'

import {mean, median, percentile} from 'es-toolkit'

/** Let the workload set the frame rate, even when both scenes run faster than the display. */
export const uncappedFrameArgs = ['--disable-gpu-vsync', '--disable-frame-rate-limit']

/** Wall-clock intervals between animation frames. The first callback starts the clock; no DevTools round trips take place inside the sample. */
export const frameIntervals = (page: Page, milliseconds = 5000) => page.evaluate(duration => new Promise<Array<number>>(resolve => {
  requestAnimationFrame(start => {
    const intervals: Array<number> = []
    let previous = start
    const tick = (time: number) => {
      intervals.push(time - previous)
      previous = time
      if (time - start >= duration) {
        resolve(intervals)
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })
}), milliseconds)

export const frameMetrics = (intervals: ReadonlyArray<number>) => {
  const medianFrameMs = median(intervals)
  if (!(medianFrameMs > 0)) {
    throw new Error('No measurable median frame interval.')
  }
  return {
    medianFrameMs,
    p95FrameMs: percentile(intervals, 95),
    fps: 1000 / mean(intervals),
  }
}

export type Pair<T> = {
  baseline: T
  candidate: T
}
type FrameMetrics = ReturnType<typeof frameMetrics>

/** Compare within each repeat before taking medians, so a change in the GPU’s speed between repeats doesn’t count toward the delta. */
export function compareFramePairs(pairs: ReadonlyArray<Pair<FrameMetrics>>) {
  const compare = (key: keyof FrameMetrics) => ({
    baseline: median(pairs.map(pair => pair.baseline[key])),
    candidate: median(pairs.map(pair => pair.candidate[key])),
    delta: median(pairs.map(({baseline, candidate}) => candidate[key] - baseline[key])),
    percent: median(pairs.map(({baseline, candidate}) => 100 * (candidate[key] - baseline[key]) / baseline[key])),
  })
  return {
    medianFrameMs: compare('medianFrameMs'),
    p95FrameMs: compare('p95FrameMs'),
    fps: compare('fps'),
  }
}
