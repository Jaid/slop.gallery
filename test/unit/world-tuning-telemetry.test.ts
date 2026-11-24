import type SlopGalleryTelemetry from '../../src/lib/telemetry/SlopGalleryTelemetry.ts'

import {expect, test} from 'bun:test'

import {attachWorldTuningTelemetry, summarizeFrames} from '../../src/lib/telemetry/worldTuningTelemetry.ts'
import worldTuning from '../../src/lib/worldTuning/index.ts'
import {toggleWorldTuning} from '../../src/lib/worldTuning/panel.ts'
import {pipelineTuning} from '../../src/lib/worldTuning/PipelineTuningModule.ts'
import {viewTuning} from '../../src/lib/worldTuning/ViewTuningModule.ts'

const record = () => {
  const events: Array<[string, Record<string, unknown>]> = []
  const spans: Array<{
    attributes: Record<string, unknown>
    ended?: Record<string, unknown>
  }> = []
  const telemetry = {
    event: (name: string, attributes: Record<string, unknown>) => events.push([name, attributes]),
    startSpan: (_name: string, {attributes}: {attributes: Record<string, unknown>}) => {
      const span: typeof spans[number] = {attributes}
      spans.push(span)
      return {end: (_status: string, values: Record<string, unknown>) => {
        span.ended = values
      }}
    },
  } as unknown as SlopGalleryTelemetry
  return {
    events,
    spans,
    telemetry,
  }
}
// Bun has no animation frames; the frame statistics are covered below.
Object.assign(globalThis, {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
})
test('frame statistics cover rate, mean and tail', () => {
  expect(summarizeFrames([10, 10, 10, 30], 'frames')).toEqual({
    'frames.count': 4,
    'frames.fps': 66.667,
    'frames.mean_ms': 15,
    'frames.p50_ms': 10,
    'frames.p95_ms': 30,
    'frames.p99_ms': 30,
    'frames.max_ms': 30,
  })
  expect(summarizeFrames([], 'frames')).toEqual({'frames.count': 0})
})
test('a settled change logs what changed, from where to where and by what, and splits the measured segments', async () => {
  const {events, spans, telemetry} = record()
  const detach = attachWorldTuningTelemetry(telemetry, () => ({'graphics.profile': 'heavy'}))
  toggleWorldTuning()
  pipelineTuning.set({vignette: 0.4}, 'panel')
  worldTuning.set({
    pipeline: {
      vignette: 0.5,
      contactShadows: true,
    },
  }, 'panel')
  await Bun.sleep(400)
  toggleWorldTuning()
  detach()
  worldTuning.reset()
  expect(events.map(([name]) => name)).toEqual(['world_tuning.opened', 'world_tuning.changed', 'world_tuning.closed'])
  expect(events[1][1]).toEqual({
    'graphics.profile': 'heavy',
    changed: 'pipeline.contactShadows,pipeline.vignette',
    modules: 'pipeline',
    source: 'panel',
    rebuilt: true,
    'panel.open': true,
    'from.pipeline.contactShadows': false,
    'to.pipeline.contactShadows': true,
    'from.pipeline.vignette': 0,
    'to.pipeline.vignette': 0.5,
  })
  expect(spans).toHaveLength(2)
  expect(spans[0].ended).toMatchObject({outcome: 'changing'})
  expect(spans[1].attributes).toMatchObject({
    'world_tuning.pipeline.vignette': 0.5,
    'world_tuning.pipeline.contactShadows': true,
    'world_tuning.view.fov': viewTuning.initial.fov,
  })
  expect(spans[1].ended).toMatchObject({outcome: 'closed'})
})
test('a change logs while the panel is hidden too, without measuring segments', async () => {
  const {events, spans, telemetry} = record()
  const detach = attachWorldTuningTelemetry(telemetry, () => ({}))
  viewTuning.stepFov(1)
  viewTuning.stepFov(1)
  await Bun.sleep(400)
  detach()
  worldTuning.reset()
  expect(events).toEqual([['world_tuning.changed', {
    changed: 'view.fov',
    modules: 'view',
    source: 'key',
    rebuilt: false,
    'panel.open': false,
    'from.view.fov': viewTuning.initial.fov,
    'to.view.fov': viewTuning.initial.fov + 10,
  }]])
  expect(spans).toHaveLength(0)
})
