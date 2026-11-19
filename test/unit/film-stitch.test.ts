import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'

import fs from 'fs-extra'

import {filmInputs} from '../../scripts/lib/filmInputs.ts'
import {StitchTimeline} from '../../scripts/lib/stitchTimeline.ts'

test('two globby builds × two minimatch seeds play target first, skipping exclusions, non-builds and duplicates', async () => {
  const root = await fs.mkdtemp(join(tmpdir(), 'film-builds-'))
  try {
    for (const build of ['v2', 'v1', 'v3']) {
      await fs.outputFile(join(root, build, 'index.html'), '')
    }
    await fs.ensureDir(join(root, 'v4'))
    const inputs = await filmInputs({
      target: ['v*', '!v3'],
      seed: ['[12]', '2'],
    }, root)
    expect(inputs.map(({target, seed}) => `${basename(target!)}/${seed}`)).toEqual(['v1/1', 'v1/2', 'v2/1', 'v2/2'])
    const explicit = await filmInputs({target: ['v2', 'v1']}, root)
    expect(explicit.map(({target}) => basename(target!))).toEqual(['v2', 'v1'])
    await expect(filmInputs({target: 'missing*'}, root)).rejects.toThrow('--target')
  } finally {
    await fs.remove(root)
  }
})
test('seed patterns use the requested range, while literal brace ranges can reach the full seed space', async () => {
  expect(await filmInputs({})).toEqual([{
    seed: '1',
    target: undefined,
  }])
  const inputs = await filmInputs({
    seed: ['{4294967294..4294967295}', '20?', '[1]'],
    'seed-range': '1..201',
  })
  expect(inputs.map(input => input.seed)).toEqual(['4294967294', '4294967295', '200', '201', '1'])
  await expect(filmInputs({seed: 'invalid'})).rejects.toThrow('--seed')
})
test('the overlap shortens the movie once per cut and blends picture and audio at the same place, including a silent middle clip', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-fade-test-'))
  try {
    const timeline = new StitchTimeline(3, 4, 2, 1)
    const frames: Array<number> = []
    await timeline.stitch(async (clip, write) => {
      for (const frame of [0, 1, 2, 3]) {
        await write(Uint8Array.of(clip * 40 + frame))
      }
      if (clip !== 1) {
        timeline.mix(clip, {
          channels: 1,
          sampleRate: 2,
          samples: Float32Array.of(1, 1, 1, 1),
        })
      }
    }, async pixels => {
      frames.push(pixels[0])
    }, scratch)
    expect(frames).toEqual([0, 1, 12, 32, 52, 72, 82, 83])
    expect(frames.length).toBe(timeline.frameCount)
    expect([...timeline.audio!.samples]).toEqual([1, 1, 0.75, 0.25, 0.25, 0.75, 1, 1])
  } finally {
    await fs.remove(scratch)
  }
})
test('hard cuts keep all frames and excessive overlaps fail before recording', () => {
  const timeline = new StitchTimeline(4, 3, 30, 0)
  expect(timeline.frameCount).toBe(12)
  expect(() => new StitchTimeline(3, 3, 30, 2 / 30)).toThrow('--crossfade')
  expect(() => new StitchTimeline(2, 3, 30, -1)).toThrow('--crossfade')
})
test('every stitched starting frame is one rotation of the original picture and stereo mix, even inside overlaps', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-seam-test-'))
  try {
    const fps = 2.5
    const sampleRate = 8
    const render = async (clips: number, fadeFrames: number, startingFrame: number) => {
      const timeline = new StitchTimeline(clips, 4, fps, fadeFrames / fps, startingFrame)
      const frames: Array<number> = []
      const takes: Array<number> = []
      await timeline.stitch(async (clip, write) => {
        takes.push(clip)
        for (const frame of [0, 1, 2, 3]) {
          await write(Uint8Array.of(clip * 50 + frame * 3))
        }
        timeline.mix(clip, {
          channels: 2,
          sampleRate,
          samples: Float32Array.from({length: 26}, (_, i) => clip * 100 + i),
        })
      }, async pixels => {
        frames.push(pixels[0])
      }, scratch)
      expect(takes.toSorted((a, b) => a - b)).toEqual(Array.from({length: clips}, (_, i) => i))
      expect(timeline.recipeStart).toBe(1)
      return {
        frames,
        samples: [...timeline.audio!.samples],
      }
    }
    for (const [clips, fade] of [[3, 0], [3, 2], [2, 4]]) {
      const original = await render(clips, fade, 1)
      for (let offset = 1; offset < original.frames.length; offset++) {
        const shifted = await render(clips, fade, offset + 1)
        expect(shifted.frames).toEqual([...original.frames.slice(offset), ...original.frames.slice(0, offset)])
        const channelOffset = Math.round(offset * sampleRate / fps) * 2
        expect(shifted.samples).toEqual([...original.samples.slice(channelOffset), ...original.samples.slice(0, channelOffset)])
      }
    }
  } finally {
    await fs.remove(scratch)
  }
})
test('starting-frame is bounded by the final frame count, and a single take still begins at the requested recipe frame', () => {
  const single = new StitchTimeline(1, 4, 2, 0, 4)
  expect(single.recipeStart).toBe(4)
  expect(single.offset).toBe(0)
  for (const invalid of [0, 1.5, 9]) {
    expect(() => new StitchTimeline(3, 4, 2, 1, invalid)).toThrow('between 1 and 8')
  }
})
