import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import fs from 'fs-extra'

import benchmarkDelta from '../../scripts/benchmarkDelta.ts'
import {compareFramePairs, frameMetrics} from '../../scripts/lib/benchmarkFrames.ts'
import {resolveBenchmarkSetup} from '../../scripts/lib/benchmarkSetup.ts'

test('a hitch counts toward throughput and the tail even when the typical frame stays fast', () => {
  expect(frameMetrics([8, 48, 8, 8, 8])).toEqual({
    medianFrameMs: 8,
    p95FrameMs: 48,
    fps: 62.5,
  })
})
test('each candidate is compared with its own baseline before aggregating repeats', () => {
  const metrics = compareFramePairs([[10, 12], [30, 29], [20, 27]].map(([baseline, candidate]) => ({
    baseline: frameMetrics([baseline]),
    candidate: frameMetrics([candidate]),
  })))
  // Subtracting the independent medians would report +7 ms (+35%).
  expect(metrics.medianFrameMs).toEqual({
    baseline: 20,
    candidate: 27,
    delta: 2,
    percent: 20,
  })
  expect(metrics.fps.percent).toBeCloseTo(-100 / 6)
})
test('a saved setup resolves its own dist and overrides only its side, including parameters new to that build', async () => {
  await using folder = await fs.promises.mkdtempDisposable(join(tmpdir(), 'benchmark-delta-'))
  const baselineTarget = join(folder.path, 'before')
  const candidateTarget = join(folder.path, 'after')
  const file = join(folder.path, 'candidate.json')
  const tools = [1, 2].map(radius => ({
    name: 'set_wireframe',
    input: {radius},
  }))
  await Promise.all([
    Bun.write(join(baselineTarget, 'index.html'), ''),
    Bun.write(join(candidateTarget, 'index.html'), ''),
    Bun.write(file, JSON.stringify({
      target: 'after',
      parameters: {
        seed: 42,
        new_effect: 'a & b',
      },
      tools,
    })),
  ])
  const shared = {
    seed: '0',
    graphics: 'heavy',
    room: 'studio',
  }
  const [baseline, candidate] = await Promise.all([baselineTarget, file].map(input => resolveBenchmarkSetup(input, shared, 720)))
  expect(baseline.target).toBe(baselineTarget)
  expect(baseline.search.get('seed')).toBe('0')
  expect(baseline.search.has('new_effect')).toBe(false)
  expect(baseline.tools).toEqual([])
  expect(candidate.target).toBe(candidateTarget)
  expect(candidate.search.get('room')).toBe('studio')
  expect(candidate.search.get('seed')).toBe('42')
  expect(candidate.search.get('new_effect')).toBe('a & b')
  expect(candidate.tools).toEqual(tools)
})
test('a malformed preparation or empty sampling window fails before either browser starts', async () => {
  await expect(benchmarkDelta('false', '{"tools":[{"name":"set_world_tuning","args":{}}]}')).rejects.toThrow('tools')
  await expect(benchmarkDelta({}, {}, {seconds: 0})).rejects.toThrow('--seconds')
  await expect(benchmarkDelta({}, {}, {repeats: 1.5})).rejects.toThrow('--repeats')
})
