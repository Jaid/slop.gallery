import {expect, test} from 'bun:test'
import {tmpdir} from 'node:os'
import {basename, join} from 'node:path'

import fs from 'fs-extra'
import makeSeed from 'make-seed'

import {filmInputs} from '../../scripts/lib/filmInputs.ts'
import {StitchTimeline} from '../../scripts/lib/stitchTimeline.ts'

test('two globby builds × minimatch seeds play target first, skipping exclusions and non-builds, and arguments given again play again', async () => {
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
    expect(inputs.map(({target, seed}) => `${basename(target!)}/${seed}`)).toEqual(['v1/1', 'v1/2', 'v1/2', 'v2/1', 'v2/2', 'v2/2'])
    const explicit = await filmInputs({target: ['v2', 'v1', 'v2']}, root)
    expect(explicit.map(({target}) => basename(target!))).toEqual(['v2', 'v1', 'v2'])
    const globbed = await filmInputs({target: ['v[12]', 'v1']}, root)
    expect(globbed.map(({target}) => basename(target!))).toEqual(['v1', 'v2'])
    await expect(filmInputs({target: 'missing*'}, root)).rejects.toThrow('--target')
  } finally {
    await fs.remove(root)
  }
})
test('seed patterns use the requested range, while literal brace ranges can reach the full seed space', async () => {
  expect(await filmInputs({})).toEqual([{
    seed: '0',
    target: undefined,
  }])
  const inputs = await filmInputs({
    seed: ['{4294967294..4294967295}', '20?', '[1]', 'Hanover'],
    'seed-range': '1..201',
  })
  expect(inputs.map(input => input.seed)).toEqual(['65534', '65535', '200', '201', '1', String(makeSeed('Hanover'))])
  await expect(filmInputs({seed: '999999?'})).rejects.toThrow('--seed')
})
test('the overlap shortens the movie once per cut and blends picture and audio at the same place, including a silent middle clip', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-fade-test-'))
  try {
    const timeline = new StitchTimeline([4, 4, 4], 2, 1)
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
test('a looping movie also fades the last clip into the first, starting where the first clip plays alone, and every starting frame before that fade rotates it', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-loop-test-'))
  try {
    const render = async (startingFrame: number) => {
      const timeline = new StitchTimeline([6, 6, 6], 2, 1, startingFrame, {loop: true})
      const frames: Array<number> = []
      await timeline.stitch(async (clip, write) => {
        for (let frame = 0; frame < 6; frame++) {
          await write(Uint8Array.of(clip * 40 + frame))
        }
        timeline.mix(clip, {
          channels: 1,
          sampleRate: 2,
          samples: Float32Array.from({length: 6}, () => clip + 1),
        })
      }, async pixels => {
        frames.push(pixels[0])
      }, scratch)
      expect(frames.length).toBe(timeline.frameCount)
      return {
        frames,
        samples: [...timeline.audio!.samples],
      }
    }
    const original = await render(1)
    expect(original.frames).toEqual([2, 3, 13, 32, 42, 43, 53, 72, 82, 83, 63, 22])
    expect(original.samples).toEqual([1, 1, 1.25, 1.75, 2, 2, 2.25, 2.75, 3, 3, 2.5, 1.5])
    for (let offset = 1; offset < 10; offset++) {
      const shifted = await render(offset + 1)
      expect(shifted.frames).toEqual([...original.frames.slice(offset), ...original.frames.slice(0, offset)])
      expect(shifted.samples).toEqual([...original.samples.slice(offset), ...original.samples.slice(0, offset)])
    }
    expect(() => new StitchTimeline([6, 6, 6], 2, 1, 11, {loop: true})).toThrow('between 1 and 10')
    expect(() => new StitchTimeline([4, 8, 4], 30, 3 / 30)).not.toThrow()
    expect(() => new StitchTimeline([4, 8, 4], 30, 3 / 30, 1, {loop: true})).toThrow('room for 2 frames')
    const hardCuts = new StitchTimeline([6, 6], 2, 0, 1, {loop: true})
    expect(hardCuts.loops).toBe(false)
  } finally {
    await fs.remove(scratch)
  }
})
test('a single looping clip fades its end into its own beginning, picture and sound, and every starting frame before that fade rotates it', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-single-loop-test-'))
  try {
    const render = async (startingFrame: number) => {
      const timeline = new StitchTimeline([6], 2, 1, startingFrame, {loop: true})
      expect(timeline.recipeStart).toBe(1)
      const frames: Array<number> = []
      await timeline.stitch(async (_, write) => {
        for (let frame = 0; frame < 6; frame++) {
          await write(Uint8Array.of(frame))
        }
        timeline.mix(0, {
          channels: 1,
          sampleRate: 2,
          samples: Float32Array.of(0, 1, 2, 3, 4, 5),
        })
      }, async pixels => {
        frames.push(pixels[0])
      }, scratch)
      return {
        frames,
        samples: [...timeline.audio!.samples],
      }
    }
    const original = await render(1)
    expect(original.frames).toEqual([2, 3, 3, 2])
    expect(original.samples).toEqual([2, 3, 3, 2])
    const shifted = await render(2)
    expect(shifted.frames).toEqual([3, 3, 2, 2])
    expect(shifted.samples).toEqual([3, 3, 2, 2])
    expect(() => new StitchTimeline([6], 2, 1, 3, {loop: true})).toThrow('between 1 and 2')
    const once = new StitchTimeline([6], 2, 1)
    expect(once.fadeFrames).toBe(0)
    expect(once.frameCount).toBe(6)
  } finally {
    await fs.remove(scratch)
  }
})
test('hard cuts keep all frames and excessive overlaps fail before recording', () => {
  const timeline = new StitchTimeline([3, 3, 3, 3], 30, 0)
  expect(timeline.frameCount).toBe(12)
  expect(() => new StitchTimeline([3, 3, 3], 30, 2 / 30)).toThrow('--crossfade')
  expect(() => new StitchTimeline([3, 3], 30, -1)).toThrow('--crossfade')
  const uneven = new StitchTimeline([2, 8, 2], 30, 2 / 30)
  expect(uneven.frameCount).toBe(8)
  expect(() => new StitchTimeline([8, 3, 8], 30, 2 / 30)).toThrow('room for 1 frames')
})
test('every stitched starting frame is one rotation of the original picture and stereo mix, even inside overlaps', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-seam-test-'))
  try {
    const fps = 2.5
    const sampleRate = 8
    const render = async (clips: number, fadeFrames: number, startingFrame: number) => {
      const timeline = new StitchTimeline(Array.from({length: clips}, () => 4), fps, fadeFrames / fps, startingFrame)
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
  const single = new StitchTimeline([4], 2, 0, 4)
  expect(single.recipeStart).toBe(4)
  expect(single.offset).toBe(0)
  for (const invalid of [0, 1.5, 9]) {
    expect(() => new StitchTimeline([4, 4, 4], 2, 1, invalid)).toThrow('between 1 and 8')
  }
})
test('clips of their own lengths line up picture, audio and a rotated seam', async () => {
  const scratch = await fs.mkdtemp(join(tmpdir(), 'film-uneven-test-'))
  try {
    const render = async (startingFrame: number) => {
      const timeline = new StitchTimeline([2, 5, 3], 2, 0.5, startingFrame)
      const frames: Array<number> = []
      await timeline.stitch(async (clip, write) => {
        for (let frame = 0; frame < timeline.clipFrames[clip]; frame++) {
          await write(Uint8Array.of(clip * 40 + frame * 2))
        }
        timeline.mix(clip, {
          channels: 1,
          sampleRate: 2,
          samples: Float32Array.from({length: timeline.clipFrames[clip]}, () => clip + 1),
        })
      }, async pixels => {
        frames.push(pixels[0])
      }, scratch)
      return {
        frames,
        samples: [...timeline.audio!.samples],
      }
    }
    const timeline = new StitchTimeline([2, 5, 3], 2, 0.5)
    expect([0, 1, 2].map(clip => timeline.clipStart(clip))).toEqual([0, 1, 5])
    const original = await render(1)
    expect(original.frames).toEqual([0, 21, 42, 44, 46, 64, 82, 84])
    expect(original.samples).toEqual([1, 1.5, 2, 2, 2, 2.5, 3, 3])
    const shifted = await render(4)
    expect(shifted.frames).toEqual([...original.frames.slice(3), ...original.frames.slice(0, 3)])
    expect(shifted.samples).toEqual([...original.samples.slice(3), ...original.samples.slice(0, 3)])
  } finally {
    await fs.remove(scratch)
  }
})
