import type {CaptureRenderWrap} from '../src/main.ts'

import {describe, expect, test} from 'bun:test'

import {PerspectiveCamera, RenderPipeline, RGBAFormat, Scene, UnsignedByteType} from 'three/webgpu'

import WebgpuCapture from '../src/main.ts'
import {encode, TestCapture, TestRenderer} from './helpers.ts'

describe('WebgpuCapture', () => {
  test('rejects non-native renderers and pipelines owned by a different renderer', () => {
    const renderer = new TestRenderer
    renderer.backend.isWebGPUBackend = false
    expect(() => new WebgpuCapture({
      renderer: renderer.asRenderer(),
      scene: new Scene,
      camera: new PerspectiveCamera,
    })).toThrow('native WebGPU')
    renderer.backend.isWebGPUBackend = true
    const foreignRenderer = new TestRenderer
    const pipeline = new RenderPipeline(foreignRenderer.asRenderer())
    expect(() => new WebgpuCapture({
      renderer: renderer.asRenderer(),
      scene: new Scene,
      camera: new PerspectiveCamera,
      pipeline,
    })).toThrow('must belong')
  })
  test('captures the concrete scene/camera or the active WebGPU pipeline', async () => {
    const renderer = new TestRenderer
    const scene = new Scene
    const camera = new PerspectiveCamera
    let rendered = 0
    let postprocessed = 0
    renderer.onRender = () => {
      rendered++
    }
    const direct = new WebgpuCapture({
      renderer: renderer.asRenderer(),
      scene,
      camera,
      encode,
    })
    await direct.captureFrame()
    const pipeline = new RenderPipeline(renderer.asRenderer())
    pipeline.render = () => {
      postprocessed++
    }
    const capture = new WebgpuCapture({
      renderer: renderer.asRenderer(),
      scene,
      camera,
      pipeline,
      encode,
    })
    await capture.captureFrame()
    expect(rendered).toBe(1)
    expect(postprocessed).toBe(1)
    direct.dispose()
    capture.dispose()
  })
  test('a wrap runs around the capture’s render, of the scene or of the pipeline, with the capture’s camera', async () => {
    const renderer = new TestRenderer
    const scene = new Scene
    const camera = new PerspectiveCamera
    const steps: Array<string> = []
    renderer.onRender = () => {
      steps.push('scene')
    }
    const around: CaptureRenderWrap = (render, captured) => {
      expect(captured).toBe(camera)
      steps.push('before')
      render()
      steps.push('after')
    }
    const direct = new WebgpuCapture({
      around,
      renderer: renderer.asRenderer(),
      scene,
      camera,
      encode,
    })
    await direct.capturePixels()
    const pipeline = new RenderPipeline(renderer.asRenderer())
    pipeline.render = () => {
      steps.push('pipeline')
    }
    const capture = new WebgpuCapture({
      around,
      renderer: renderer.asRenderer(),
      scene,
      camera,
      pipeline,
      encode,
    })
    await capture.captureFrame()
    expect(steps).toEqual(['before', 'scene', 'after', 'before', 'pipeline', 'after'])
    direct.dispose()
    capture.dispose()
  })
  test('renders to an RGBA8 output target and restores renderer state before readback settles', async () => {
    const renderer = new TestRenderer
    const previous = {
      target: renderer.target,
      outputTarget: renderer.outputTarget,
    }
    const readback = Promise.withResolvers<Uint8Array<ArrayBuffer>>()
    renderer.readback = () => readback.promise
    const capture = new TestCapture({
      renderer,
      encode,
      render: () => {
        expect(renderer.target).toBeNull()
        expect(renderer.outputTarget).not.toBe(previous.outputTarget)
        expect(renderer.outputTarget?.texture.format).toBe(RGBAFormat)
        expect(renderer.outputTarget?.texture.type).toBe(UnsignedByteType)
        expect(renderer.outputTarget?.samples).toBe(renderer.samples)
        expect(renderer.outputTarget?.depthBuffer).toBe(true)
        expect(renderer.outputTarget?.stencilBuffer).toBe(false)
        expect(renderer.autoClear).toBe(true)
      },
    })
    const pending = capture.captureFrame()
    await Promise.resolve()
    expect(renderer.target).toBe(previous.target)
    expect(renderer.outputTarget).toBe(previous.outputTarget)
    expect(renderer.cubeFace).toBe(3)
    expect(renderer.mipmapLevel).toBe(2)
    expect(renderer.autoClear).toBe(false)
    const whiteFrame = new Uint8Array(16)
    readback.resolve(whiteFrame.fill(255))
    const result = await pending
    expect(result.meanLuminance).toBeCloseTo(255)
    expect(result).toEqual({
      width: 2,
      height: 2,
      centerPixel: [255, 255, 255, 255],
      image: result.image,
      meanLuminance: result.meanLuminance,
      nonBlackFraction: 1,
    })
    expect(result.image.type).toBe('image/png')
    expect(await result.image.text()).toBe('2x2')
    capture.dispose()
  })
  test('coalesces concurrent callers until encoding completes and starts a fresh capture afterward', async () => {
    const renderer = new TestRenderer
    const encoding = Promise.withResolvers<Blob>()
    const started = Promise.withResolvers<void>()
    let renderCount = 0
    const capture = new TestCapture({
      renderer,
      render: () => {
        renderCount += 1
      },
      encode: () => {
        started.resolve()
        return encoding.promise
      },
    })
    const first = capture.captureFrame()
    expect(capture.captureFrame()).toBe(first)
    await started.promise
    expect(capture.captureFrame()).toBe(first)
    expect(renderCount).toBe(1)
    expect(renderer.readCount).toBe(1)
    const encoded = new Blob(['encoded'], {type: 'image/png'})
    encoding.resolve(encoded)
    const result = await first
    expect(result.image).toBe(encoded)
    const next = capture.captureFrame()
    expect(next).not.toBe(first)
    await next
    expect(renderCount).toBe(2)
    capture.dispose()
  })
  test('captures raw pixels without analyzing or encoding them', async () => {
    const renderer = new TestRenderer
    let renderCount = 0
    const capture = new TestCapture({
      renderer,
      render: () => {
        renderCount += 1
      },
      encode: () => {
        throw new Error('Unexpected encode.')
      },
    })
    const first = capture.capturePixels()
    expect(capture.capturePixels()).toBe(first)
    const frame = await first
    expect([frame.width, frame.height]).toEqual([2, 2])
    expect([...frame.pixels]).toEqual(Array.from({length: 16}, () => 255))
    await capture.capturePixels()
    expect(renderCount).toBe(2)
    capture.dispose()
  })
  test('defers disposal until pending captures of both kinds settle', async () => {
    const renderer = new TestRenderer
    const readbacks: Array<PromiseWithResolvers<Uint8Array<ArrayBuffer>>> = []
    renderer.readback = () => {
      const readback = Promise.withResolvers<Uint8Array<ArrayBuffer>>()
      readbacks.push(readback)
      return readback.promise
    }
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    const frame = capture.captureFrame()
    const pixels = capture.capturePixels()
    await Promise.resolve()
    let disposed = 0
    renderer.capturedTarget!.addEventListener('dispose', () => {
      disposed += 1
    })
    capture.dispose()
    await expect(capture.capturePixels()).rejects.toThrow('disposed')
    readbacks[0].resolve(new Uint8Array(16))
    await frame
    expect(disposed).toBe(0)
    readbacks[1].resolve(new Uint8Array(16))
    await pixels
    expect(disposed).toBe(1)
  })
  test('reuses the target and reads the current physical drawing-buffer size for every capture', async () => {
    const renderer = new TestRenderer
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    await capture.captureFrame()
    const target = renderer.capturedTarget!
    renderer.size.set(65, 3)
    const result = await capture.captureFrame()
    expect(renderer.capturedTarget).toBe(target)
    expect([target.width, target.height]).toEqual([65, 3])
    expect([result.width, result.height]).toEqual([65, 3])
    capture.dispose()
  })
  for (const failure of ['render', 'readback-sync', 'readback-async', 'encode'] as const) {
    test(`restores state and allows retry after a ${failure} failure`, async () => {
      const renderer = new TestRenderer
      const previousTarget = renderer.target
      const previousOutput = renderer.outputTarget
      const error = new Error(failure)
      let fail = true
      const originalReadback = renderer.readback
      renderer.readback = () => {
        if (fail && failure === 'readback-sync') {
          throw error
        }
        if (fail && failure === 'readback-async') {
          return Promise.reject(error)
        }
        return originalReadback()
      }
      const capture = new TestCapture({
        renderer,
        render: () => {
          if (fail && failure === 'render') {
            throw error
          }
        },
        encode: frame => {
          if (fail && failure === 'encode') {
            throw error
          }
          return encode(frame)
        },
      })
      await expect(capture.captureFrame()).rejects.toBe(error)
      expect(renderer.target).toBe(previousTarget)
      expect(renderer.outputTarget).toBe(previousOutput)
      expect(renderer.cubeFace).toBe(3)
      expect(renderer.mipmapLevel).toBe(2)
      expect(renderer.autoClear).toBe(false)
      fail = false
      await expect(capture.captureFrame()).resolves.toHaveProperty('width', 2)
      capture.dispose()
    })
  }
  for (const reject of [false, true]) {
    test(`defers disposal until a pending readback ${reject ? 'rejects' : 'resolves'}`, async () => {
      const renderer = new TestRenderer
      const readback = Promise.withResolvers<Uint8Array<ArrayBuffer>>()
      renderer.readback = () => readback.promise
      const capture = new TestCapture({
        renderer,
        render() {},
        encode,
      })
      const pending = capture.captureFrame()
      await Promise.resolve()
      let disposed = 0
      renderer.capturedTarget!.addEventListener('dispose', () => {
        disposed += 1
      })
      capture.dispose()
      capture.dispose()
      expect(disposed).toBe(0)
      await expect(capture.captureFrame()).rejects.toThrow('disposed')
      if (reject) {
        readback.reject(new Error('Device lost.'))
        await expect(pending).rejects.toThrow('Device lost.')
      } else {
        readback.resolve(new Uint8Array(16))
        await expect(pending).resolves.toHaveProperty('width', 2)
      }
      expect(disposed).toBe(1)
      capture[Symbol.dispose]()
      expect(disposed).toBe(1)
    })
  }
  test('allows an accepted capture to finish when disposed before it starts', async () => {
    const renderer = new TestRenderer
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    const pending = capture.captureFrame()
    capture.dispose()
    await expect(pending).resolves.toHaveProperty('width', 2)
    await expect(capture.captureFrame()).rejects.toThrow('disposed')
  })
  test('disposes idle targets exactly once without disposing the renderer’s targets', async () => {
    const renderer = new TestRenderer
    let externalDisposals = 0
    renderer.target!.addEventListener('dispose', () => {
      externalDisposals += 1
    })
    renderer.outputTarget!.addEventListener('dispose', () => {
      externalDisposals += 1
    })
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    await capture.captureFrame()
    let disposals = 0
    renderer.capturedTarget!.addEventListener('dispose', () => {
      disposals += 1
    })
    capture.dispose()
    capture[Symbol.dispose]()
    expect(disposals).toBe(1)
    expect(externalDisposals).toBe(0)
  })
  test('does not allocate or render when disposed without being used', async () => {
    const renderer = new TestRenderer
    const capture = new TestCapture({
      renderer,
      render() {
        throw new Error('Unexpected render.')
      },
      encode,
    })
    capture.dispose()
    await expect(capture.captureFrame()).rejects.toThrow('disposed')
    expect(renderer.readCount).toBe(0)
    expect(renderer.capturedTarget).toBeNull()
  })
  test('rejects empty drawing buffers and recovers after a resize', async () => {
    const renderer = new TestRenderer
    renderer.size.set(0, 0)
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    await expect(capture.captureFrame()).rejects.toThrow('Invalid capture size')
    expect(renderer.readCount).toBe(0)
    renderer.size.set(1, 1)
    await expect(capture.captureFrame()).resolves.toHaveProperty('width', 1)
    capture.dispose()
  })
  test('respects byte offsets and excludes padding from image statistics and encoder input', async () => {
    const renderer = new TestRenderer
    renderer.size.set(1, 2)
    const bytes = new Uint8Array(280)
    bytes.fill(255)
    bytes.set([0, 0, 0, 255], 8)
    bytes.set([255, 0, 0, 128], 264)
    renderer.readback = () => Promise.resolve(bytes.subarray(8, 268))
    const capture = new TestCapture({
      renderer,
      render() {},
      encode: frame => {
        expect([...frame.pixels]).toEqual([0, 0, 0, 255, 255, 0, 0, 128])
        return encode(frame)
      },
    })
    const result = await capture.captureFrame()
    expect(result.centerPixel).toEqual([255, 0, 0, 128])
    expect(result.nonBlackFraction).toBe(0.5)
    expect(result.meanLuminance).toBeCloseTo(255 * 0.2126 / 2)
    capture.dispose()
  })
  test('rejects malformed buffers before encoding and permits a later valid capture', async () => {
    const renderer = new TestRenderer
    renderer.readback = () => Promise.resolve(new Uint8Array(15))
    const capture = new TestCapture({
      renderer,
      render() {},
      encode,
    })
    await expect(capture.captureFrame()).rejects.toThrow('Unexpected WebGPU readback size')
    renderer.readback = () => Promise.resolve(new Uint8Array(16))
    await expect(capture.captureFrame()).resolves.toHaveProperty('width', 2)
    capture.dispose()
  })
  test('supports independent capture instances without sharing state', async () => {
    const first = new TestCapture({
      renderer: new TestRenderer,
      render() {},
      encode,
    })
    const second = new TestCapture({
      renderer: new TestRenderer,
      render() {},
      encode,
    })
    const a = first.captureFrame()
    const b = second.captureFrame()
    expect(a).not.toBe(b)
    first.dispose()
    await Promise.all([a, b])
    await expect(second.captureFrame()).resolves.toHaveProperty('width', 2)
    second.dispose()
  })
})
