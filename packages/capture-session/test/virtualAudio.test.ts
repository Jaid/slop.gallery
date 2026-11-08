import type {Browser} from 'puppeteer-core'

import {afterAll, beforeAll, describe, expect, test} from 'bun:test'

import puppeteer from 'puppeteer-core'

import {installVirtualAudio} from '../src/script/virtualAudio.ts'

const rate = 48_000
const fps = 60
// The page renders sound offline, so any Chromium will do, without a GPU.
describe.skipIf(!process.env.BROWSER)('virtual audio (needs BROWSER)', () => {
  let browser: Browser
  beforeAll(async () => {
    browser = await puppeteer.launch({
      executablePath: process.env.BROWSER,
      headless: true,
      args: ['--disable-gpu'],
    })
  })
  afterAll(() => browser.close())
  const open = async (duration: number) => {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(installVirtualAudio, {
      duration,
      sampleRate: rate,
    })
    await page.goto('data:text/html,<title>virtual audio</title>')
    return page
  }
  test('the page’s audio contexts play at once, report running and only render as far as they are advanced', async () => {
    const page = await open(1)
    const result = await page.evaluate(async (frameRate: number) => {
      const context = new AudioContext
      const live = {
        autoplay: navigator.getAutoplayPolicy?.('audiocontext'),
        offline: context instanceof OfflineAudioContext,
        media: 'createMediaElementSource' in context,
        state: context.state,
      }
      await context.resume()
      const frames = 30
      for (let frame = 0; frame < frames; frame++) {
        await globalThis.virtualAudio!.advance(1 / frameRate)
      }
      const reached = context.currentTime
      // A sound started now, on the 31st frame, is heard from there.
      const tone = new OscillatorNode(context, {
        type: 'square',
        frequency: 220,
      })
      tone.connect(context.destination)
      tone.start(context.currentTime)
      tone.stop(context.currentTime + 0.1)
      const ended = Promise.withResolvers<number>()
      tone.addEventListener('ended', () => ended.resolve(context.currentTime))
      await globalThis.virtualAudio!.advance(0.2)
      const endedAt = await ended.promise
      const recording = await globalThis.virtualAudio!.finish()
      const samples = recording!.samples
      const onset = samples.findIndex(sample => Math.abs(sample) > 0.01)
      const silentAfter = samples.subarray(Math.round(0.65 * 48_000) * recording!.channels).every(sample => sample === 0)
      let advancedAfterFinish = false
      try {
        await globalThis.virtualAudio!.advance(0.1)
        advancedAfterFinish = true
      } catch {}
      return {
        live,
        reached,
        endedAt,
        channels: recording!.channels,
        sampleRate: recording!.sampleRate,
        length: samples.length,
        onset,
        silentAfter,
        advancedAfterFinish,
        time: globalThis.virtualAudio!.time,
      }
    }, fps)
    expect(result.live).toEqual({
      autoplay: 'allowed',
      offline: true,
      media: false,
      state: 'running',
    })
    // 30 frames of 800 samples end on sample 24 000, 187.5 render quanta of 128 samples in, which rounds to the nearest quantum.
    expect(Math.abs(result.reached - 0.5)).toBeLessThanOrEqual(64 / rate + 1e-9)
    expect(result.endedAt).toBeGreaterThanOrEqual(0.6)
    expect(result.endedAt).toBeLessThan(0.71)
    expect(result.channels).toBe(2)
    expect(result.sampleRate).toBe(rate)
    expect(result.length).toBe(rate * 2)
    expect(Math.abs(result.onset / 2 - result.reached * rate)).toBeLessThanOrEqual(2)
    expect(result.silentAfter).toBe(true)
    expect(result.advancedAfterFinish).toBe(false)
    expect(result.time).toBeCloseTo(0.7, 9)
    await page.close()
  })
  test('a context made once the recording is underway is mixed in from where it began', async () => {
    const page = await open(0.5)
    const result = await page.evaluate(async () => {
      const first = new AudioContext
      const tone = (context: AudioContext, frequency: number) => {
        const source = new ConstantSourceNode(context, {offset: frequency})
        source.connect(context.destination)
        source.start()
        source.stop(context.currentTime + 0.1)
      }
      tone(first, 0.25)
      await globalThis.virtualAudio!.advance(0.25)
      const second = new AudioContext
      tone(second, 0.5)
      const secondStart = second.currentTime
      const recording = await globalThis.virtualAudio!.finish()
      const at = (seconds: number) => recording!.samples[Math.round(seconds * 48_000) * 2]
      return {
        secondStart,
        values: [at(0.05), at(0.2), at(0.3), at(0.4)],
      }
    })
    expect(result.secondStart).toBe(0)
    expect(result.values).toEqual([0.25, 0, 0.5, 0])
    await page.close()
  })
  test('advancing without any audio context records nothing', async () => {
    const page = await open(0.25)
    const recording = await page.evaluate(async () => {
      await globalThis.virtualAudio!.advance(0.1)
      return globalThis.virtualAudio!.finish()
    })
    expect(recording).toBeUndefined()
    await page.close()
  })
})
